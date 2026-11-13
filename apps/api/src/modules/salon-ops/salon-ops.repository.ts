import {
  and,
  asc,
  desc,
  eq,
  gte,
  lte,
  inArray,
  sql,
  bookings,
  bookingItems,
  services,
  staff,
  users,
  reviews,
  notifications,
  type Database,
} from '@salonbridge/db';
import type { SalonBookingListQuery } from '@salonbridge/types';

export class SalonOpsRepository {
  constructor(private readonly db: Database) {}

  async listBookings(salonId: string, query: SalonBookingListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(bookings.salonId, salonId)];

    if (query.status) {
      conditions.push(eq(bookings.status, query.status));
    }

    if (query.date) {
      const startOfDay = new Date(`${query.date}T00:00:00.000Z`);
      const endOfDay = new Date(`${query.date}T23:59:59.999Z`);
      conditions.push(sql`${bookings.startAt} >= ${startOfDay} AND ${bookings.startAt} <= ${endOfDay}`);
    }

    const rows = await this.db
      .select({
        booking: bookings,
        customerName: users.fullName,
        customerPhone: users.phone,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(bookings.startAt))
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) return { items: [], total: 0, page, limit };

    const bookingIds = rows.map((r) => r.booking.id);
    const items = await this.db
      .select()
      .from(bookingItems)
      .where(inArray(bookingItems.bookingId, bookingIds));

    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(...conditions));

    return {
      items: rows.map((r) => ({
        ...r.booking,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        items: items.filter((i) => i.bookingId === r.booking.id),
      })),
      total: countRow?.total ?? 0,
      page,
      limit,
    };
  }

  async getBookingById(salonId: string, bookingId: string) {
    const [row] = await this.db
      .select({
        booking: bookings,
        customerName: users.fullName,
        customerPhone: users.phone,
        customerEmail: users.email,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(and(eq(bookings.id, bookingId), eq(bookings.salonId, salonId)))
      .limit(1);

    if (!row) return null;

    const items = await this.db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    return { ...row.booking, customer: { name: row.customerName, phone: row.customerPhone, email: row.customerEmail }, items };
  }

  async updateBookingStatus(
    salonId: string,
    bookingId: string,
    status: string,
    cancellationReason?: string,
  ) {
    const [updated] = await this.db
      .update(bookings)
      .set({
        status,
        cancellationReason: cancellationReason ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, bookingId), eq(bookings.salonId, salonId)))
      .returning();
    return updated ?? null;
  }

  // CRM-lite: Customers who have visited this salon
  async listSalonCustomers(salonId: string) {
    return this.db
      .select({
        customerId: users.id,
        fullName: users.fullName,
        phone: users.phone,
        totalVisits: sql<number>`count(${bookings.id})::int`,
        totalSpentPaise: sql<number>`coalesce(sum(${bookings.totalAmountPaise}), 0)::int`,
        lastVisit: sql<string>`max(${bookings.startAt})::text`,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.customerId, users.id))
      .where(and(eq(bookings.salonId, salonId), inArray(bookings.status, ['completed', 'confirmed'])))
      .groupBy(users.id, users.fullName, users.phone)
      .orderBy(desc(sql`count(${bookings.id})`));
  }

  // Analytics for a date range
  async getAnalytics(salonId: string, startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const [summary] = await this.db
      .select({
        totalRevenuePaise: sql<number>`coalesce(sum(case when ${bookings.status} = 'completed' then ${bookings.totalAmountPaise} else 0 end), 0)::int`,
        completedBookings: sql<number>`coalesce(sum(case when ${bookings.status} = 'completed' then 1 else 0 end), 0)::int`,
        cancelledBookings: sql<number>`coalesce(sum(case when ${bookings.status} = 'cancelled' then 1 else 0 end), 0)::int`,
        noShowBookings: sql<number>`coalesce(sum(case when ${bookings.status} = 'no_show' then 1 else 0 end), 0)::int`,
        totalBookings: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(and(eq(bookings.salonId, salonId), gte(bookings.startAt, start), lte(bookings.startAt, end)));

    const topServices = await this.db
      .select({
        serviceName: bookingItems.serviceNameSnapshot,
        bookingCount: sql<number>`count(*)::int`,
        revenuePaise: sql<number>`sum(${bookingItems.pricePaise})::int`,
      })
      .from(bookingItems)
      .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
      .where(and(eq(bookingItems.salonId, salonId), gte(bookingItems.startAt, start), lte(bookingItems.startAt, end)))
      .groupBy(bookingItems.serviceNameSnapshot)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    return {
      summary: summary ?? {
        totalRevenuePaise: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        noShowBookings: 0,
        totalBookings: 0,
      },
      topServices,
    };
  }

  // Reviews
  async listSalonReviews(salonId: string) {
    return this.db
      .select({
        review: reviews,
        customerName: users.fullName,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.customerId, users.id))
      .where(eq(reviews.salonId, salonId))
      .orderBy(desc(reviews.createdAt));
  }

  async replyToReview(salonId: string, reviewId: string, reply: string) {
    const [updated] = await this.db
      .update(reviews)
      .set({
        salonReply: reply,
        salonRepliedAt: new Date(),
      })
      .where(and(eq(reviews.id, reviewId), eq(reviews.salonId, salonId)))
      .returning();
    return updated ?? null;
  }

  async logNotification(input: {
    userId?: string | null;
    channel: string;
    recipient: string;
    templateKey: string;
    payload: Record<string, unknown>;
    status: string;
    providerMessageId?: string;
  }) {
    const [n] = await this.db.insert(notifications).values(input).returning();
    return n!;
  }
}
