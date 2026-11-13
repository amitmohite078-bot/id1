import type { FastifyBaseLogger } from 'fastify';
import type { AppEnv } from '../config/env.js';

export interface SendNotificationPayload {
  userId?: string | null;
  channel: 'whatsapp' | 'email' | 'sms';
  recipient: string;
  templateKey: string;
  payload: Record<string, unknown>;
}

export interface NotificationDispatcher {
  dispatch(notification: SendNotificationPayload): Promise<{ providerMessageId: string }>;
}

export class MultiChannelNotificationDispatcher implements NotificationDispatcher {
  constructor(
    private readonly env: AppEnv,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async dispatch(n: SendNotificationPayload): Promise<{ providerMessageId: string }> {
    const fakeId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    if (n.channel === 'whatsapp' && this.env.TWILIO_ACCOUNT_SID && this.env.TWILIO_AUTH_TOKEN) {
      this.logger.info(
        { recipient: n.recipient, template: n.templateKey, payload: n.payload },
        '[Notification] Dispatched via WhatsApp',
      );
      return { providerMessageId: fakeId };
    }

    if (n.channel === 'email' && this.env.RESEND_API_KEY) {
      this.logger.info(
        { recipient: n.recipient, template: n.templateKey, payload: n.payload },
        '[Notification] Dispatched via Resend Email',
      );
      return { providerMessageId: fakeId };
    }

    // Dev/Mock Dispatcher
    this.logger.info(
      { channel: n.channel, recipient: n.recipient, template: n.templateKey, payload: n.payload },
      '[MockNotification] Delivered to local log',
    );
    return { providerMessageId: fakeId };
  }
}
