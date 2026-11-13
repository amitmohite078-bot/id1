import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z
    .string()
    .default('postgresql://salonbridge:salonbridge_dev@localhost:5432/salonbridge'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  COOKIE_SECRET: z.string().min(16).default('dev-cookie-secret-change-in-production-32chars'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-jwt-access-secret-change-in-prod-32chars'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-jwt-refresh-secret-change-in-prod-32chars'),
  ADMIN_2FA_ENCRYPTION_KEY: z
    .string()
    .min(16)
    .default('dev-32-byte-hex-key-for-totp-secret-enc'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:3002'),
  ADMIN_IP_ALLOWLIST: z.string().default(''),
  OTP_PROVIDER: z.enum(['mock', 'twilio_whatsapp']).default('mock'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@salonbridge.in'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().default('salonbridge-media'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin123'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-20250514'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  CUSTOMER_WEB_URL: z.string().default('http://localhost:3000'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  return EnvSchema.parse(source);
}

