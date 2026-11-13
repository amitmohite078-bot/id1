import * as XLSX from 'xlsx';
import { ExtractedMenuItemSchema, type ExtractedMenuItem } from '@salonbridge/types';

export interface ParsedPriceResult {
  pricePaise: number | null;
  maxPricePaise: number | null;
  isStartingFrom: boolean;
  flags: string[];
  confidencePenalty: number;
}

export function parsePriceText(raw: string | number | null | undefined): ParsedPriceResult {
  if (raw === null || raw === undefined) {
    return {
      pricePaise: null,
      maxPricePaise: null,
      isStartingFrom: false,
      flags: ['missing_price'],
      confidencePenalty: 0.6,
    };
  }

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return {
      pricePaise: Math.round(raw * 100),
      maxPricePaise: null,
      isStartingFrom: false,
      flags: [],
      confidencePenalty: 0,
    };
  }

  const text = String(raw).trim();
  if (!text) {
    return {
      pricePaise: null,
      maxPricePaise: null,
      isStartingFrom: false,
      flags: ['missing_price'],
      confidencePenalty: 0.6,
    };
  }

  // Range e.g. "500-800" or "₹500 to ₹800"
  const rangeMatch = /(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i.exec(text);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const min = Math.round(Number(rangeMatch[1]) * 100);
    const max = Math.round(Number(rangeMatch[2]) * 100);
    return {
      pricePaise: min >= 100 ? min : null,
      maxPricePaise: max >= min ? max : null,
      isStartingFrom: false,
      flags: ['price_range'],
      confidencePenalty: 0.2,
    };
  }

  // Starting from e.g. "Starting from 499", "499+", "from ₹500"
  const isStartingFrom = /(?:starting|from|\+|onwards)/i.test(text);
  const singleMatch = /(\d+(?:\.\d+)?)/.exec(text.replace(/,/g, ''));
  if (singleMatch && singleMatch[1]) {
    const paise = Math.round(Number(singleMatch[1]) * 100);
    if (paise >= 100 && paise <= 10_000_000) {
      return {
        pricePaise: paise,
        maxPricePaise: null,
        isStartingFrom,
        flags: isStartingFrom ? ['starting_from'] : [],
        confidencePenalty: isStartingFrom ? 0.15 : 0,
      };
    }
  }

  return {
    pricePaise: null,
    maxPricePaise: null,
    isStartingFrom: false,
    flags: ['unparsed_price'],
    confidencePenalty: 0.5,
  };
}

function normalizeGender(raw: unknown): 'men' | 'women' | 'unisex' {
  const s = String(raw ?? '').toLowerCase();
  if (/\b(men|male|gents|boy)\b/.test(s)) return 'men';
  if (/\b(women|female|ladies|bridal|girl)\b/.test(s)) return 'women';
  return 'unisex';
}

function parseDuration(raw: unknown): number {
  const match = /(\d+)/.exec(String(raw ?? ''));
  const mins = match ? Number(match[1]) : 30;
  if (mins >= 5 && mins <= 480) return mins;
  return 30;
}

function pickColumn(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const found = keys.find((k) => k.toLowerCase().trim().includes(alias));
    if (found && row[found] !== undefined && row[found] !== '') {
      return row[found];
    }
  }
  return undefined;
}

export function parseSpreadsheetBuffer(buffer: Buffer): ExtractedMenuItem[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const items: ExtractedMenuItem[] = [];
  for (const row of rows) {
    const rawName = pickColumn(row, ['service', 'name', 'treatment', 'item', 'title']);
    const serviceName = String(rawName ?? '').trim();
    if (!serviceName) continue;

    const categoryName =
      String(pickColumn(row, ['category', 'section', 'group', 'type']) ?? 'General').trim() ||
      'General';
    const descriptionRaw = pickColumn(row, ['description', 'desc', 'details', 'notes']);
    const priceRaw = pickColumn(row, ['price', 'rate', 'cost', 'amount', 'mrp']);
    const durationRaw = pickColumn(row, ['duration', 'time', 'min']);
    const genderRaw = pickColumn(row, ['gender', 'for', 'target']);

    const parsedPrice = parsePriceText(priceRaw as string | number | undefined);
    const confidence = Math.max(0.1, Number((1 - parsedPrice.confidencePenalty).toFixed(2)));

    const candidate = ExtractedMenuItemSchema.safeParse({
      categoryName,
      serviceName,
      description: descriptionRaw ? String(descriptionRaw).trim() : null,
      pricePaise: parsedPrice.pricePaise,
      maxPricePaise: parsedPrice.maxPricePaise,
      isStartingFrom: parsedPrice.isStartingFrom,
      durationMinutes: parseDuration(durationRaw),
      genderTag: normalizeGender(genderRaw),
      confidence,
      flags: parsedPrice.flags,
    });

    if (candidate.success) {
      items.push(candidate.data);
    }
  }

  return items;
}

