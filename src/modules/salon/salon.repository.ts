import {
  and,
  asc,
  eq,
  gt,
  inArray,
  sql,
  salons,
  salonMembers,
  salonHours,
  staff,
  staffServices,
  staffSchedules,
  staffLeaves,
  serviceCategories,
  services,
  bookings,
  bookingItems,
  slotHolds,
  type Database,
} from '@salonbridge/db';
import { RoleName, type OnboardSalonInput, type UpdateSalonProfileInput } from '@salonbridge/types';

export class SalonRepository {
  constructor(private readonly db: Database) {}

  async findSalonByOwner(ownerId: string) {
    const [row] = await this.db
      .select()
      .from(salons)
      .where(eq(salons.ownerId, ownerId))
      .limit(1);
    return row ?? null;
  }

  async findSalonById(salonId: string) {
    const [row] = await this.db
      .select()
      .from(salons)
      .where(eq(salons.id, salonId))
      .limit(1);
    return row ?? null;
  }

  async findSalonBySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(salons)
      .where(eq(salons.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async createSalonOnboarding(
    ownerId: string,
    slug: string,
    input: OnboardSalonInput,
  ) {
    return this.db.transaction(async (tx) => {
      const [salon] = await tx
        .insert(salons)
        .values({
          ownerId,
          slug,
          name: input.name,
          description: input.description ?? null,
          status: 'pending',
          genderFocus: input.genderFocus,
          phone: input.phone,
          email: input.email ?? null,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          location: { lat: input.lat, lng: input.lng },
          gstin: input.gstin ?? null,
          licenseDocKey: input.licenseDocKey ?? null,
          amenities: input.amenities,
        })
        .returning();

      await tx.insert(salonMembers).values({
        salonId: salon!.id,
        userId: ownerId,
        role: RoleName.SALON_OWNER,
        isActive: true,
      });

      const defaultHours =
        input.hours ??
        Array.from({ length: 7 }, (_, day) => ({
          dayOfWeek: day,
          openTime: day === 0 ? null : '10:00',
          closeTime: day === 0 ? null : '20:00',
          isClosed: day === 0,
        }));

      await tx.insert(salonHours).values(
        defaultHours.map((h) => ({
          salonId: salon!.id,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed,
        })),
      );

      return salon!;
    });
  }

  async updateSalonProfile(salonId: string, input: UpdateSalonProfileInput) {
    const { lat, lng, ...rest } = input;
    const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (lat !== undefined && lng !== undefined) {
      updateData.location = { lat, lng };
    }
    const [updated] = await this.db
      .update(salons)
      .set(updateData)
      .where(eq(salons.id, salonId))
      .returning();
    return updated ?? null;
  }

  async getSalonHours(salonId: string) {
    return this.db
      .select()
      .from(salonHours)
      .where(eq(salonHours.salonId, salonId))
      .orderBy(asc(salonHours.dayOfWeek));
  }

  async upsertSalonHours(
    salonId: string,
    hours: Array<{
      dayOfWeek: number;
      openTime: string | null;
      closeTime: string | null;
      isClosed: boolean;
    }>,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.delete(salonHours).where(eq(salonHours.salonId, salonId));
      return tx
        .insert(salonHours)
        .values(hours.map((h) => ({ ...h, salonId })))
        .returning();
    });
  }

  // Staff
  async listStaff(salonId: string) {
    const staffRows = await this.db
      .select()
      .from(staff)
      .where(eq(staff.salonId, salonId))
      .orderBy(asc(staff.displayName));

    if (staffRows.length === 0) return [];

    const staffIds = staffRows.map((s) => s.id);
    const skills = await this.db
      .select()
      .from(staffServices)
      .where(inArray(staffServices.staffId, staffIds));

    return staffRows.map((s) => ({
      ...s,
      serviceIds: skills.filter((k) => k.staffId === s.id).map((k) => k.serviceId),
    }));
  }

  async createStaff(
    salonId: string,
    input: { displayName: string; title?: string; bio?: string; serviceIds: string[] },
  ) {
    return this.db.transaction(async (tx) => {
      const [member] = await tx
        .insert(staff)
        .values({
          salonId,
          displayName: input.displayName,
          title: input.title ?? null,
          bio: input.bio ?? null,
        })
        .returning();

      if (input.serviceIds.length > 0) {
        await tx
          .insert(staffServices)
          .values(input.serviceIds.map((serviceId) => ({ staffId: member!.id, serviceId })))
          .onConflictDoNothing();
      }

      // Default Mon-Sat 10:00-20:00 schedule
      const defaultSchedule = Array.from({ length: 7 }, (_, day) => ({
        salonId,
        staffId: member!.id,
        dayOfWeek: day,
        startTime: '10:00',
        endTime: '20:00',
        isOff: day === 0,
      }));
      await tx.insert(staffSchedules).values(defaultSchedule);

      return { ...member!, serviceIds: input.serviceIds };
    });
  }

  async updateStaff(
    salonId: string,
    staffId: string,
    input: {
      displayName?: string;
      title?: string;
      bio?: string;
      isActive?: boolean;
      serviceIds?: string[];
    },
  ) {
    return this.db.transaction(async (tx) => {
      const { serviceIds, ...fields } = input;
      const [updated] = await tx
        .update(staff)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(staff.id, staffId), eq(staff.salonId, salonId)))
        .returning();

      if (!updated) return null;

      if (serviceIds !== undefined) {
        await tx.delete(staffServices).where(eq(staffServices.staffId, staffId));
        if (serviceIds.length > 0) {
          await tx
            .insert(staffServices)
            .values(serviceIds.map((serviceId) => ({ staffId, serviceId })))
            .onConflictDoNothing();
        }
      }
      return updated;
    });
  }

  async upsertStaffSchedule(
    salonId: string,
    staffId: string,
    days: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      breakStart?: string | null;
      breakEnd?: string | null;
      isOff: boolean;
    }>,
  ) {
    return this.db.transaction(async (tx) => {
      for (const d of days) {
        await tx
          .delete(staffSchedules)
          .where(
            and(
              eq(staffSchedules.salonId, salonId),
              eq(staffSchedules.staffId, staffId),
              eq(staffSchedules.dayOfWeek, d.dayOfWeek),
            ),
          );
        await tx.insert(staffSchedules).values({
          salonId,
          staffId,
          dayOfWeek: d.dayOfWeek,
          startTime: d.startTime,
          endTime: d.endTime,
          breakStart: d.breakStart ?? null,
          breakEnd: d.breakEnd ?? null,
          isOff: d.isOff,
        });
      }
      return tx
        .select()
        .from(staffSchedules)
        .where(and(eq(staffSchedules.salonId, salonId), eq(staffSchedules.staffId, staffId)));
    });
  }

  async createStaffLeave(
    salonId: string,
    staffId: string,
    input: { leaveDate: string; startTime?: string | null; endTime?: string | null; reason?: string },
  ) {
    const [leave] = await this.db
      .insert(staffLeaves)
      .values({
        salonId,
        staffId,
        leaveDate: input.leaveDate,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        reason: input.reason ?? null,
      })
      .returning();
    return leave!;
  }

  async deleteStaffLeave(salonId: string, staffId: string, leaveId: string) {
    const [deleted] = await this.db
      .delete(staffLeaves)
      .where(
        and(
          eq(staffLeaves.id, leaveId),
          eq(staffLeaves.salonId, salonId),
          eq(staffLeaves.staffId, staffId),
        ),
      )
      .returning();
    return deleted ?? null;
  }

  // Categories & Services
  async listCategories(salonId: string) {
    return this.db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.salonId, salonId))
      .orderBy(asc(serviceCategories.sortOrder));
  }

  async createCategory(salonId: string, input: { name: string; slug: string; sortOrder: number }) {
    const [cat] = await this.db
      .insert(serviceCategories)
      .values({ salonId, ...input })
      .returning();
    return cat!;
  }

  async listServices(salonId: string) {
    return this.db
      .select()
      .from(services)
      .where(eq(services.salonId, salonId))
      .orderBy(asc(services.sortOrder), asc(services.name));
  }

  async findServicesByIds(salonId: string, serviceIds: string[]) {
    if (serviceIds.length === 0) return [];
    return this.db
      .select()
      .from(services)
      .where(and(eq(services.salonId, salonId), inArray(services.id, serviceIds)));
  }

  async createService(
    salonId: string,
    input: {
      categoryId?: string | null;
      name: string;
      description?: string;
      pricePaise: number;
      compareAtPricePaise?: number | null;
      durationMinutes: number;
      genderTag: string;
      isCombo: boolean;
    },
  ) {
    const [svc] = await this.db
      .insert(services)
      .values({
        salonId,
        categoryId: input.categoryId ?? null,
        name: input.name,
        description: input.description ?? null,
        pricePaise: input.pricePaise,
        compareAtPricePaise: input.compareAtPricePaise ?? null,
        durationMinutes: input.durationMinutes,
        genderTag: input.genderTag,
        isCombo: input.isCombo,
      })
      .returning();
    return svc!;
  }

  async updateService(salonId: string, serviceId: string, input: Record<string, unknown>) {
    const [updated] = await this.db
      .update(services)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(services.id, serviceId), eq(services.salonId, salonId)))
      .returning();
    return updated ?? null;
  }

  async deleteService(salonId: string, serviceId: string) {
    const [deleted] = await this.db
      .delete(services)
      .where(and(eq(services.id, serviceId), eq(services.salonId, salonId)))
      .returning();
    return deleted ?? null;
  }

  async bulkUpdateServicePrices(
    salonId: string,
    updates: Array<{ id: string; pricePaise: number }>,
  ) {
    return this.db.transaction(async (tx) => {
      for (const item of updates) {
        await tx
          .update(services)
          .set({ pricePaise: item.pricePaise, updatedAt: new Date() })
          .where(and(eq(services.id, item.id), eq(services.salonId, salonId)));
      }
      return updates.length;
    });
  }

  // Availability data loader
  async getAvailabilityContext(salonId: string, dateStr: string, dayOfWeek: number) {
    const [salon] = await this.db.select().from(salons).where(eq(salons.id, salonId)).limit(1);
    const [hours] = await this.db
      .select()
      .from(salonHours)
      .where(and(eq(salonHours.salonId, salonId), eq(salonHours.dayOfWeek, dayOfWeek)))
      .limit(1);

    const activeStaff = await this.db
      .select()
      .from(staff)
      .where(and(eq(staff.salonId, salonId), eq(staff.isActive, true)));

    const staffIds = activeStaff.map((s) => s.id);
    const skills =
      staffIds.length > 0
        ? await this.db.select().from(staffServices).where(inArray(staffServices.staffId, staffIds))
        : [];
    const schedules =
      staffIds.length > 0
        ? await this.db
            .select()
            .from(staffSchedules)
            .where(
              and(
                eq(staffSchedules.salonId, salonId),
                eq(staffSchedules.dayOfWeek, dayOfWeek),
                inArray(staffSchedules.staffId, staffIds),
              ),
            )
        : [];
    const leaves =
      staffIds.length > 0
        ? await this.db
            .select()
            .from(staffLeaves)
            .where(
              and(
                eq(staffLeaves.salonId, salonId),
                eq(staffLeaves.leaveDate, dateStr),
                inArray(staffLeaves.staffId, staffIds),
              ),
            )
        : [];

    // Load active bookings & holds overlapping the target date (+/- 1 day UTC buffer for timezone safety)
    const dayStartUtc = new Date(`${dateStr}T00:00:00.000Z`);
    const rangeStart = new Date(dayStartUtc.getTime() - 24 * 60 * 60 * 1000);
    const rangeEnd = new Date(dayStartUtc.getTime() + 48 * 60 * 60 * 1000);

    const activeItems = await this.db
      .select({
        staffId: bookingItems.staffId,
        startAt: bookingItems.startAt,
        endAt: bookingItems.endAt,
      })
      .from(bookingItems)
      .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
      .where(
        and(
          eq(bookingItems.salonId, salonId),
          inArray(bookings.status, ['pending_payment', 'confirmed', 'in_progress']),
          sql`${bookingItems.startAt} >= ${rangeStart} AND ${bookingItems.endAt} <= ${rangeEnd}`,
        ),
      );

    const activeHolds = await this.db
      .select()
      .from(slotHolds)
      .where(
        and(
          eq(slotHolds.salonId, salonId),
          gt(slotHolds.expiresAt, new Date()),
          sql`${slotHolds.startAt} >= ${rangeStart} AND ${slotHolds.endAt} <= ${rangeEnd}`,
        ),
      );

    return {
      salon: salon ?? null,
      hours: hours ?? null,
      activeStaff,
      skills,
      schedules,
      leaves,
      activeItems,
      activeHolds,
    };
  }
}

