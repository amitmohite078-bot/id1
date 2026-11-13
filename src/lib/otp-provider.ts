import type { FastifyBaseLogger } from 'fastify';
import type { AppEnv } from '../config/env.js';

export interface OtpSendPayload {
  phone: string;
  code: string;
  channel: 'whatsapp' | 'sms';
}

export interface OtpProvider {
  sendOtp(payload: OtpSendPayload): Promise<void>;
}

export class MockOtpProvider implements OtpProvider {
  constructor(private readonly logger: FastifyBaseLogger) {}

  async sendOtp(payload: OtpSendPayload): Promise<void> {
    this.logger.info(
      { phone: payload.phone, channel: payload.channel, devOtp: payload.code },
      '[MockOtpProvider] OTP dispatched (dev only)',
    );
  }
}

export class TwilioWhatsAppOtpProvider implements OtpProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  async sendOtp(payload: OtpSendPayload): Promise<void> {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const to = payload.channel === 'whatsapp' ? `whatsapp:${payload.phone}` : payload.phone;
    const from =
      payload.channel === 'whatsapp' ? `whatsapp:${this.fromNumber}` : this.fromNumber;

    const body = new URLSearchParams({
      To: to,
      From: from,
      Body: `Your SalonBridge verification code is ${payload.code}. Valid for 5 minutes.`,
    });

    const authHeader = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio OTP delivery failed (${res.status}): ${text}`);
    }
  }
}

export function createOtpProvider(env: AppEnv, logger: FastifyBaseLogger): OtpProvider {
  if (
    env.OTP_PROVIDER === 'twilio_whatsapp' &&
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_WHATSAPP_FROM
  ) {
    return new TwilioWhatsAppOtpProvider(
      env.TWILIO_ACCOUNT_SID,
      env.TWILIO_AUTH_TOKEN,
      env.TWILIO_WHATSAPP_FROM,
    );
  }
  return new MockOtpProvider(logger);
}

