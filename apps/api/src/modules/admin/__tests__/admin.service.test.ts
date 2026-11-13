import { describe, it, expect, vi } from 'vitest';
import { AdminService } from '../admin.service.js';
import type { AdminRepository } from '../admin.repository.js';
import type { SalonRepository } from '../../salon/salon.repository.js';

describe('AdminService', () => {
  it('approves a salon, updates commission, and logs to audit trail', async () => {
    const mockRepo = {
      updateSalonStatus: vi.fn().mockResolvedValue({ id: 's1', status: 'approved' }),
      logAudit: vi.fn().mockResolvedValue(undefined),
    } as unknown as AdminRepository;

    const mockSalonRepo = {
      findSalonById: vi.fn().mockResolvedValue({ id: 's1', name: 'Glow Studio' }),
    } as unknown as SalonRepository;

    const service = new AdminService(mockRepo, mockSalonRepo);

    const res = await service.updateSalonStatus(
      's1',
      'admin-1',
      { status: 'approved', commissionRateBps: 800, reason: 'Verified GSTIN' },
      '127.0.0.1',
    );

    expect(res).toEqual({ id: 's1', status: 'approved' });
    expect(mockRepo.updateSalonStatus).toHaveBeenCalledWith('s1', 'approved', 800);
    expect(mockRepo.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'salon_status_approved',
        resourceType: 'salon',
        resourceId: 's1',
      }),
    );
  });
});

