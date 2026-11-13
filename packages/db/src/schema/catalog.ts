import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { salons, staff } from './salons.js';
import { users } from './auth.js';

export const serviceCategories = pgTable(
  'service_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id').references(() => salons.id, { onDelete: 'cascade' }), // null = global taxonomy
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_service_categories_salon').on(t.salonId)],
);

export const services = pgTable(
  'services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => serviceCategories.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 180 }).notNull(),
    description: text('description'),
    pricePaise: integer('price_paise').notNull(),
    compareAtPricePaise: integer('compare_at_price_paise'),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    durationMinutes: integer('duration_minutes').notNull(),
    genderTag: varchar('gender_tag', { length: 20 }).notNull().default('unisex'), // men|women|unisex
    isCombo: boolean('is_combo').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_services_salon_active').on(t.salonId, t.isActive)],
);

export const serviceVariants = pgTable(
  'service_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    pricePaise: integer('price_paise').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    isAddon: boolean('is_addon').notNull().default(false),
  },
  (t) => [index('idx_service_variants_service').on(t.serviceId)],
);

export const staffServices = pgTable(
  'staff_services',
  {
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.serviceId] })],
);

export const menuImportJobs = pgTable(
  'menu_import_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sourceType: varchar('source_type', { length: 20 }).notNull(), // image|pdf|csv|xlsx|docx|text
    fileKey: text('file_key').notNull(),
    status: varchar('status', { length: 30 }).notNull().default('queued'), // queued|processing|review_ready|published|failed
    rawOutput: jsonb('raw_output'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    costPaise: integer('cost_paise').notNull().default(0),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_menu_import_jobs_salon').on(t.salonId, t.createdAt)],
);

export const menuImportItems = pgTable(
  'menu_import_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => menuImportJobs.id, { onDelete: 'cascade' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    categoryName: varchar('category_name', { length: 120 }).notNull(),
    serviceName: varchar('service_name', { length: 180 }).notNull(),
    description: text('description'),
    pricePaise: integer('price_paise'),
    maxPricePaise: integer('max_price_paise'), // for price ranges like "500-800"
    isStartingFrom: boolean('is_starting_from').notNull().default(false),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    genderTag: varchar('gender_tag', { length: 20 }).notNull().default('unisex'),
    confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull().default('1.00'),
    reviewStatus: varchar('review_status', { length: 20 }).notNull().default('pending'), // pending|approved|rejected
    flags: jsonb('flags').$type<string[]>().notNull().default([]),
  },
  (t) => [index('idx_menu_import_items_job').on(t.jobId)],
);

export const menuVersions = pgTable(
  'menu_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    importJobId: uuid('import_job_id').references(() => menuImportJobs.id, {
      onDelete: 'set null',
    }),
    snapshot: jsonb('snapshot').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_menu_versions_salon').on(t.salonId, t.versionNumber)],
);

