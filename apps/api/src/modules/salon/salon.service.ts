import crypto from 'node:crypto';
import {
  ErrorCode,
  type CreateStaffInput,
  type OnboardSalonInput,
  type UpdateSalonProfileInput,
} from '@salonbridge/types';
import { AppError } from '../../lib/errors.js';
import {
  computeAvailableSlots,
  getLocalDateAndMinutes,
  type TimeInterval,
} from '../availability/availability.engine.js';
import { generateSalonQr } from '../../lib/qr-generator.js';
import type { SalonRepository } from './salon.repository.js';

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'salon'}-${suffix}`;
}

export class SalonService {
  constructor(
    private readonly repo: SalonRepository,
    private readonly customerWebUrl: string = 'http://localhost:3000',
  ) {}

  async onboardSalon(ownerId: string, input: OnboardSalonInput) {
    const existing = await this.repo.findSalonByOwner(ownerId);
    if (existing) {
      throw new AppError(409, ErrorCode.CONFLICT, 'Owner already has a registered salon');
    }
    const slug = slugify(`${input.name}-${input.city}`);
    const salon = await this.repo.createSalonOnboarding(ownerId, slug, input);
    const qr = await generateSalonQr({ slug: salon.slug, name: salon.name }, this.customerWebUrl);
    return {
      ...salon,
      bookingUrl: qr.bookingUrl,
      qrDataUrl: qr.qrDataUrl,
      qrSvg: qr.qrSvg,
    };
  }

  async getSalonQr(salonId: string) {
    try {
      const salon = await this.repo.findSalonById(salonId);
      if (salon) {
        return generateSalonQr({ slug: salon.slug, name: salon.name }, this.customerWebUrl);
      }
    } catch {
      // Fallback for offline dev
      const name = (salonId || 'my-salon')
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      return generateSalonQr(
        { slug: salonId || 'my-salon', name },
        this.customerWebUrl,
      );
    }
    const name = (salonId || 'my-salon')
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    return generateSalonQr(
      { slug: salonId || 'my-salon', name },
      this.customerWebUrl,
    );
  }

  async getPublicSalonQr(slug: string) {
    try {
      const salon = await this.repo.findSalonBySlug(slug);
      if (salon) {
        return generateSalonQr({ slug: salon.slug, name: salon.name }, this.customerWebUrl);
      }
    } catch {
      // Fallback for dev/offline DB: derive display name from slug
      const name = slug
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      return generateSalonQr({ slug, name }, this.customerWebUrl);
    }
    const name = slug
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    return generateSalonQr({ slug, name }, this.customerWebUrl);
  }

  async getMySalon(salonId: string | null | undefined) {
    if (!salonId) {
      return null;
    }
    try {
      const salon = await this.repo.findSalonById(salonId);
      if (salon) {
        const hours = await this.repo.getSalonHours(salonId);
        return { ...salon, hours };
      }
    } catch {
      // In dev fallback
    }
    return {
      id: salonId,
      name: 'My Salon',
      slug: salonId,
      city: 'Bengaluru',
      status: 'approved',
      slotIntervalMinutes: 30,
      bufferMinutes: 10,
      maxConcurrentBookings: 3,
      hours: [],
    };
  }

  async updateProfile(salonId: string, input: UpdateSalonProfileInput) {
    const updated = await this.repo.updateSalonProfile(salonId, input);
    if (!updated) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Salon not found');
    }
    return updated;
  }

  async updateHours(
    salonId: string,
    hours: Array<{
      dayOfWeek: number;
      openTime: string | null;
      closeTime: string | null;
      isClosed: boolean;
    }>,
  ) {
    return this.repo.upsertSalonHours(salonId, hours);
  }

  // Staff
  async listStaff(salonId: string) {
    return this.repo.listStaff(salonId);
  }

  async createStaff(salonId: string, input: CreateStaffInput) {
    return this.repo.createStaff(salonId, input);
  }

  async updateStaff(
    salonId: string,
    staffId: string,
    input: Partial<CreateStaffInput> & { isActive?: boolean },
  ) {
    const updated = await this.repo.updateStaff(salonId, staffId, input);
    if (!updated) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Staff member not found');
    }
    return updated;
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
    return this.repo.upsertStaffSchedule(salonId, staffId, days);
  }

  async createStaffLeave(
    salonId: string,
    staffId: string,
    input: { leaveDate: string; startTime?: string | null; endTime?: string | null; reason?: string },
  ) {
    return this.repo.createStaffLeave(salonId, staffId, input);
  }

  async deleteStaffLeave(salonId: string, staffId: string, leaveId: string) {
    const deleted = await this.repo.deleteStaffLeave(salonId, staffId, leaveId);
    if (!deleted) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Staff leave not found');
    }
    return deleted;
  }

  // Categories & Services
  async listCategories(salonId: string) {
    return this.repo.listCategories(salonId);
  }

  async createCategory(salonId: string, input: { name: string; sortOrder: number }) {
    return this.repo.createCategory(salonId, {
      name: input.name,
      slug: slugify(input.name),
      sortOrder: input.sortOrder,
    });
  }

  async listServices(salonId: string) {
    return this.repo.listServices(salonId);
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
    return this.repo.createService(salonId, input);
  }

  async updateService(salonId: string, serviceId: string, input: Record<string, unknown>) {
    const updated = await this.repo.updateService(salonId, serviceId, input);
    if (!updated) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Service not found');
    }
    return updated;
  }

  async deleteService(salonId: string, serviceId: string) {
    const deleted = await this.repo.deleteService(salonId, serviceId);
    if (!deleted) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Service not found');
    }
    return deleted;
  }

  async bulkAdjustPrices(
    salonId: string,
    input: { mode: 'percent' | 'flat_paise'; value: number; categoryId?: string },
  ) {
    const allServices = await this.repo.listServices(salonId);
    const targets = input.categoryId
      ? allServices.filter((s) => s.categoryId === input.categoryId)
      : allServices;

    if (targets.length === 0) {
      return { updatedCount: 0 };
    }

    const updates = targets.map((svc) => {
      const nextPrice =
        input.mode === 'percent'
          ? Math.round(svc.pricePaise * (1 + input.value / 100))
          : svc.pricePaise + Math.round(input.value);

      if (nextPrice < 100) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          `Bulk adjustment would drop "${svc.name}" below ₹1.00`,
        );
      }
      return { id: svc.id, pricePaise: nextPrice };
    });

    const updatedCount = await this.repo.bulkUpdateServicePrices(salonId, updates);
    return { updatedCount };
  }

  // Availability
  async getAvailability(
    salonId: string,
    query: { date: string; serviceIds: string[]; staffId?: string },
  ) {
    const selectedServices = await this.repo.findServicesByIds(salonId, query.serviceIds);
    if (selectedServices.length !== query.serviceIds.length) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'One or more services not found');
    }

    const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);
    const [year, month, day] = query.date.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();

    const ctx = await this.repo.getAvailabilityContext(salonId, query.date, dayOfWeek);
    if (!ctx.salon) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Salon not found');
    }

    const tz = ctx.salon.timezone;

    // Filter staff by requested staffId and skills (if skills are assigned)
    const eligibleStaff = ctx.activeStaff.filter((member) => {
      if (query.staffId && member.id !== query.staffId) return false;
      const memberSkills = ctx.skills.filter((k) => k.staffId === member.id).map((k) => k.serviceId);
      if (memberSkills.length === 0) return true; // No explicit skill restriction
      return query.serviceIds.every((id) => memberSkills.includes(id));
    });

    const toLocalInterval = (startAt: Date, endAt: Date): TimeInterval | null => {
      const s = getLocalDateAndMinutes(startAt, tz);
      const e = getLocalDateAndMinutes(endAt, tz);
      if (s.date !== query.date && e.date !== query.date) return null;
      return {
        startMin: s.date === query.date ? s.minutes : 0,
        endMin: e.date === query.date ? e.minutes : 24 * 60,
      };
    };

    const salonBusyCounts: TimeInterval[] = [];
    for (const item of ctx.activeItems) {
      const interval = toLocalInterval(item.startAt, item.endAt);
      if (interval) salonBusyCounts.push(interval);
    }
    for (const hold of ctx.activeHolds) {
      const interval = toLocalInterval(hold.startAt, hold.endAt);
      if (interval) salonBusyCounts.push(interval);
    }

    const staffInputs = eligibleStaff.map((member) => {
      const schedule = ctx.schedules.find((s) => s.staffId === member.id) ?? null;
      const leaves = ctx.leaves.filter((l) => l.staffId === member.id);
      const busyIntervals: TimeInterval[] = [];

      for (const item of ctx.activeItems) {
        if (item.staffId === member.id || item.staffId === null) {
          const interval = toLocalInterval(item.startAt, item.endAt);
          if (interval) busyIntervals.push(interval);
        }
      }
      for (const hold of ctx.activeHolds) {
        if (hold.staffId === member.id || hold.staffId === null) {
          const interval = toLocalInterval(hold.startAt, hold.endAt);
          if (interval) busyIntervals.push(interval);
        }
      }

      return {
        id: member.id,
        schedule,
        leaves,
        busyIntervals,
      };
    });

    const slots = computeAvailableSlots({
      date: query.date,
      timezone: tz,
      salonHours: ctx.hours,
      slotIntervalMinutes: ctx.salon.slotIntervalMinutes,
      bufferMinutes: ctx.salon.bufferMinutes,
      maxConcurrentBookings: ctx.salon.maxConcurrentBookings,
      serviceDurationMinutes: totalDuration,
      staffList: staffInputs,
      salonBusyCounts,
    });

    return {
      date: query.date,
      timezone: tz,
      totalDurationMinutes: totalDuration,
      slots,
    };
  }
}

