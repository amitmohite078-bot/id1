import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateMenuImportSchema,
  PresignedUploadRequestSchema,
  RoleName,
  UpdateMenuImportItemSchema,
} from '@salonbridge/types';
import { requireRoles, requireSalonMember } from '../../plugins/auth.js';
import type { MenuImportService } from './menu-import.service.js';

const JobParams = z.object({ jobId: z.string().uuid() });
const ItemParams = z.object({ jobId: z.string().uuid(), itemId: z.string().uuid() });
const VersionParams = z.object({ version: z.coerce.number().int().positive() });

export function registerMenuImportRoutes(
  app: FastifyInstance,
  menuImportService: MenuImportService,
) {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const ownerOrManager = [
    requireSalonMember(),
    requireRoles(RoleName.SALON_OWNER, RoleName.SALON_MANAGER),
  ];

  server.post('/api/v1/salon/menu-imports/upload-url', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['AI Menu Import'],
      summary: 'Generate presigned S3/MinIO upload URL for a salon menu file',
      body: PresignedUploadRequestSchema,
    },
    handler: async (request) => {
      const data = await menuImportService.createUploadUrl(
        request.user.salonId!,
        request.body,
      );
      return { data };
    },
  });

  server.post('/api/v1/salon/menu-imports', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['AI Menu Import'],
      summary: 'Create and enqueue an AI/deterministic menu import job',
      body: CreateMenuImportSchema,
    },
    handler: async (request, reply) => {
      const job = await menuImportService.startImportJob({
        salonId: request.user.salonId!,
        userId: request.user.sub,
        ...request.body,
      });
      return reply.status(202).send({ data: job });
    },
  });

  server.get('/api/v1/salon/menu-imports', {
    preHandler: ownerOrManager,
    schema: { tags: ['AI Menu Import'], summary: 'List menu import jobs for salon' },
    handler: async (request) => {
      const jobs = await menuImportService.listJobs(request.user.salonId!);
      return { data: jobs };
    },
  });

  server.get('/api/v1/salon/menu-imports/:jobId', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['AI Menu Import'],
      summary: 'Get menu import job status and extracted items for review',
      params: JobParams,
    },
    handler: async (request) => {
      const data = await menuImportService.getJob(request.user.salonId!, request.params.jobId);
      return { data };
    },
  });

  server.patch('/api/v1/salon/menu-imports/:jobId/items/:itemId', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['AI Menu Import'],
      summary: 'Inline edit or approve/reject an extracted menu item',
      params: ItemParams,
      body: UpdateMenuImportItemSchema,
    },
    handler: async (request) => {
      const updated = await menuImportService.updateItem(
        request.user.salonId!,
        request.params.jobId,
        request.params.itemId,
        request.body,
      );
      return { data: updated };
    },
  });

  server.get('/api/v1/salon/menu-imports/:jobId/diff', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['AI Menu Import'],
      summary: 'Preview diff of approved items against existing salon menu',
      params: JobParams,
    },
    handler: async (request) => {
      const diff = await menuImportService.getPublishDiff(
        request.user.salonId!,
        request.params.jobId,
      );
      return { data: diff };
    },
  });

  server.post('/api/v1/salon/menu-imports/:jobId/publish', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['AI Menu Import'],
      summary: 'Snapshot current menu and publish approved items',
      params: JobParams,
    },
    handler: async (request) => {
      const result = await menuImportService.publishJob(
        request.user.salonId!,
        request.params.jobId,
        request.user.sub,
      );
      return { data: result };
    },
  });

  server.get('/api/v1/salon/menu-versions', {
    preHandler: ownerOrManager,
    schema: { tags: ['AI Menu Import'], summary: 'List menu version snapshots' },
    handler: async (request) => {
      const versions = await menuImportService.listVersions(request.user.salonId!);
      return { data: versions };
    },
  });

  server.post('/api/v1/salon/menu-versions/:version/rollback', {
    preHandler: ownerOrManager,
    schema: {
      tags: ['AI Menu Import'],
      summary: 'One-click rollback to a previous menu version snapshot',
      params: VersionParams,
    },
    handler: async (request) => {
      const result = await menuImportService.rollbackVersion(
        request.user.salonId!,
        request.params.version,
        request.user.sub,
      );
      return { data: result };
    },
  });
}

