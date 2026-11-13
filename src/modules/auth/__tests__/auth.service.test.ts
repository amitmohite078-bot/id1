import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticator } from 'otplib';
import { RoleName } from '@salonbridge/types';
import { AuthService } from '../auth.service.js';
import type { AuthRepository, UserWithRoles } from '../auth.repository.js';
import { loadEnv } from '../../../config/env.js';
import { encryptSecret, decryptSecret, sha256 } from '../../../lib/crypto.js';
import { requireRoles, requireSalonMember, requireSuperAdmin2FA } from '../../../plugins/auth.js';

describe('Crypto helpers', () => {
  it('encrypts and decrypts TOTP secret with AES-256-GCM', () => {
    const key = 'test-encryption-key-32-bytes-long!';
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptSecret(secret, key);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted, key)).toBe(secret);
  });
});

describe('AuthService', () => {
  const env = loadEnv({ NODE_ENV: 'test' });
  let mockRepo: Partial<AuthRepository>;
  let mockOtpProvider: { sendOtp: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    mockRepo = {
      createOtpChallenge: vi.fn().mockResolvedValue({ id: 'otp-1' }),
      findLatestActiveOtp: vi.fn(),
      incrementOtpAttempts: vi.fn(),
      markOtpConsumed: vi.fn(),
      findUserByPhone: vi.fn(),
      createUserWithRole: vi.fn(),
      getUserWithRoles: vi.fn(),
      createSession: vi.fn().mockResolvedValue({ id: 'sess-1' }),
      saveTotpSecret: vi.fn(),
    };
    mockOtpProvider = { sendOtp: vi.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      mockRepo as AuthRepository,
      mockOtpProvider,
      { signAccess: () => 'signed-jwt-token' },
      env,
    );
  });

  it('sends OTP and returns devOtp in non-production', async () => {
    const res = await service.sendOtp({
      phone: '+919876543210',
      channel: 'whatsapp',
      purpose: 'login',
    });
    expect(res.sent).toBe(true);
    expect(res.devOtp).toMatch(/^\d{6}$/);
    expect(mockOtpProvider.sendOtp).toHaveBeenCalledOnce();
  });

  it('rejects invalid OTP and increments attempts', async () => {
    (mockRepo.findLatestActiveOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'otp-1',
      codeHash: sha256('123456'),
      attempts: 0,
    });

    await expect(
      service.verifyOtp(
        { phone: '+919876543210', code: '999999', appScope: 'customer' },
        {},
      ),
    ).rejects.toThrow('Invalid OTP code');

    expect(mockRepo.incrementOtpAttempts).toHaveBeenCalledWith('otp-1');
  });

  it('requires 2FA challenge for Super Admin scope', async () => {
    (mockRepo.findLatestActiveOtp as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'otp-1',
      codeHash: sha256('123456'),
      attempts: 0,
    });
    (mockRepo.findUserByPhone as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'admin-1',
      status: 'active',
    });
    const adminUser: UserWithRoles = {
      id: 'admin-1',
      phone: '+919999999999',
      email: 'admin@salonbridge.in',
      fullName: 'Owner',
      status: 'active',
      totpEnabled: true,
      totpSecretEnc: null,
      roles: [RoleName.SUPER_ADMIN],
      salonId: null,
    };
    (mockRepo.getUserWithRoles as ReturnType<typeof vi.fn>).mockResolvedValue(adminUser);

    const res = await service.verifyOtp(
      { phone: '+919999999999', code: '123456', appScope: 'admin' },
      {},
    );
    expect(res.requiresTwoFactor).toBe(true);
  });

  it('verifies valid TOTP 2FA code for Super Admin', async () => {
    const secret = authenticator.generateSecret();
    const code = authenticator.generate(secret);
    const encrypted = encryptSecret(secret, env.ADMIN_2FA_ENCRYPTION_KEY);

    (mockRepo.getUserWithRoles as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'admin-1',
      phone: '+919999999999',
      email: 'admin@salonbridge.in',
      fullName: 'Owner',
      status: 'active',
      totpEnabled: false,
      totpSecretEnc: encrypted,
      roles: [RoleName.SUPER_ADMIN],
      salonId: null,
    });

    const res = await service.verifyAdminTotp('admin-1', code, {});
    expect(res.requiresTwoFactor).toBe(false);
    expect(res.accessToken).toBe('signed-jwt-token');
    expect(mockRepo.saveTotpSecret).toHaveBeenCalledWith('admin-1', encrypted, true);
  });
});

describe('RBAC & Tenant Guards', () => {
  it('blocks user without required role', async () => {
    const guard = requireRoles(RoleName.SALON_OWNER);
    const fakeReq = {
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: { sub: 'u1', roles: [RoleName.CUSTOMER], salonId: null },
    } as never;
    await expect(guard(fakeReq)).rejects.toThrow('Insufficient role permissions');
  });

  it('blocks salon route when salonId is missing from token', async () => {
    const guard = requireSalonMember();
    const fakeReq = {
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: { sub: 'u1', roles: [RoleName.SALON_OWNER], salonId: null },
    } as never;
    await expect(guard(fakeReq)).rejects.toThrow('No active salon membership');
  });

  it('blocks Super Admin route when 2FA is not verified', async () => {
    const guard = requireSuperAdmin2FA();
    const fakeReq = {
      jwtVerify: vi.fn().mockResolvedValue(undefined),
      user: { sub: 'a1', roles: [RoleName.SUPER_ADMIN], salonId: null, twoFactorVerified: false },
    } as never;
    await expect(guard(fakeReq)).rejects.toThrow('2FA verification required');
  });
});

