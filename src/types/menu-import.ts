import { z } from 'zod';
import { GenderFocusSchema } from './salon.js';

export const MenuSourceTypeSchema = z.enum(['image', 'pdf', 'csv', 'xlsx', 'docx', 'text']);
export type MenuSourceType = z.infer<typeof MenuSourceTypeSchema>;

export const PresignedUploadRequestSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024), // 10MB max
});

export const CreateMenuImportSchema = z.object({
  sourceType: MenuSourceTypeSchema,
  fileKey: z.string().min(1).max(500).optional(),
  rawText: z.string().min(5).max(50_000).optional(),
});

export const ExtractedMenuItemSchema = z.object({
  categoryName: z.string().min(1).max(120).default('General'),
  serviceName: z.string().min(1).max(180),
  description: z.string().max(1000).nullable().optional(),
  pricePaise: z.number().int().min(100).max(10_000_000).nullable(),
  maxPricePaise: z.number().int().min(100).max(10_000_000).nullable().optional(),
  isStartingFrom: z.boolean().default(false),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  genderTag: GenderFocusSchema.default('unisex'),
  confidence: z.number().min(0).max(1).default(1),
  flags: z.array(z.string()).default([]),
});

export type ExtractedMenuItem = z.infer<typeof ExtractedMenuItemSchema>;

export const UpdateMenuImportItemSchema = z.object({
  categoryName: z.string().min(1).max(120).optional(),
  serviceName: z.string().min(1).max(180).optional(),
  description: z.string().max(1000).nullable().optional(),
  pricePaise: z.number().int().min(100).max(10_000_000).nullable().optional(),
  maxPricePaise: z.number().int().min(100).max(10_000_000).nullable().optional(),
  isStartingFrom: z.boolean().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  genderTag: GenderFocusSchema.optional(),
  reviewStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export type UpdateMenuImportItemInput = z.infer<typeof UpdateMenuImportItemSchema>;

