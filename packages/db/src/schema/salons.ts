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
  smallint,
  time,
  date,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { geographyPoint } from './custom-types.js';
import { users } from './auth.js';

export const salons = pgTable(
  'salons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    slug: varchar('slug', { length: 160 }).notNull().unique(),
    name: varchar('name', { length: 180 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending|approved|rejected|suspended
    genderFocus: varchar('gender_focus', { length: 20 }).notNull().default('unisex'), // men|women|unisex
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 255 }),
    addressLine1: varchar('address_line1', { length: 255 }).notNull(),
    addressLine2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 100 }).notNull(),
    state: varchar('state', { length: 100 }).notNull(),
    pincode: varchar('pincode', { length: 16 }).notNull(),
    countryCode: varchar('country_code', { length: 2 }).notNull().default('IN'),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Kolkata'),
    location: geographyPoint('location').notNull(),
    gstin: varchar('gstin', { length: 20 }),
    licenseDocKey: text('license_doc_key'),
    razorpayAccountId: varchar('razorpay_account_id', { length: 100 }),
    razorpayKycStatus: varchar('razorpay_kyc_status', { length: 30 }).notNull().default('pending'),
    manualBookingApproval: boolean('manual_booking_approval').notNull().default(false),
    slotIntervalMinutes: integer('slot_interval_minutes').notNull().default(15),
    bufferMinutes: integer('buffer_minutes').notNull().default(0),
    maxConcurrentBookings: integer('max_concurrent_bookings').notNull().default(4),
    amenities: jsonb('amenities').$type<string[]>().notNull().default([]),
    avgRating: numeric('avg_rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
    reviewCount: integer('review_count').notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    commissionRateBps: integer('commission_rate_bps'), // null = use platform default
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('idx_salons_owner').on(t.ownerId), // 1 owner = 1 salon initially
    index('idx_salons_status_city').on(t.status, t.city),
  ],
);

export const salonMembers = pgTable(
  'salon_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 30 }).notNull(), // salon_owner|salon_manager|salon_receptionist|salon_stylist
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('idx_salon_members_salon_user').on(t.salonId, t.userId),
    index('idx_salon_members_user').on(t.userId),
  ],
);

export const salonPhotos = pgTable(
  'salon_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    fileKey: text('file_key').notNull(),
    caption: varchar('caption', { length: 200 }),
    isCover: boolean('is_cover').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_salon_photos_salon').on(t.salonId)],
);

export const salonHours = pgTable(
  'salon_hours',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(), // 0 (Sun) - 6 (Sat)
    openTime: time('open_time'),
    closeTime: time('close_time'),
    isClosed: boolean('is_closed').notNull().default(false),
  },
  (t) => [uniqueIndex('idx_salon_hours_day').on(t.salonId, t.dayOfWeek)],
);

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    title: varchar('title', { length: 100 }),
    bio: text('bio'),
    avatarKey: text('avatar_key'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_staff_salon').on(t.salonId, t.isActive)],
);

export const staffSchedules = pgTable(
  'staff_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    breakStart: time('break_start'),
    breakEnd: time('break_end'),
    isOff: boolean('is_off').notNull().default(false),
  },
  (t) => [uniqueIndex('idx_staff_schedules_day').on(t.staffId, t.dayOfWeek)],
);

export const staffLeaves = pgTable(
  'staff_leaves',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    leaveDate: date('leave_date').notNull(),
    startTime: time('start_time'), // null = full day
    endTime: time('end_time'),
    reason: varchar('reason', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_staff_leaves_staff_date').on(t.staffId, t.leaveDate)],
);

// Exported here for FK reference in catalog.ts; staffServices is defined in catalog.ts to avoid circular imports
export const staffServicesPlaceholder = primaryKey;

