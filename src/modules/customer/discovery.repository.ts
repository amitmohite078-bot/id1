import {
  and,
  desc,
  eq,
  gte,
  gt,
  inArray,
  sql,
  salons,
  salonPhotos,
  salonHours,
  services,
  staff,
  bookings,
  bookingItems,
  slotHolds,
  payments,
  reviews,
  favorites,
  type Database,
} from '@salonbridge/db';
import type { SalonSearchQuery } from '@salonbridge/types';

export class DiscoveryRepository {
  constructor(private readonly db: Database) {}

  async searchSalons(query: SalonSearchQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(salons.status, 'approved')];

    if (query.city) {
      conditions.push(eq(salons.city, query.city));
    }
    if (query.genderFocus) {
      conditions.push(eq(salons.genderFocus, query.genderFocus));
    }
    if (query.minRating) {
      conditions.push(gte(salons.avgRating, String(query.minRating)));
    }
    if (query.q) {
      conditions.push(
        sql`(${salons.name} ILIKE ${`%${query.q}%`} OR ${salons.city} ILIKE ${`%${query.q}%`})`,
      );
    }

    const hasGeo = query.lat !== undefined && query.lng !== undefined;
    const radiusMeters = (query.radiusKm ?? 15) * 1000;

    if (hasGeo) {
      conditions.push(
        sql`ST_DWithin(${salons.location}, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography, ${radiusMeters})`,
      );
    }

    const distanceExpr = hasGeo
      ? sql<number>`round(ST_Distance(${salons.location}, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography)::numeric, 0)`
      : sql<number>`0`;

    let orderByClause = desc(salons.avgRating);
    if (query.sortBy === 'distance' && hasGeo) {
      orderByClause = sql`ST_Distance(${salons.location}, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography) ASC`;
    }

    const rows = await this.db
      .select({
        id: salons.id,
        slug: salons.slug,
        name: salons.name,
        description: salons.description,
        genderFocus: salons.genderFocus,
        addressLine1: salons.addressLine1,
        city: salons.city,
        state: salons.state,
        pincode: salons.pincode,
        location: salons.location,
        amenities: salons.amenities,
        avgRating: salons.avgRating,
        reviewCount: salons.reviewCount,
        isFeatured: salons.isFeatured,
        distanceMeters: distanceExpr,
      })
      .from(salons)
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(salons)
      .where(and(...conditions));

    return {
      items: rows,
      total: countRow?.total ?? 0,
      page,
      limit,
    };
  }

  async getSalonDetailBySlug(slug: string) {
    const [salon] = await this.db.select().from(salons).where(eq(salons.slug, slug)).limit(1);
    if (!salon) return null;

    const [photos, hours, serviceList, staffList, reviewList] = await Promise.all([
      this.db.select().from(salonPhotos).where(eq(salonPhotos.salonId, salon.id)),
      this.db.select().from(salonHours).where(eq(salonHours.salonId, salon.id)),
      this.db
        .select()
        .from(services)
        .where(and(eq(services.salonId, salon.id), eq(services.isActive, true))),
      this.db
        .select()
        .from(staff)
        .where(and(eq(staff.salonId, salon.id), eq(staff.isActive, true))),
      this.db
        .select()
        .from(reviews)
        .where(and(eq(reviews.salonId, salon.id), eq(reviews.isHidden, false)))
        .orderBy(desc(reviews.createdAt))
        .limit(10),
    ]);

    return {
      salon,
      photos,
      hours,
      services: serviceList,
      staff: staffList,
      reviews: reviewList,
    };
  }

  async compareSalons(salonIds: string[]) {
    const salonRows = await this.db
      .select()
      .from(salons)
      .where(and(inArray(salons.id, salonIds), eq(salons.status, 'approved')));

    const servicesBySalon = await this.db
      .select()
      .from(services)
      .where(and(inArray(services.salonId, salonIds), eq(services.isActive, true)));

    return salonRows.map((s) => ({
      ...s,
      services: servicesBySalon.filter((svc) => svc.salonId === s.id),
    }));
  }
}

