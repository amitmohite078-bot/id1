import {
  and,
  desc,
  eq,
  gte,
  sql,
  salons,
  users,
  bookings,
  reviews,
  plans,
  coupons,
  menuImportJobs,
  auditLogs,
  type Database,
} from '@salonbridge/db';
import type { AdminSalonListQuery } from '@salonbridge/types';

export class AdminRepository {
  constructor(private readonly db: Database) {}

  async listSalons(query: AdminSalonListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.status) conditions.push(eq(salons.status, query.status));
    if (query.city) conditions.push(eq(salons.city, query.city));
    if (query.q) {
      conditions.push(
        sql`(${salons.name} ILIKE ${`%${query.q}%`} OR ${salons.phone} ILIKE ${`%${query.q}%`})`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await this.db
      .select({
        salon: salons,
        ownerName: users.fullName,
        ownerPhone: users.phone,
        ownerEmail: users.email,
      })
      .from(salons)
      .innerJoin(users, eq(salons.ownerId, users.id))
      .where(whereClause)
      .orderBy(desc(salons.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(salons)
      .where(whereClause);

    return {
      items: items.map((i) => ({ ...i.salon, owner: { name: i.ownerName, phone: i.ownerPhone, email: i.ownerEmail } })),
      total: countRow?.total ?? 0,
      page,
      limit,
    };
  }

  async updateSalonStatus(
    salonId: string,
    status: string,
    commissionRateBps?: number,
  ) {
    const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
    if (commissionRateBps !== undefined) {
      updateData.commissionRateBps = commissionRateBps;
    }
    const [updated] = await this.db
      .update(salons)
      .set(updateData)
      .where(eq(salons.id, salonId))
      .returning();
    return updated ?? null;
  }

  async updateUserStatus(userId: string, status: string) {
    const [updated] = await this.db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated ?? null;
  }

  async listUsers(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const items = await this.db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    const [count] = await this.db.select({ total: sql<number>`count(*)::int` }).from(users);
    return { items, total: count?.total ?? 0, page, limit };
  }

  async getPlatformMetrics() {
    const [salonStats] = await this.db
      .select({
        totalSalons: sql<number>`count(*)::int`,
        approvedSalons: sql<number>`coalesce(sum(case when ${salons.status} = 'approved' then 1 else 0 end), 0)::int`,
        pendingSalons: sql<number>`coalesce(sum(case when ${salons.status} = 'pending' then 1 else 0 end), 0)::int`,
      })
      .from(salons);

    const [userCount] = await this.db.select({ totalUsers: sql<number>`count(*)::int` }).from(users);

    const [bookingStats] = await this.db
      .select({
        totalGmvPaise: sql<number>`coalesce(sum(case when ${bookings.status} = 'completed' then ${bookings.totalAmountPaise} else 0 end), 0)::int`,
        totalCommissionPaise: sql<number>`coalesce(sum(case when ${bookings.status} = 'completed' then ${bookings.commissionPaise} else 0 end), 0)::int`,
        completedBookings: sql<number>`coalesce(sum(case when ${bookings.status} = 'completed' then 1 else 0 end), 0)::int`,
        totalBookings: sql<number>`count(*)::int`,
      })
      .from(bookings);

    const [aiStats] = await this.db
      .select({
        totalImportJobs: sql<number>`count(*)::int`,
        successfulImports: sql<number>`coalesce(sum(case when ${menuImportJobs.status} in ('review_ready', 'published') then 1 else 0 end), 0)::int`,
        totalCostPaise: sql<number>`coalesce(sum(${menuImportJobs.costPaise}), 0)::int`,
        totalTokens: sql<number>`coalesce(sum(${menuImportJobs.inputTokens} + ${menuImportJobs.outputTokens}), 0)::int`,
      })
      .from(menuImportJobs);

    const topCities = await this.db
      .select({
        city: salons.city,
        salonCount: sql<number>`count(*)::int`,
      })
      .from(salons)
      .where(eq(salons.status, 'approved'))
      .groupBy(salons.city)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    return {
      salons: salonStats,
      users: userCount?.totalUsers ?? 0,
      bookings: bookingStats,
      aiImports: aiStats,
      topCities,
    };
  }

  // Plans & Coupons
  async listPlans() {
    return this.db.select().from(plans).orderBy(plans.monthlyPricePaise);
  }

  async createPlan(input: {
    code: string;
    name: string;
    monthlyPricePaise: number;
    aiImportsPerMonth: number;
    maxStaff: number;
    commissionRateBps: number;
    features: Record<string, boolean>;
  }) {
    const [p] = await this.db.insert(plans).values(input).returning();
    return p!;
  }

  async listCoupons() {
    return this.db.select().from(coupons).orderBy(desc(coupons.validFrom));
  }

  async createCoupon(input: {
    code: string;
    discountType: string;
    discountValue: number;
    maxDiscountPaise?: number | null;
    minOrderPaise: number;
    usageLimit?: number | null;
    validFrom: Date;
    validUntil: Date;
    salonId?: string | null;
  }) {
    const [c] = await this.db.insert(coupons).values(input).returning();
    return c!;
  }

  // Moderation & Audit Logs
  async listReportedReviews() {
    return this.db
      .select({
        review: reviews,
        salonName: salons.name,
      })
      .from(reviews)
      .innerJoin(salons, eq(reviews.salonId, salons.id))
      .where(eq(reviews.isReported, true))
      .orderBy(desc(reviews.createdAt));
  }

  async setReviewVisibility(reviewId: string, isHidden: boolean) {
    const [updated] = await this.db
      .update(reviews)
      .set({ isHidden })
      .where(eq(reviews.id, reviewId))
      .returning();
    return updated ?? null;
  }

  async logAudit(input: {
    actorUserId: string;
    impersonatedSalonId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    ipAddress?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await this.db.insert(auditLogs).values({
      actorUserId: input.actorUserId,
      impersonatedSalonId: input.impersonatedSalonId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      ipAddress: input.ipAddress ?? null,
      metadata: input.metadata ?? {},
    });
  }

  async listAuditLogs(limit = 50) {
    return this.db
      .select({
        log: auditLogs,
        actorEmail: users.email,
        actorName: users.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

