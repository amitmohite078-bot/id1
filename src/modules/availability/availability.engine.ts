export interface TimeInterval {
  startMin: number;
  endMin: number;
}

export interface AvailabilityStaffInput {
  id: string;
  schedule: {
    isOff: boolean;
    startTime: string; // HH:MM or HH:MM:SS
    endTime: string;
    breakStart?: string | null;
    breakEnd?: string | null;
  } | null;
  leaves: Array<{
    startTime: string | null;
    endTime: string | null;
  }>;
  busyIntervals: TimeInterval[]; // existing bookings + active slot holds (in salon local minutes)
}

export interface AvailabilityInput {
  date: string; // YYYY-MM-DD
  timezone: string; // e.g. Asia/Kolkata
  salonHours: {
    isClosed: boolean;
    openTime: string | null;
    closeTime: string | null;
  } | null;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  maxConcurrentBookings: number;
  serviceDurationMinutes: number;
  staffList: AvailabilityStaffInput[];
  salonBusyCounts: Array<{ startMin: number; endMin: number }>; // all active bookings/holds in salon for concurrent cap
  now?: Date;
}

export interface AvailableSlot {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  startAt: string; // ISO UTC
  endAt: string; // ISO UTC
  availableStaffIds: string[];
}

export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

/**
 * Computes timezone offset in minutes for a given date & IANA timezone.
 */
export function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  return Math.round((tzDate.getTime() - utcDate.getTime()) / 60_000);
}

export function localDateMinutesToUtcIso(
  dateStr: string,
  minutesFromMidnight: number,
  timeZone: string,
): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const approxUtc = new Date(Date.UTC(y!, m! - 1, d!, 0, minutesFromMidnight, 0));
  const offsetMin = getTimezoneOffsetMinutes(approxUtc, timeZone);
  return new Date(approxUtc.getTime() - offsetMin * 60_000).toISOString();
}

export function getLocalDateAndMinutes(now: Date, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + minute,
  };
}

export function computeAvailableSlots(input: AvailabilityInput): AvailableSlot[] {
  if (!input.salonHours || input.salonHours.isClosed) {
    return [];
  }
  if (!input.salonHours.openTime || !input.salonHours.closeTime) {
    return [];
  }
  if (input.serviceDurationMinutes <= 0 || input.staffList.length === 0) {
    return [];
  }

  const salonOpen = parseTimeToMinutes(input.salonHours.openTime);
  const salonClose = parseTimeToMinutes(input.salonHours.closeTime);
  const step = Math.max(5, input.slotIntervalMinutes);
  const blockedDuration = input.serviceDurationMinutes + input.bufferMinutes;

  const now = input.now ?? new Date();
  const localNow = getLocalDateAndMinutes(now, input.timezone);
  const minStartForToday = localNow.date === input.date ? localNow.minutes : 0;

  // Precompute blocked intervals per staff
  const staffBlockedMap = new Map<string, { work: TimeInterval; blocked: TimeInterval[] }>();

  for (const member of input.staffList) {
    if (!member.schedule || member.schedule.isOff) continue;

    // Check full-day leave
    const hasFullDayLeave = member.leaves.some((l) => !l.startTime || !l.endTime);
    if (hasFullDayLeave) continue;

    const workStart = Math.max(salonOpen, parseTimeToMinutes(member.schedule.startTime));
    const workEnd = Math.min(salonClose, parseTimeToMinutes(member.schedule.endTime));
    if (workEnd - workStart < input.serviceDurationMinutes) continue;

    const blocked: TimeInterval[] = [];

    if (member.schedule.breakStart && member.schedule.breakEnd) {
      blocked.push({
        startMin: parseTimeToMinutes(member.schedule.breakStart),
        endMin: parseTimeToMinutes(member.schedule.breakEnd),
      });
    }

    for (const leave of member.leaves) {
      if (leave.startTime && leave.endTime) {
        blocked.push({
          startMin: parseTimeToMinutes(leave.startTime),
          endMin: parseTimeToMinutes(leave.endTime),
        });
      }
    }

    for (const busy of member.busyIntervals) {
      blocked.push({
        startMin: busy.startMin,
        endMin: busy.endMin + input.bufferMinutes,
      });
    }

    staffBlockedMap.set(member.id, {
      work: { startMin: workStart, endMin: workEnd },
      blocked,
    });
  }

  if (staffBlockedMap.size === 0) return [];

  const slots: AvailableSlot[] = [];

  for (let start = salonOpen; start + input.serviceDurationMinutes <= salonClose; start += step) {
    if (start < minStartForToday) continue;

    const serviceEnd = start + input.serviceDurationMinutes;
    const candidateWithBuffer: TimeInterval = {
      startMin: start,
      endMin: start + blockedDuration,
    };
    const candidateService: TimeInterval = {
      startMin: start,
      endMin: serviceEnd,
    };

    // Enforce salon-wide max concurrent bookings cap
    const concurrentCount = input.salonBusyCounts.filter((b) =>
      intervalsOverlap(candidateService, b),
    ).length;
    if (concurrentCount >= input.maxConcurrentBookings) {
      continue;
    }

    const availableStaffIds: string[] = [];
    for (const [staffId, info] of staffBlockedMap.entries()) {
      if (start < info.work.startMin || serviceEnd > info.work.endMin) {
        continue;
      }
      const hasConflict = info.blocked.some((b) => intervalsOverlap(candidateWithBuffer, b));
      if (!hasConflict) {
        availableStaffIds.push(staffId);
      }
    }

    if (availableStaffIds.length > 0) {
      slots.push({
        startTime: formatMinutesToTime(start),
        endTime: formatMinutesToTime(serviceEnd),
        startAt: localDateMinutesToUtcIso(input.date, start, input.timezone),
        endAt: localDateMinutesToUtcIso(input.date, serviceEnd, input.timezone),
        availableStaffIds,
      });
    }
  }

  return slots;
}

