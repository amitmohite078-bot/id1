import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ExtractedMenuItemSchema, type ExtractedMenuItem } from '@salonbridge/types';
import { parsePriceText } from './menu.parser.js';

const AiResponseSchema = z.object({
  items: z.array(ExtractedMenuItemSchema),
});

export interface AiExtractionResult {
  items: ExtractedMenuItem[];
  inputTokens: number;
  outputTokens: number;
  costPaise: number;
  rawOutput: unknown;
}

export interface MenuAiExtractor {
  extractFromImageOrPdf(input: {
    buffer: Buffer;
    mimeType: string;
  }): Promise<AiExtractionResult>;
  extractFromText(rawText: string): Promise<AiExtractionResult>;
}

const EXTRACTION_PROMPT = `You are a salon menu extraction engine. Extract all salon services from the provided menu into strict JSON matching:
{
  "items": [
    {
      "categoryName": "string",
      "serviceName": "string",
      "description": "string | null",
      "pricePaise": number | null, // price in Indian Paise (1 INR = 100 paise)
      "maxPricePaise": number | null, // set if range like 500-800
      "isStartingFrom": boolean,
      "durationMinutes": number, // default 30 if not shown
      "genderTag": "men" | "women" | "unisex",
      "confidence": number, // 0.0 to 1.0 (lower if handwritten, blurry, or ambiguous)
      "flags": string[] // e.g. ["price_range", "starting_from", "low_confidence", "missing_price"]
    }
  ]
}
Return ONLY valid JSON with no markdown fences.`;

export class ClaudeMenuExtractor implements MenuAiExtractor {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async extractFromImageOrPdf(input: {
    buffer: Buffer;
    mimeType: string;
  }): Promise<AiExtractionResult> {
    const base64 = input.buffer.toString('base64');
    const isPdf = input.mimeType === 'application/pdf';

    const contentBlock = isPdf
      ? ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as const)
      : ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: input.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: base64,
          },
        } as const);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: EXTRACTION_PROMPT }],
        },
      ],
    });

    return this.parseClaudeResponse(response);
  }

  async extractFromText(rawText: string): Promise<AiExtractionResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nMENU TEXT:\n${rawText}`,
        },
      ],
    });

    return this.parseClaudeResponse(response);
  }

  private parseClaudeResponse(response: Anthropic.Message): AiExtractionResult {
    const textBlock = response.content.find((b) => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text.trim() : '{}';
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

    const parsedJson = JSON.parse(cleaned) as unknown;
    const validated = AiResponseSchema.parse(parsedJson);

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    // Approximate cost in INR paise (~₹250/MTok input, ~₹1250/MTok output)
    const costPaise = Math.ceil((inputTokens * 0.025 + outputTokens * 0.125) / 100);

    return {
      items: validated.items,
      inputTokens,
      outputTokens,
      costPaise,
      rawOutput: parsedJson,
    };
  }
}

/**
 * Deterministic fallback extractor when ANTHROPIC_API_KEY is not configured (local dev/tests).
 */
export class MockMenuAiExtractor implements MenuAiExtractor {
  async extractFromImageOrPdf(): Promise<AiExtractionResult> {
    const items: ExtractedMenuItem[] = [
      {
        categoryName: 'Haircut & Styling',
        serviceName: 'Classic Haircut (Mock Extracted)',
        description: 'Sample extracted item when ANTHROPIC_API_KEY is not set',
        pricePaise: 49900,
        maxPricePaise: null,
        isStartingFrom: false,
        durationMinutes: 30,
        genderTag: 'unisex',
        confidence: 0.75,
        flags: ['mock_ai_extraction'],
      },
    ];
    return { items, inputTokens: 0, outputTokens: 0, costPaise: 0, rawOutput: { items } };
  }

  async extractFromText(rawText: string): Promise<AiExtractionResult> {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const items: ExtractedMenuItem[] = [];
    for (const line of lines) {
      // Match patterns like "Haircut - 500" or "Facial: ₹1200 (45m)"
      const match = /^(.+?)\s*[-–:]\s*(.+)$/.exec(line);
      const serviceName = (match?.[1] ?? line).trim().slice(0, 180);
      const pricePart = match?.[2] ?? '';
      const parsedPrice = parsePriceText(pricePart);

      items.push({
        categoryName: 'General',
        serviceName,
        description: null,
        pricePaise: parsedPrice.pricePaise,
        maxPricePaise: parsedPrice.maxPricePaise,
        isStartingFrom: parsedPrice.isStartingFrom,
        durationMinutes: 30,
        genderTag: 'unisex',
        confidence: Math.max(0.4, Number((0.9 - parsedPrice.confidencePenalty).toFixed(2))),
        flags: [...parsedPrice.flags, 'text_heuristic'],
      });
    }

    return {
      items,
      inputTokens: 0,
      outputTokens: 0,
      costPaise: 0,
      rawOutput: { items },
    };
  }
}

