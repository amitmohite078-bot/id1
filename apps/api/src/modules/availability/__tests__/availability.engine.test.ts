import { describe, it, expect } from 'vitest';
import { computeAvailableSlots, type AvailabilityInput } from '../availability.engine.js';

function baseInput(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: '2026-12-01',
    timezone: 'Asia/Kolkata',
    salonHours: { isClosed: false, openTime: '10:00', closeTime: '13:00' },
    slotIntervalMinutes: 30,
    bufferMinutes: 0,
    maxConcurrentBookings: 4,
    serviceDurationMinutes: 60,
    staffList: [
      {
        id: 'staff-1',
        schedule: {
          isOff: false,
          startTime: '10:00',
          endTime: '13:00',
          breakStart: null,
          breakEnd: null,
        },
        leaves: [],
        busyIntervals: [],
      },
    ],
    salonBusyCounts: [],
    now: new Date('2026-12-01T00:00:00.000Z'), // 05:30 IST
    ...overrides,
  };
}

describe('Availability Engine', () => {
  it('returns empty when salon is closed', () => {
    const slots = computeAvailableSlots(
      baseInput({ salonHours: { isClosed: true, openTime: null, closeTime: null } }),
    );
    expect(slots).toEqual([]);
  });

  it('computes slots with 30-min intervals for 60-min service', () => {
    const slots = computeAvailableSlots(baseInput());
    expect(slots.map((s) => s.startTime)).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00']);
  });

  it('excludes staff break times', () => {
    const slots = computeAvailableSlots(
      baseInput({
        staffList: [
          {
            id: 'staff-1',
            schedule: {
              isOff: false,
              startTime: '10:00',
              endTime: '13:00',
              breakStart: '11:00',
              breakEnd: '12:00',
            },
            leaves: [],
            busyIntervals: [],
          },
        ],
      }),
    );
    expect(slots.map((s) => s.startTime)).toEqual(['10:00', '12:00']);
  });

  it('excludes full-day and partial leaves', () => {
    const fullDay = computeAvailableSlots(
      baseInput({
        staffList: [
          {
            id: 'staff-1',
            schedule: { isOff: false, startTime: '10:00', endTime: '13:00' },
            leaves: [{ startTime: null, endTime: null }],
            busyIntervals: [],
          },
        ],
      }),
    );
    expect(fullDay).toEqual([]);

    const partial = computeAvailableSlots(
      baseInput({
        staffList: [
          {
            id: 'staff-1',
            schedule: { isOff: false, startTime: '10:00', endTime: '13:00' },
            leaves: [{ startTime: '10:00', endTime: '11:30' }],
            busyIntervals: [],
          },
        ],
      }),
    );
    expect(partial.map((s) => s.startTime)).toEqual(['11:30', '12:00']);
  });

  it('respects existing bookings plus bufferMinutes', () => {
    const slots = computeAvailableSlots(
      baseInput({
        bufferMinutes: 15,
        staffList: [
          {
            id: 'staff-1',
            schedule: { isOff: false, startTime: '10:00', endTime: '13:00' },
            leaves: [],
            busyIntervals: [{ startMin: 600, endMin: 660 }], // 10:00 - 11:00
          },
        ],
      }),
    );
    // 10:00-11:00 + 15m buffer = blocked until 11:15, so next valid 30m step is 11:30
    expect(slots.map((s) => s.startTime)).toEqual(['11:30', '12:00']);
  });

  it('enforces salon-wide maxConcurrentBookings cap', () => {
    const slots = computeAvailableSlots(
      baseInput({
        maxConcurrentBookings: 1,
        salonBusyCounts: [{ startMin: 600, endMin: 660 }], // 10:00 - 11:00
        staffList: [
          {
            id: 'staff-1',
            schedule: { isOff: false, startTime: '10:00', endTime: '13:00' },
            leaves: [],
            busyIntervals: [{ startMin: 600, endMin: 660 }],
          },
          {
            id: 'staff-2',
            schedule: { isOff: false, startTime: '10:00', endTime: '13:00' },
            leaves: [],
            busyIntervals: [], // staff-2 is free, but salon concurrent cap is 1!
          },
        ],
      }),
    );
    expect(slots.map((s) => s.startTime)).toEqual(['11:00', '11:30', '12:00']);
  });

  it('filters past slots for today in salon timezone', () => {
    // 2026-12-01 11:10 IST = 2026-12-01T05:40:00Z
    const slots = computeAvailableSlots(
      baseInput({
        now: new Date('2026-12-01T05:40:00.000Z'),
      }),
    );
    expect(slots.map((s) => s.startTime)).toEqual(['11:30', '12:00']);
  });
});

