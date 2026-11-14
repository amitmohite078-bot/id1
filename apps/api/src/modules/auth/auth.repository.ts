import crypto from 'node:crypto';
import {
  and,
  desc,
  eq,
  gt,
  isNull,
  sql,
  users,
  roles,
  userRoles,
  authSessions,
  otpChallenges,
  salonMembers,
  type Database,
} from '@salonbridge/db';

export interface UserWithRoles {
  id: string;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  status: string;
  totpEnabled: boolean;
  totpSecretEnc: string | null;
  roles: string[];
  salonId: string | null;
}

export class AuthRepository {
  private inMemoryOtps = new Map<
    string,
    {
      id: string;
      phone: string;
      codeHash: string;
      channel: string;
      purpose: string;
      attempts: number;
      expiresAt: Date;
      consumedAt: Date | null;
      createdAt: Date;
    }
  >();

  private inMemoryUsers = new Map<string, UserWithRoles>();

  private inMemorySessions = new Map<
    string,
    {
      id: string;
      userId: string;
      refreshTokenHash: string;
      userAgent?: string;
      ipAddress?: string;
      expiresAt: Date;
      revokedAt: Date | null;
    }
  >();

  constructor(private readonly db: Database) {}

  async createOtpChallenge(input: {
    phone: string;
    codeHash: string;
    channel: string;
    purpose: string;
    expiresAt: Date;
  }) {
    try {
      const [row] = await this.db.insert(otpChallenges).values(input).returning();
      if (row) return row;
    } catch {
      // In-memory fallback if PostgreSQL is not running
    }

    const fallbackRow = {
      id: crypto.randomUUID(),
      phone: input.phone,
      codeHash: input.codeHash,
      channel: input.channel,
      purpose: input.purpose,
      attempts: 0,
      expiresAt: input.expiresAt,
      consumedAt: null,
      createdAt: new Date(),
    };
    this.inMemoryOtps.set(fallbackRow.id, fallbackRow);
    return fallbackRow;
  }

  async findLatestActiveOtp(phone: string) {
    try {
      const [row] = await this.db
        .select()
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.phone, phone),
            isNull(otpChallenges.consumedAt),
            gt(otpChallenges.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(otpChallenges.createdAt))
        .limit(1);
      if (row) return row;
    } catch {
      // In-memory fallback
    }

    const now = new Date();
    const active = Array.from(this.inMemoryOtps.values())
      .filter((o) => o.phone === phone && !o.consumedAt && o.expiresAt > now)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return active[0] ?? null;
  }

  async incrementOtpAttempts(id: string) {
    try {
      await this.db
        .update(otpChallenges)
        .set({ attempts: sql`${otpChallenges.attempts} + 1` })
        .where(eq(otpChallenges.id, id));
    } catch {
      const existing = this.inMemoryOtps.get(id);
      if (existing) {
        existing.attempts += 1;
      }
    }
  }

  async markOtpConsumed(id: string) {
    try {
      await this.db
        .update(otpChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(otpChallenges.id, id));
    } catch {
      const existing = this.inMemoryOtps.get(id);
      if (existing) {
        existing.consumedAt = new Date();
      }
    }
  }

  async findUserByPhone(phone: string) {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (user) return user;
    } catch {
      // In-memory fallback
    }

    for (const u of this.inMemoryUsers.values()) {
      if (u.phone === phone) {
        return {
          id: u.id,
          phone: u.phone,
          email: u.email,
          fullName: u.fullName,
          status: u.status,
          totpEnabled: u.totpEnabled,
          totpSecretEnc: u.totpSecretEnc,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }
    return null;
  }

  async findUserById(id: string) {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
      if (user) return user;
    } catch {
      // In-memory fallback
    }

    const u = this.inMemoryUsers.get(id);
    if (!u) return null;
    return {
      id: u.id,
      phone: u.phone,
      email: u.email,
      fullName: u.fullName,
      status: u.status,
      totpEnabled: u.totpEnabled,
      totpSecretEnc: u.totpSecretEnc,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async createUserWithRole(input: { phone: string; fullName?: string; roleName: string }) {
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            phone: input.phone,
            fullName: input.fullName ?? null,
            status: 'active',
          })
          .returning();

        const [role] = await tx
          .select()
          .from(roles)
          .where(eq(roles.name, input.roleName))
          .limit(1);

        if (user && role) {
          await tx
            .insert(userRoles)
            .values({ userId: user.id, roleId: role.id })
            .onConflictDoNothing();
        }
        return user!;
      });
    } catch {
      // In-memory fallback
    }

    const userId = crypto.randomUUID();
    const newUser: UserWithRoles = {
      id: userId,
      phone: input.phone,
      email: null,
      fullName: input.fullName ?? 'Salon Partner',
      status: 'active',
      totpEnabled: false,
      totpSecretEnc: null,
      roles: [input.roleName],
      salonId: null,
    };
    this.inMemoryUsers.set(userId, newUser);
    return {
      id: newUser.id,
      phone: newUser.phone,
      email: newUser.email,
      fullName: newUser.fullName,
      status: newUser.status,
      totpEnabled: newUser.totpEnabled,
      totpSecretEnc: newUser.totpSecretEnc,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    try {
      const user = await this.findUserById(userId);
      if (user) {
        const assignedRoles = await this.db
          .select({ name: roles.name })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, userId));

        const [membership] = await this.db
          .select({ salonId: salonMembers.salonId })
          .from(salonMembers)
          .where(and(eq(salonMembers.userId, userId), eq(salonMembers.isActive, true)))
          .limit(1);

        return {
          id: user.id,
          phone: user.phone,
          email: user.email,
          fullName: user.fullName,
          status: user.status,
          totpEnabled: user.totpEnabled,
          totpSecretEnc: user.totpSecretEnc,
          roles: assignedRoles.map((r) => r.name),
          salonId: membership?.salonId ?? null,
        };
      }
    } catch {
      // In-memory fallback
    }

    return this.inMemoryUsers.get(userId) ?? null;
  }

  async createSession(input: {
    userId: string;
    refreshTokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    try {
      const [session] = await this.db.insert(authSessions).values(input).returning();
      if (session) return session;
    } catch {
      // In-memory fallback
    }

    const sessionRow = {
      id: crypto.randomUUID(),
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };
    this.inMemorySessions.set(sessionRow.id, sessionRow);
    return sessionRow;
  }

  async findActiveSessionByHash(refreshTokenHash: string) {
    try {
      const [session] = await this.db
        .select()
        .from(authSessions)
        .where(
          and(
            eq(authSessions.refreshTokenHash, refreshTokenHash),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (session) return session;
    } catch {
      // In-memory fallback
    }

    const now = new Date();
    for (const s of this.inMemorySessions.values()) {
      if (s.refreshTokenHash === refreshTokenHash && !s.revokedAt && s.expiresAt > now) {
        return s;
      }
    }
    return null;
  }

  async revokeSession(id: string) {
    try {
      await this.db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(eq(authSessions.id, id));
    } catch {
      const s = this.inMemorySessions.get(id);
      if (s) s.revokedAt = new Date();
    }
  }

  async saveTotpSecret(userId: string, encryptedSecret: string, enabled: boolean) {
    try {
      await this.db
        .update(users)
        .set({ totpSecretEnc: encryptedSecret, totpEnabled: enabled, updatedAt: new Date() })
        .where(eq(users.id, userId));
    } catch {
      const u = this.inMemoryUsers.get(userId);
      if (u) {
        u.totpSecretEnc = encryptedSecret;
        u.totpEnabled = enabled;
      }
    }
  }
}

