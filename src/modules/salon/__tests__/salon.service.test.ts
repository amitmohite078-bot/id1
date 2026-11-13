import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SalonService } from '../salon.service.js';
import type { SalonRepository } from '../salon.repository.js';

describe('SalonService', () => {
  let mockRepo: Partial<SalonRepository>;
  let service: SalonService;

  beforeEach(() => {
    mockRepo = {
      findSalonByOwner: vi.fn(),
      createSalonOnboarding: vi.fn(),
      listServices: vi.fn(),
      bulkUpdateServicePrices: vi.fn(),
    };
    service = new SalonService(mockRepo as SalonRepository);
  });

  it('prevents an owner from onboarding a second salon (1 owner = 1 salon)', async () => {
    (mockRepo.findSalonByOwner as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'salon-1' });

    await expect(
      service.onboardSalon('owner-1', {
        name: 'Glow Studio',
        genderFocus: 'unisex',
        phone: '+919876543210',
        addressLine1: '12 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        lat: 12.9716,
        lng: 77.5946,
        amenities: [],
      }),
    ).rejects.toThrow('Owner already has a registered salon');
  });

  it('applies percentage bulk price adjustment accurately', async () => {
    (mockRepo.listServices as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 's1', name: 'Haircut', pricePaise: 50000, categoryId: 'c1' },
      { id: 's2', name: 'Facial', pricePaise: 100000, categoryId: 'c2' },
    ]);
    (mockRepo.bulkUpdateServicePrices as ReturnType<typeof vi.fn>).mockResolvedValue(2);

    const res = await service.bulkAdjustPrices('salon-1', { mode: 'percent', value: 10 });
    expect(res.updatedCount).toBe(2);
    expect(mockRepo.bulkUpdateServicePrices).toHaveBeenCalledWith('salon-1', [
      { id: 's1', pricePaise: 55000 },
      { id: 's2', pricePaise: 110000 },
    ]);
  });

  it('generates customer booking URL and QR code on successful onboarding', async () => {
    (mockRepo.findSalonByOwner as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockRepo.createSalonOnboarding as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'salon-1',
      name: 'Glow Studio',
      slug: 'glow-studio-bengaluru',
      status: 'pending',
    });

    const res = await service.onboardSalon('owner-1', {
      name: 'Glow Studio',
      genderFocus: 'unisex',
      phone: '+919876543210',
      addressLine1: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      lat: 12.9716,
      lng: 77.5946,
      amenities: [],
    });

    expect(res.bookingUrl).toBe('http://localhost:3000/salon/glow-studio-bengaluru');
    expect(res.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.qrSvg).toContain('<svg');
  });

  it('rejects bulk price adjustment that drops price below ₹1.00', async () => {
    (mockRepo.listServices as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 's1', name: 'Threading', pricePaise: 500, categoryId: 'c1' },
    ]);

    await expect(
      service.bulkAdjustPrices('salon-1', { mode: 'flat_paise', value: -450 }),
    ).rejects.toThrow('below ₹1.00');
  });
});

