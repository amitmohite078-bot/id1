import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ErrorCode } from '@salonbridge/types';
import { AppError } from './errors.js';
import type { AppEnv } from '../config/env.js';

const ALLOWED_MENU_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function detectMagicMime(buffer: Buffer, fallbackMime?: string): string {
  if (buffer.length >= 4) {
    // PDF: %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'application/pdf';
    }
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    // ZIP-based (XLSX / DOCX): PK 03 04
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return fallbackMime ?? 'application/zip';
    }
    // WEBP: RIFF....WEBP
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
  }
  return fallbackMime ?? 'application/octet-stream';
}

export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: AppEnv) {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }

  async createMenuUploadUrl(input: {
    salonId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }) {
    if (!ALLOWED_MENU_MIMES.has(input.contentType)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Unsupported menu file type');
    }

    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const key = `salons/${input.salonId}/menus/${crypto.randomUUID()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    return { uploadUrl, fileKey: key, expiresInSeconds: 300 };
  }

  async getObjectBuffer(fileKey: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      }),
    );
    if (!res.Body) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Uploaded menu file not found in storage');
    }
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
}

