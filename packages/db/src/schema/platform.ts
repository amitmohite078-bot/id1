import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { salons } from './salons.js';

export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(), // free | basic | pro
  name: varchar('name', { length: 80 }).notNull(),
  monthlyPricePaise: integer('monthly_price_paise').notNull(),
  aiImportsPerMonth: integer('ai_imports_per_month').notNull(),
  maxStaff: integer('max_staff').notNull(),
  commissionRateBps: integer('commission_rate_bps').notNull(),
  features: jsonb('features').$type<Record<string, boolean>>().notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 30 }).notNull().default('active'), // active|past_due|cancelled
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    providerSubscriptionId: varchar('provider_subscription_id', { length: 120 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_subscriptions_salon').on(t.salonId, t.status)],
);

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id').references(() => salons.id, { onDelete: 'cascade' }), // null = platform-wide
    code: varchar('code', { length: 40 }).notNull().unique(),
    discountType: varchar('discount_type', { length: 20 }).notNull(), // percent|flat
    discountValue: integer('discount_value').notNull(),
    maxDiscountPaise: integer('max_discount_paise'),
    minOrderPaise: integer('min_order_paise').notNull().default(0),
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').notNull().default(0),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [index('idx_coupons_code').on(t.code)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 20 }).notNull(), // whatsapp|email|sms|push
    recipient: varchar('recipient', { length: 255 }).notNull(),
    templateKey: varchar('template_key', { length: 80 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: varchar('status', { length: 20 }).notNull().default('queued'), // queued|sent|failed
    providerMessageId: varchar('provider_message_id', { length: 120 }),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_notifications_user').on(t.userId, t.createdAt)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    impersonatedSalonId: uuid('impersonated_salon_id').references(() => salons.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 60 }).notNull(),
    resourceId: varchar('resource_id', { length: 100 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_audit_logs_actor').on(t.actorUserId, t.createdAt),
    index('idx_audit_logs_resource').on(t.resourceType, t.resourceId),
  ],
);

export const featureFlags = pgTable('feature_flags', {
  key: varchar('key', { length: 100 }).primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  description: text('description'),
  rules: jsonb('rules').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const platformConfigs = pgTable('platform_configs', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

