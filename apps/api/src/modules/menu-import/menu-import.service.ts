import { ErrorCode, type MenuSourceType, type UpdateMenuImportItemInput } from '@salonbridge/types';
import { AppError } from '../../lib/errors.js';
import { detectMagicMime, type StorageService } from '../../lib/storage.js';
import { parseSpreadsheetBuffer } from './menu.parser.js';
import type { MenuAiExtractor } from './menu.ai-extractor.js';
import type { MenuImportRepository } from './menu-import.repository.js';

export interface MenuImportQueue {
  enqueue(payload: { jobId: string; rawText?: string }): Promise<void>;
}

export interface DiffResult {
  added: Array<{ serviceName: string; pricePaise: number; durationMinutes: number }>;
  changed: Array<{
    serviceName: string;
    oldPricePaise: number;
    newPricePaise: number;
    oldDurationMinutes: number;
    newDurationMinutes: number;
  }>;
  unchangedCount: number;
}

export function computeMenuDiff(
  approvedItems: Array<{
    serviceName: string;
    pricePaise: number | null;
    durationMinutes: number;
  }>,
  existingServices: Array<{
    name: string;
    pricePaise: number;
    durationMinutes: number;
  }>,
): DiffResult {
  const existingMap = new Map(existingServices.map((s) => [s.name.toLowerCase(), s]));
  const added: DiffResult['added'] = [];
  const changed: DiffResult['changed'] = [];
  let unchangedCount = 0;

  for (const item of approvedItems) {
    if (!item.pricePaise) continue;
    const existing = existingMap.get(item.serviceName.toLowerCase());
    if (!existing) {
      added.push({
        serviceName: item.serviceName,
        pricePaise: item.pricePaise,
        durationMinutes: item.durationMinutes,
      });
    } else if (
      existing.pricePaise !== item.pricePaise ||
      existing.durationMinutes !== item.durationMinutes
    ) {
      changed.push({
        serviceName: item.serviceName,
        oldPricePaise: existing.pricePaise,
        newPricePaise: item.pricePaise,
        oldDurationMinutes: existing.durationMinutes,
        newDurationMinutes: item.durationMinutes,
      });
    } else {
      unchangedCount++;
    }
  }

  return { added, changed, unchangedCount };
}

export class MenuImportService {
  constructor(
    private readonly repo: MenuImportRepository,
    private readonly storage: StorageService,
    private readonly aiExtractor: MenuAiExtractor,
    private readonly queue?: MenuImportQueue,
  ) {}

  async createUploadUrl(
    salonId: string,
    input: { fileName: string; contentType: string; sizeBytes: number },
  ) {
    return this.storage.createMenuUploadUrl({ salonId, ...input });
  }

  async startImportJob(input: {
    salonId: string;
    userId: string;
    sourceType: MenuSourceType;
    fileKey?: string;
    rawText?: string;
  }) {
    if (input.sourceType === 'text' && !input.rawText) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'rawText is required for text imports');
    }
    if (input.sourceType !== 'text' && !input.fileKey) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'fileKey is required for file imports');
    }

    // Enforce monthly AI import quota per subscription plan
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [used, limit] = await Promise.all([
      this.repo.countJobsSince(input.salonId, monthStart),
      this.repo.getMonthlyImportLimit(input.salonId),
    ]);

    if (used >= limit) {
      throw new AppError(
        429,
        ErrorCode.RATE_LIMITED,
        `Monthly menu import quota reached (${used}/${limit}). Upgrade your plan to import more.`,
      );
    }

    const job = await this.repo.createJob({
      salonId: input.salonId,
      uploadedBy: input.userId,
      sourceType: input.sourceType,
      fileKey: input.fileKey ?? 'inline-text',
    });

    if (this.queue) {
      await this.queue.enqueue({ jobId: job.id, rawText: input.rawText });
    } else {
      setImmediate(() => {
        void this.processJob(job.id, input.rawText);
      });
    }

    return job;
  }

  async processJob(jobId: string, inlineText?: string) {
    const job = await this.repo.getJobById(jobId);
    if (!job) return;

    await this.repo.markJobProcessing(jobId);

    try {
      if (job.sourceType === 'text') {
        const result = await this.aiExtractor.extractFromText(inlineText ?? '');
        await this.repo.completeJobWithItems({
          jobId: job.id,
          salonId: job.salonId,
          ...result,
        });
        return;
      }

      const buffer = await this.storage.getObjectBuffer(job.fileKey);
      const detectedMime = detectMagicMime(buffer);

      if (job.sourceType === 'csv' || job.sourceType === 'xlsx') {
        const items = parseSpreadsheetBuffer(buffer);
        await this.repo.completeJobWithItems({
          jobId: job.id,
          salonId: job.salonId,
          items,
          inputTokens: 0,
          outputTokens: 0,
          costPaise: 0,
          rawOutput: { parser: 'deterministic_spreadsheet', count: items.length },
        });
        return;
      }

      if (job.sourceType === 'docx') {
        const text = buffer.toString('utf8').replace(/<[^>]+>/g, ' ').slice(0, 30_000);
        const result = await this.aiExtractor.extractFromText(text);
        await this.repo.completeJobWithItems({
          jobId: job.id,
          salonId: job.salonId,
          ...result,
        });
        return;
      }

      // Image or PDF -> Claude Vision / Document extraction
      const mimeForClaude =
        detectedMime.startsWith('image/') || detectedMime === 'application/pdf'
          ? detectedMime
          : job.sourceType === 'pdf'
            ? 'application/pdf'
            : 'image/jpeg';

      const result = await this.aiExtractor.extractFromImageOrPdf({
        buffer,
        mimeType: mimeForClaude,
      });

      await this.repo.completeJobWithItems({
        jobId: job.id,
        salonId: job.salonId,
        ...result,
      });
    } catch (err) {
      await this.repo.failJob(job.id, (err as Error).message);
    }
  }

  async listJobs(salonId: string) {
    return this.repo.listJobs(salonId);
  }

  async getJob(salonId: string, jobId: string) {
    const data = await this.repo.getJobWithItems(salonId, jobId);
    if (!data) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Menu import job not found');
    }
    return data;
  }

  async updateItem(
    salonId: string,
    jobId: string,
    itemId: string,
    patch: UpdateMenuImportItemInput,
  ) {
    const updated = await this.repo.updateImportItem(salonId, jobId, itemId, patch);
    if (!updated) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Import item not found');
    }
    return updated;
  }

  async getPublishDiff(salonId: string, jobId: string) {
    const data = await this.getJob(salonId, jobId);
    const approved = data.items.filter((i) => i.reviewStatus === 'approved' && i.pricePaise);
    const existing = await this.repo.getSalonServices(salonId);
    return computeMenuDiff(approved, existing);
  }

  async publishJob(salonId: string, jobId: string, userId: string) {
    const data = await this.getJob(salonId, jobId);
    if (data.job.status !== 'review_ready') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Job is not ready to publish');
    }

    const approved = data.items.filter((i) => i.reviewStatus === 'approved');
    if (approved.length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'No approved items to publish');
    }

    const invalid = approved.find((i) => !i.pricePaise || i.pricePaise < 100);
    if (invalid) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        `Approved item "${invalid.serviceName}" is missing a valid price`,
      );
    }

    return this.repo.publishApprovedItems({
      salonId,
      jobId,
      userId,
      approvedItems: approved.map((i) => ({
        categoryName: i.categoryName,
        serviceName: i.serviceName,
        description: i.description,
        pricePaise: i.pricePaise!,
        durationMinutes: i.durationMinutes,
        genderTag: i.genderTag,
      })),
    });
  }

  async listVersions(salonId: string) {
    return this.repo.listVersions(salonId);
  }

  async rollbackVersion(salonId: string, versionNumber: number, userId: string) {
    const result = await this.repo.rollbackToVersion(salonId, versionNumber, userId);
    if (!result) {
      throw new AppError(404, ErrorCode.NOT_FOUND, `Menu version ${versionNumber} not found`);
    }
    return result;
  }
}

