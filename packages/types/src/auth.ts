import { z } from 'zod';

export const PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format (e.g. +919876543210)');

export const SendOtpRequestSchema = z.object({
  phone: PhoneSchema,
  channel: z.enum(['whatsapp', 'sms']).default('whatsapp'),
  purpose: z.enum(['login', 'onboarding', 'verify']).default('login'),
});

export type SendOtpRequest = z.infer<typeof SendOtpRequestSchema>;

export const VerifyOtpRequestSchema = z.object({
  phone: PhoneSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
  fullName: z.string().min(2).max(100).optional(),
  appScope: z.enum(['customer', 'salon', 'admin']).default('customer'),
});

export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

export const VerifyTotpRequestSchema = z.object({
  challengeToken: z.string().min(10),
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

export type VerifyTotpRequest = z.infer<typeof VerifyTotpRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  fullName: z.string().nullable(),
  roles: z.array(z.string()),
  salonId: z.string().uuid().nullable(),
  totpEnabled: z.boolean(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

