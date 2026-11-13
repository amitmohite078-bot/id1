import { describe, it, expect, vi } from 'vitest';
import { parsePriceText, parseSpreadsheetBuffer } from '../menu.parser.js';
import { detectMagicMime } from '../../../lib/storage.js';
import { computeMenuDiff, MenuImportService } from '../menu-import.service.js';
import type { MenuImportRepository } from '../menu-import.repository.js';
import type { StorageService } from '../../../lib/storage.js';
import { MockMenuAiExtractor } from '../menu.ai-extractor.js';

describe('Menu Parser & Edge Cases', () => {
  it('parses standard, range, starting-from, and missing prices', () => {
    expect(parsePriceText('₹500')).toMatchObject({ pricePaise: 50000, flags: [] });
    expect(parsePriceText('500-800')).toMatchObject({
      pricePaise: 50000,
      maxPricePaise: 80000,
      flags: ['price_range'],
    });
    expect(parsePriceText('Starting from 499')).toMatchObject({
      pricePaise: 49900,
      isStartingFrom: true,
      flags: ['starting_from'],
    });
    expect(parsePriceText('')).toMatchObject({
      pricePaise: null,
      flags: ['missing_price'],
    });
  });

  it('parses CSV buffer with flexible headers and flags low confidence rows', () => {
    const csv = [
      'Category,Service Name,Rate,Duration,Gender',
      'Hair,Classic Haircut,500,30 mins,Men',
      'Facial,Gold Facial,1200-1500,60,Women',
      'Spa,Head Massage,,20,Unisex',
    ].join('\n');

    const items = parseSpreadsheetBuffer(Buffer.from(csv, 'utf8'));
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      categoryName: 'Hair',
      serviceName: 'Classic Haircut',
      pricePaise: 50000,
      durationMinutes: 30,
      genderTag: 'men',
      confidence: 1,
    });
    expect(items[1]).toMatchObject({
      pricePaise: 120000,
      maxPricePaise: 150000,
      genderTag: 'women',
      flags: ['price_range'],
    });
    expect(items[2]).toMatchObject({
      pricePaise: null,
      confidence: 0.4,
      flags: ['missing_price'],
    });
  });

  it('detects magic MIME types for PNG, JPEG, and PDF', () => {
    expect(detectMagicMime(Buffer.from([0x25, 0x50, 0x44, 0x46]))).toBe('application/pdf');
    expect(detectMagicMime(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(detectMagicMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });
});

describe('Menu Diff & Quota Guard', () => {
  it('computes added, changed, and unchanged counts accurately', () => {
    const diff = computeMenuDiff(
      [
        { serviceName: 'Haircut', pricePaise: 60000, durationMinutes: 30 },
        { serviceName: 'Beard Trim', pricePaise: 25000, durationMinutes: 15 },
        { serviceName: 'Bridal Makeup', pricePaise: 1500000, durationMinutes: 180 },
      ],
      [
        { name: 'Haircut', pricePaise: 50000, durationMinutes: 30 },
        { name: 'Beard Trim', pricePaise: 25000, durationMinutes: 15 },
      ],
    );

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.serviceName).toBe('Bridal Makeup');
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]?.oldPricePaise).toBe(50000);
    expect(diff.changed[0]?.newPricePaise).toBe(60000);
    expect(diff.unchangedCount).toBe(1);
  });

  it('blocks import when monthly plan quota is exhausted', async () => {
    const repo = {
      countJobsSince: vi.fn().mockResolvedValue(2),
      getMonthlyImportLimit: vi.fn().mockResolvedValue(2),
    } as unknown as MenuImportRepository;

    const service = new MenuImportService(
      repo,
      {} as StorageService,
      new MockMenuAiExtractor(),
    );

    await expect(
      service.startImportJob({
        salonId: 'salon-1',
        userId: 'user-1',
        sourceType: 'text',
        rawText: 'Haircut - 500',
      }),
    ).rejects.toThrow('Monthly menu import quota reached');
  });
});

