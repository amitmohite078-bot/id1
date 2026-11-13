import {
  ErrorCode,
  type AdminSalonListQuery,
  type CreateCouponSchema,
  type CreatePlanSchema,
  type ModerateReviewSchema,
  type UpdateSalonStatusSchema,
  type UpdateUserStatusSchema,
} from '@salonbridge/types';
import { AppError } from '../../lib/errors.js';
import type { AdminRepository } from './admin.repository.js';
import type { SalonRepository } from '../salon/salon.repository.js';

export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly salonRepo: SalonRepository,
  ) {}

  async listSalons(query: AdminSalonListQuery) {
    return this.repo.listSalons(query);
  }

  async updateSalonStatus(
    salonId: string,
    adminId: string,
    input: typeof UpdateSalonStatusSchema._type,
    ipAddress?: string,
  ) {
    const salon = await this.salonRepo.findSalonById(salonId);
    if (!salon) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Salon not found');
    }

    const updated = await this.repo.updateSalonStatus(
      salonId,
      input.status,
      input.commissionRateBps,
    );

    await this.repo.logAudit({
      actorUserId: adminId,
      action: `salon_status_${input.status}`,
      resourceType: 'salon',
      resourceId: salonId,
      ipAddress,
      metadata: { reason: input.reason, commissionRateBps: input.commissionRateBps },
    });

    return updated;
  }

  async updateUserStatus(
    userId: string,
    adminId: string,
    input: typeof UpdateUserStatusSchema._type,
    ipAddress?: string,
  ) {
    const updated = await this.repo.updateUserStatus(userId, input.status);
    if (!updated) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'User not found');
    }

    await this.repo.logAudit({
      actorUserId: adminId,
      action: `user_status_${input.status}`,
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
      metadata: { reason: input.reason },
    });

    return updated;
  }

  async listUsers(page?: number, limit?: number) {
    return this.repo.listUsers(page, limit);
  }

  async getPlatformMetrics() {
    return this.repo.getPlatformMetrics();
  }

  // Plans & Coupons
  async listPlans() {
    return this.repo.listPlans();
  }

  async createPlan(input: typeof CreatePlanSchema._type, adminId: string, ipAddress?: string) {
    const plan = await this.repo.createPlan(input);
    await this.repo.logAudit({
      actorUserId: adminId,
      action: 'create_plan',
      resourceType: 'plan',
      resourceId: plan.id,
      ipAddress,
      metadata: { code: plan.code },
    });
    return plan;
  }

  async listCoupons() {
    return this.repo.listCoupons();
  }

  async createCoupon(input: typeof CreateCouponSchema._type, adminId: string, ipAddress?: string) {
    const coupon = await this.repo.createCoupon({
      ...input,
      validFrom: new Date(input.validFrom),
      validUntil: new Date(input.validUntil),
    });
    await this.repo.logAudit({
      actorUserId: adminId,
      action: 'create_coupon',
      resourceType: 'coupon',
      resourceId: coupon.id,
      ipAddress,
      metadata: { code: coupon.code },
    });
    return coupon;
  }

  // Moderation & Audit Logs
  async listReportedReviews() {
    return this.repo.listReportedReviews();
  }

  async moderateReview(
    reviewId: string,
    adminId: string,
    input: typeof ModerateReviewSchema._type,
    ipAddress?: string,
  ) {
    const updated = await this.repo.setReviewVisibility(reviewId, input.isHidden);
    if (!updated) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Review not found');
    }

    await this.repo.logAudit({
      actorUserId: adminId,
      action: input.isHidden ? 'hide_review' : 'unhide_review',
      resourceType: 'review',
      resourceId: reviewId,
      ipAddress,
      metadata: { reason: input.reason },
    });

    return updated;
  }

  async listAuditLogs(limit?: number) {
    return this.repo.listAuditLogs(limit);
  }
}

