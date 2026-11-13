import { authenticator } from 'otplib';
import { ErrorCode, RoleName, type SendOtpRequest, type VerifyOtpRequest } from '@salonbridge/types';
import { AppError } from '../../lib/errors.js';
import {
  decryptSecret,
  encryptSecret,
  generateNumericOtp,
  generateRandomToken,
  safeEqual,
  sha256,
} from '../../lib/crypto.js';
import type { OtpProvider } from '../../lib/otp-provider.js';
import type { AuthRepository, UserWithRoles } from './auth.repository.js';
import type { AppEnv } from '../../config/env.js';

export interface TokenSigner {
  signAccess(payload: {
    sub: string;
    roles: string[];
    salonId: string | null;
    twoFactorVerified?: boolean;
  }): string;
}

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly otpProvider: OtpProvider,
    private readonly tokenSigner: TokenSigner,
    private readonly env: AppEnv,
  ) {}

  async sendOtp(input: SendOtpRequest) {
    const code = generateNumericOtp(6);
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.repo.createOtpChallenge({
      phone: input.phone,
      codeHash,
      channel: input.channel,
      purpose: input.purpose,
      expiresAt,
    });

    await this.otpProvider.sendOtp({
      phone: input.phone,
      code,
      channel: input.channel,
    });

    return {
      sent: true,
      expiresInSeconds: 300,
      ...(this.env.NODE_ENV !== 'production' ? { devOtp: code } : {}),
    };
  }

  async verifyOtp(
    input: VerifyOtpRequest,
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    const challenge = await this.repo.findLatestActiveOtp(input.phone);
    if (!challenge) {
      throw new AppError(401, ErrorCode.INVALID_OTP, 'OTP expired or not found');
    }

    if (challenge.attempts >= 5) {
      throw new AppError(429, ErrorCode.RATE_LIMITED, 'Too many invalid OTP attempts');
    }

    const incomingHash = sha256(input.code);
    if (!safeEqual(incomingHash, challenge.codeHash)) {
      await this.repo.incrementOtpAttempts(challenge.id);
      throw new AppError(401, ErrorCode.INVALID_OTP, 'Invalid OTP code');
    }

    await this.repo.markOtpConsumed(challenge.id);

    let existingUser = await this.repo.findUserByPhone(input.phone);
    if (!existingUser) {
      const defaultRole =
        input.appScope === 'salon' ? RoleName.SALON_OWNER : RoleName.CUSTOMER;
      existingUser = await this.repo.createUserWithRole({
        phone: input.phone,
        fullName: input.fullName,
        roleName: defaultRole,
      });
    }

    if (existingUser.status === 'blocked') {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Account has been blocked');
    }

    const userWithRoles = await this.repo.getUserWithRoles(existingUser.id);
    if (!userWithRoles) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to load user profile');
    }

    // Super Admin requires TOTP 2FA verification when logging into admin scope
    if (input.appScope === 'admin') {
      if (!userWithRoles.roles.includes(RoleName.SUPER_ADMIN)) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Super Admin role required');
      }
      const challengeToken = this.tokenSigner.signAccess({
        sub: userWithRoles.id,
        roles: userWithRoles.roles,
        salonId: null,
        twoFactorVerified: false,
      });
      return {
        requiresTwoFactor: true,
        challengeToken,
        user: this.sanitizeUser(userWithRoles),
      };
    }

    return this.issueSessionTokens(userWithRoles, meta, false);
  }

  async setupAdminTotp(userId: string) {
    const user = await this.repo.getUserWithRoles(userId);
    if (!user || !user.roles.includes(RoleName.SUPER_ADMIN)) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Super Admin role required');
    }

    const secret = authenticator.generateSecret();
    const encrypted = encryptSecret(secret, this.env.ADMIN_2FA_ENCRYPTION_KEY);
    await this.repo.saveTotpSecret(userId, encrypted, false);

    const otpauthUrl = authenticator.keyuri(
      user.email ?? user.phone ?? user.id,
      'SalonBridge Admin',
      secret,
    );

    return { secret, otpauthUrl };
  }

  async verifyAdminTotp(
    userId: string,
    code: string,
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    const user = await this.repo.getUserWithRoles(userId);
    if (!user || !user.roles.includes(RoleName.SUPER_ADMIN)) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Super Admin role required');
    }
    if (!user.totpSecretEnc) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'TOTP 2FA has not been set up');
    }

    const secret = decryptSecret(user.totpSecretEnc, this.env.ADMIN_2FA_ENCRYPTION_KEY);
    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid 2FA code');
    }

    if (!user.totpEnabled) {
      await this.repo.saveTotpSecret(user.id, user.totpSecretEnc, true);
      user.totpEnabled = true;
    }

    return this.issueSessionTokens(user, meta, true);
  }

  async refreshSession(
    rawRefreshToken: string,
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    const tokenHash = sha256(rawRefreshToken);
    const session = await this.repo.findActiveSessionByHash(tokenHash);
    if (!session) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    await this.repo.revokeSession(session.id);

    const user = await this.repo.getUserWithRoles(session.userId);
    if (!user || user.status === 'blocked') {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User unavailable');
    }

    return this.issueSessionTokens(user, meta, user.roles.includes(RoleName.SUPER_ADMIN));
  }

  async logout(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) return;
    const session = await this.repo.findActiveSessionByHash(sha256(rawRefreshToken));
    if (session) {
      await this.repo.revokeSession(session.id);
    }
  }

  async getMe(userId: string) {
    const user = await this.repo.getUserWithRoles(userId);
    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'User not found');
    }
    return this.sanitizeUser(user);
  }

  private async issueSessionTokens(
    user: UserWithRoles,
    meta: { userAgent?: string; ipAddress?: string },
    twoFactorVerified: boolean,
  ) {
    const refreshToken = generateRandomToken(32);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.repo.createSession({
      userId: user.id,
      refreshTokenHash: sha256(refreshToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });

    const accessToken = this.tokenSigner.signAccess({
      sub: user.id,
      roles: user.roles,
      salonId: user.salonId,
      twoFactorVerified,
    });

    return {
      requiresTwoFactor: false,
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: UserWithRoles) {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      salonId: user.salonId,
      totpEnabled: user.totpEnabled,
    };
  }
}

