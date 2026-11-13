import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  smallint,
  boolean,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { salons, staff } from './salons.js';
import { services, serviceVariants } from './catalog.js';

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingCode: varchar('booking_code', { length: 24 }).notNull().unique(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 30 }).notNull().default('pending_payment'),
    paymentMode: varchar('payment_mode', { length: 20 }).notNull().default('online'), // online|pay_at_salon
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    subtotalPaise: integer('subtotal_paise').notNull(),
    discountPaise: integer('discount_paise').notNull().default(0),
    taxPaise: integer('tax_paise').notNull().default(0),
    totalAmountPaise: integer('total_amount_paise').notNull(),
    commissionPaise: integer('commission_paise').notNull().default(0),
    couponCode: varchar('coupon_code', { length: 40 }),
    customerNotes: text('customer_notes'),
    cancellationReason: text('cancellation_reason'),
    cancelledBy: uuid('cancelled_by').references(() => users.id, { onDelete: 'set null' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    isWalkIn: boolean('is_walk_in').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_bookings_salon_start').on(t.salonId, t.startAt, t.status),
    index('idx_bookings_customer').on(t.customerId, t.createdAt),
  ],
);

export const bookingItems = pgTable(
  'booking_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    variantId: uuid('variant_id').references(() => serviceVariants.id, { onDelete: 'set null' }),
    staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'set null' }),
    serviceNameSnapshot: varchar('service_name_snapshot', { length: 180 }).notNull(),
    pricePaise: integer('price_paise').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('idx_booking_items_booking').on(t.bookingId),
    index('idx_booking_items_staff_time').on(t.salonId, t.staffId, t.startAt, t.endAt),
  ],
);

export const slotHolds = pgTable(
  'slot_holds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_slot_holds_lookup').on(t.salonId, t.staffId, t.startAt, t.endAt),
    index('idx_slot_holds_expires').on(t.expiresAt),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    provider: varchar('provider', { length: 30 }).notNull().default('razorpay'),
    providerOrderId: varchar('provider_order_id', { length: 120 }),
    providerPaymentId: varchar('provider_payment_id', { length: 120 }).unique(),
    providerTransferId: varchar('provider_transfer_id', { length: 120 }),
    amountPaise: integer('amount_paise').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    status: varchar('status', { length: 30 }).notNull().default('created'), // created|authorized|captured|failed|refunded
    rawPayload: jsonb('raw_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_payments_booking').on(t.bookingId)],
);

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    providerRefundId: varchar('provider_refund_id', { length: 120 }).unique(),
    amountPaise: integer('amount_paise').notNull(),
    reason: text('reason'),
    status: varchar('status', { length: 30 }).notNull().default('pending'), // pending|processed|failed
    initiatedBy: uuid('initiated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_refunds_booking').on(t.bookingId)],
);

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    providerTransferId: varchar('provider_transfer_id', { length: 120 }).unique(),
    amountPaise: integer('amount_paise').notNull(),
    status: varchar('status', { length: 30 }).notNull().default('pending'), // pending|settled|failed|on_hold
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_payouts_salon').on(t.salonId, t.createdAt)],
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(), // 1-5
    comment: text('comment'),
    salonReply: text('salon_reply'),
    salonRepliedAt: timestamp('salon_replied_at', { withTimezone: true }),
    isReported: boolean('is_reported').notNull().default(false),
    isHidden: boolean('is_hidden').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_reviews_salon').on(t.salonId, t.isHidden, t.createdAt)],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.salonId] })],
);

