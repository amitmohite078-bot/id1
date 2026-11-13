import {
  and,
  desc,
  eq,
  gt,
  inArray,
  sql,
  bookings,
  bookingItems,
  slotHolds,
  payments,
  refunds,
  reviews,
  favorites,
  services,
  salons,
  type Database,
} from '@salonbridge/db';

export class BookingRepository {
  constructor(private readonly db: Database) {}

  /**
   * Acquire transactional Postgres advisory lock keyed by (staffId/salonId + date)
   * to guarantee zero double-booking races across concurrent requests.
   */
  async acquireAdvisoryLock(tx: Database, lockKeyString: string) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKeyString}))`);
  }

  async createSlotHold(input: {
    salonId: string;
    staffId?: string | null;
    customerId: string;
    startAt: Date;
    endAt: Date;
    expiresAt: Date;
  }) {
    const [hold] = await this.db
      .insert(slotHolds)
      .values({
        salonId: input.salonId,
        staffId: input.staffId ?? null,
        customerId: input.customerId,
        startAt: input.startAt,
        endAt: input.endAt,
        expiresAt: input.expiresAt,
      })
      .returning();
    return hold!;
  }

  async findActiveHold(holdId: string, customerId: string) {
    const [hold] = await this.db
      .select()
      .from(slotHolds)
      .where(
        and(
          eq(slotHolds.id, holdId),
          eq(slotHolds.customerId, customerId),
          gt(slotHolds.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return hold ?? null;
  }

  async deleteSlotHold(holdId: string) {
    await this.db.delete(slotHolds).where(eq(slotHolds.id, holdId));
  }

  async checkConflicts(
    tx: Database,
    salonId: string,
    staffId: string | null | undefined,
    startAt: Date,
    endAt: Date,
    excludeCustomerId?: string,
  ): Promise<boolean> {
    // Check overlapping confirmed/in_progress bookings
    const overlappingBookings = await tx
      .select({ id: bookingItems.id })
      .from(bookingItems)
      .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
      .where(
        and(
          eq(bookingItems.salonId, salonId),
          staffId ? eq(bookingItems.staffId, staffId) : sql`true`,
          inArray(bookings.status, ['confirmed', 'in_progress', 'pending_payment']),
          sql`${bookingItems.startAt} < ${endAt} AND ${bookingItems.endAt} > ${startAt}`,
        ),
      )
      .limit(1);

    if (overlappingBookings.length > 0) return true;

    // Check active slot holds belonging to OTHER customers
    const overlappingHolds = await tx
      .select({ id: slotHolds.id })
      .from(slotHolds)
      .where(
        and(
          eq(slotHolds.salonId, salonId),
          staffId ? eq(slotHolds.staffId, staffId) : sql`true`,
          excludeCustomerId ? sql`${slotHolds.customerId} != ${excludeCustomerId}` : sql`true`,
          gt(slotHolds.expiresAt, new Date()),
          sql`${slotHolds.startAt} < ${endAt} AND ${slotHolds.endAt} > ${startAt}`,
        ),
      )
      .limit(1);

    return overlappingHolds.length > 0;
  }

  async createBookingWithItems(input: {
    bookingCode: string;
    customerId: string;
    salonId: string;
    status: string;
    paymentMode: string;
    startAt: Date;
    endAt: Date;
    subtotalPaise: number;
    discountPaise: number;
    totalAmountPaise: number;
    commissionPaise: number;
    couponCode?: string;
    customerNotes?: string;
    items: Array<{
      serviceId: string;
      staffId?: string | null;
      serviceNameSnapshot: string;
      pricePaise: number;
      durationMinutes: number;
      startAt: Date;
      endAt: Date;
    }>;
  }) {
    return this.db.transaction(async (tx) => {
      const lockKey = `${input.salonId}-${input.items[0]?.staffId ?? 'any'}-${input.startAt.toISOString().slice(0, 10)}`;
      await this.acquireAdvisoryLock(tx as unknown as Database, lockKey);

      const hasConflict = await this.checkConflicts(
        tx as unknown as Database,
        input.salonId,
        input.items[0]?.staffId,
        input.startAt,
        input.endAt,
        input.customerId,
      );

      if (hasConflict) {
        return null;
      }

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingCode: input.bookingCode,
          customerId: input.customerId,
          salonId: input.salonId,
          status: input.status,
          paymentMode: input.paymentMode,
          startAt: input.startAt,
          endAt: input.endAt,
          subtotalPaise: input.subtotalPaise,
          discountPaise: input.discountPaise,
          totalAmountPaise: input.totalAmountPaise,
          commissionPaise: input.commissionPaise,
          couponCode: input.couponCode ?? null,
          customerNotes: input.customerNotes ?? null,
        })
        .returning();

      await tx.insert(bookingItems).values(
        input.items.map((item) => ({
          bookingId: booking!.id,
          salonId: input.salonId,
          serviceId: item.serviceId,
          staffId: item.staffId ?? null,
          serviceNameSnapshot: item.serviceNameSnapshot,
          pricePaise: item.pricePaise,
          durationMinutes: item.durationMinutes,
          startAt: item.startAt,
          endAt: item.endAt,
        })),
      );

      return booking!;
    });
  }

  async listCustomerBookings(customerId: string) {
    const list = await this.db
      .select({
        booking: bookings,
        salonName: salons.name,
        salonCity: salons.city,
      })
      .from(bookings)
      .innerJoin(salons, eq(bookings.salonId, salons.id))
      .where(eq(bookings.customerId, customerId))
      .orderBy(desc(bookings.startAt));

    if (list.length === 0) return [];
    const bookingIds = list.map((b) => b.booking.id);

    const items = await this.db
      .select()
      .from(bookingItems)
      .where(inArray(bookingItems.bookingId, bookingIds));

    return list.map((b) => ({
      ...b.booking,
      salonName: b.salonName,
      salonCity: b.salonCity,
      items: items.filter((i) => i.bookingId === b.booking.id),
    }));
  }

  async getCustomerBookingById(customerId: string, bookingId: string) {
    const [row] = await this.db
      .select({
        booking: bookings,
        salon: salons,
      })
      .from(bookings)
      .innerJoin(salons, eq(bookings.salonId, salons.id))
      .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, customerId)))
      .limit(1);

    if (!row) return null;

    const items = await this.db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    return { ...row.booking, salon: row.salon, items };
  }

  async updateBookingStatus(
    bookingId: string,
    status: string,
    extra: { cancellationReason?: string; cancelledBy?: string; cancelledAt?: Date } = {},
  ) {
    const [updated] = await this.db
      .update(bookings)
      .set({ status, ...extra, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();
    return updated ?? null;
  }

  async recordPayment(input: {
    bookingId: string;
    salonId: string;
    provider: string;
    providerOrderId?: string;
    providerPaymentId?: string;
    amountPaise: number;
    status: string;
  }) {
    const [p] = await this.db.insert(payments).values(input).returning();
    return p!;
  }

  async recordRefund(input: {
    paymentId: string;
    bookingId: string;
    providerRefundId: string;
    amountPaise: number;
    reason?: string;
    status: string;
    initiatedBy?: string;
  }) {
    const [r] = await this.db.insert(refunds).values(input).returning();
    return r!;
  }

  async createReview(input: {
    bookingId: string;
    salonId: string;
    customerId: string;
    rating: number;
    comment?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [review] = await tx.insert(reviews).values(input).returning();

      // Recalculate salon avg_rating
      const [stats] = await tx
        .select({
          avg: sql<string>`coalesce(avg(${reviews.rating}), 0)::numeric(3, 2)`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(and(eq(reviews.salonId, input.salonId), eq(reviews.isHidden, false)));

      await tx
        .update(salons)
        .set({
          avgRating: stats?.avg ?? '0.00',
          reviewCount: stats?.count ?? 0,
        })
        .where(eq(salons.id, input.salonId));

      return review!;
    });
  }

  async toggleFavorite(userId: string, salonId: string) {
    const [existing] = await this.db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.salonId, salonId)))
      .limit(1);

    if (existing) {
      await this.db
        .delete(favorites)
        .where(and(eq(favorites.userId, userId), eq(favorites.salonId, salonId)));
      return { favorited: false };
    }

    await this.db.insert(favorites).values({ userId, salonId });
    return { favorited: true };
  }
}

