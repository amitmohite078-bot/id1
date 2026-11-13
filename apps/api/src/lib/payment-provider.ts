import crypto from 'node:crypto';
import type { AppEnv } from '../config/env.js';

export interface CreateOrderInput {
  amountPaise: number;
  currency: string;
  receipt: string;
  salonLinkedAccountId?: string | null;
  salonTransferAmountPaise?: number;
}

export interface PaymentOrderResult {
  provider: string;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<PaymentOrderResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  initiateRefund(providerPaymentId: string, amountPaise: number): Promise<{ providerRefundId: string }>;
}

export class RazorpayRouteProvider implements PaymentProvider {
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<PaymentOrderResult> {
    const payload: Record<string, unknown> = {
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
    };

    // Automated marketplace split via Razorpay Route when salon KYC account is linked
    if (input.salonLinkedAccountId && input.salonTransferAmountPaise && input.salonTransferAmountPaise > 0) {
      payload.transfers = [
        {
          account: input.salonLinkedAccountId,
          amount: input.salonTransferAmountPaise,
          currency: input.currency,
          on_hold: 0,
        },
      ];
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Razorpay order creation failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      provider: 'razorpay',
      providerOrderId: data.id,
      amountPaise: data.amount,
      currency: data.currency,
      keyId: this.keyId,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const bufA = Buffer.from(expected);
    const bufB = Buffer.from(signature);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  async initiateRefund(
    providerPaymentId: string,
    amountPaise: number,
  ): Promise<{ providerRefundId: string }> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: amountPaise }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Razorpay refund failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { id: string };
    return { providerRefundId: data.id };
  }
}

export class MockPaymentProvider implements PaymentProvider {
  async createOrder(input: CreateOrderInput): Promise<PaymentOrderResult> {
    return {
      provider: 'mock_razorpay',
      providerOrderId: `order_mock_${crypto.randomBytes(6).toString('hex')}`,
      amountPaise: input.amountPaise,
      currency: input.currency,
      keyId: 'rzp_test_mock',
    };
  }

  verifyWebhookSignature(_rawBody: string, signature: string): boolean {
    return signature === 'mock_valid_signature' || signature.length > 0;
  }

  async initiateRefund(): Promise<{ providerRefundId: string }> {
    return { providerRefundId: `rfnd_mock_${crypto.randomBytes(6).toString('hex')}` };
  }
}

export function createPaymentProvider(env: AppEnv): PaymentProvider {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    return new RazorpayRouteProvider(
      env.RAZORPAY_KEY_ID,
      env.RAZORPAY_KEY_SECRET,
      env.RAZORPAY_WEBHOOK_SECRET ?? env.RAZORPAY_KEY_SECRET,
    );
  }
  return new MockPaymentProvider();
}

