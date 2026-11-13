import {
  and,
  asc,
  desc,
  eq,
  gte,
  sql,
  menuImportJobs,
  menuImportItems,
  menuVersions,
  serviceCategories,
  services,
  subscriptions,
  plans,
  type Database,
} from '@salonbridge/db';
import type { ExtractedMenuItem, UpdateMenuImportItemInput } from '@salonbridge/types';

export class MenuImportRepository {
  constructor(private readonly db: Database) {}

  async countJobsSince(salonId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(menuImportJobs)
      .where(and(eq(menuImportJobs.salonId, salonId), gte(menuImportJobs.createdAt, since)));
    return row?.count ?? 0;
  }

  async getMonthlyImportLimit(salonId: string): Promise<number> {
    const [sub] = await this.db
      .select({ limit: plans.aiImportsPerMonth })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(and(eq(subscriptions.salonId, salonId), eq(subscriptions.status, 'active')))
      .limit(1);
    return sub?.limit ?? 2; // Free tier default
  }

  async createJob(input: {
    salonId: string;
    uploadedBy: string;
    sourceType: string;
    fileKey: string;
  }) {
    const [job] = await this.db
      .insert(menuImportJobs)
      .values({
        salonId: input.salonId,
        uploadedBy: input.uploadedBy,
        sourceType: input.sourceType,
        fileKey: input.fileKey,
        status: 'queued',
      })
      .returning();
    return job!;
  }

  async listJobs(salonId: string) {
    return this.db
      .select()
      .from(menuImportJobs)
      .where(eq(menuImportJobs.salonId, salonId))
      .orderBy(desc(menuImportJobs.createdAt))
      .limit(30);
  }

  async getJobById(jobId: string) {
    const [job] = await this.db
      .select()
      .from(menuImportJobs)
      .where(eq(menuImportJobs.id, jobId))
      .limit(1);
    return job ?? null;
  }

  async getJobWithItems(salonId: string, jobId: string) {
    const [job] = await this.db
      .select()
      .from(menuImportJobs)
      .where(and(eq(menuImportJobs.id, jobId), eq(menuImportJobs.salonId, salonId)))
      .limit(1);

    if (!job) return null;

    const items = await this.db
      .select()
      .from(menuImportItems)
      .where(and(eq(menuImportItems.jobId, jobId), eq(menuImportItems.salonId, salonId)))
      .orderBy(asc(menuImportItems.categoryName), asc(menuImportItems.serviceName));

    return { job, items };
  }

  async markJobProcessing(jobId: string) {
    await this.db
      .update(menuImportJobs)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(menuImportJobs.id, jobId));
  }

  async completeJobWithItems(input: {
    jobId: string;
    salonId: string;
    items: ExtractedMenuItem[];
    inputTokens: number;
    outputTokens: number;
    costPaise: number;
    rawOutput: unknown;
  }) {
    return this.db.transaction(async (tx) => {
      if (input.items.length > 0) {
        await tx.insert(menuImportItems).values(
          input.items.map((item) => ({
            jobId: input.jobId,
            salonId: input.salonId,
            categoryName: item.categoryName,
            serviceName: item.serviceName,
            description: item.description ?? null,
            pricePaise: item.pricePaise,
            maxPricePaise: item.maxPricePaise ?? null,
            isStartingFrom: item.isStartingFrom,
            durationMinutes: item.durationMinutes,
            genderTag: item.genderTag,
            confidence: String(item.confidence.toFixed(2)),
            reviewStatus: item.pricePaise && item.confidence >= 0.8 ? 'approved' : 'pending',
            flags: item.flags,
          })),
        );
      }

      const [updated] = await tx
        .update(menuImportJobs)
        .set({
          status: 'review_ready',
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costPaise: input.costPaise,
          rawOutput: input.rawOutput,
          updatedAt: new Date(),
        })
        .where(eq(menuImportJobs.id, input.jobId))
        .returning();

      return updated!;
    });
  }

  async failJob(jobId: string, errorMessage: string) {
    await this.db
      .update(menuImportJobs)
      .set({ status: 'failed', errorMessage, updatedAt: new Date() })
      .where(eq(menuImportJobs.id, jobId));
  }

  async updateImportItem(
    salonId: string,
    jobId: string,
    itemId: string,
    patch: UpdateMenuImportItemInput,
  ) {
    const [updated] = await this.db
      .update(menuImportItems)
      .set(patch)
      .where(
        and(
          eq(menuImportItems.id, itemId),
          eq(menuImportItems.jobId, jobId),
          eq(menuImportItems.salonId, salonId),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async getSalonServices(salonId: string) {
    return this.db.select().from(services).where(eq(services.salonId, salonId));
  }

  async publishApprovedItems(input: {
    salonId: string;
    jobId: string;
    userId: string;
    approvedItems: Array<{
      categoryName: string;
      serviceName: string;
      description: string | null;
      pricePaise: number;
      durationMinutes: number;
      genderTag: string;
    }>;
  }) {
    return this.db.transaction(async (tx) => {
      // 1. Snapshot current menu into menu_versions before applying
      const existingServices = await tx
        .select()
        .from(services)
        .where(eq(services.salonId, input.salonId));
      const existingCats = await tx
        .select()
        .from(serviceCategories)
        .where(eq(serviceCategories.salonId, input.salonId));

      const [latestVer] = await tx
        .select({ maxVer: sql<number>`coalesce(max(${menuVersions.versionNumber}), 0)::int` })
        .from(menuVersions)
        .where(eq(menuVersions.salonId, input.salonId));

      const nextVersion = (latestVer?.maxVer ?? 0) + 1;
      await tx.insert(menuVersions).values({
        salonId: input.salonId,
        versionNumber: nextVersion,
        importJobId: input.jobId,
        snapshot: { categories: existingCats, services: existingServices },
        createdBy: input.userId,
      });

      // 2. Ensure categories exist and upsert services by (salonId, lowercase name)
      const categoryIdByName = new Map<string, string>();
      for (const c of existingCats) {
        categoryIdByName.set(c.name.toLowerCase(), c.id);
      }

      const existingByName = new Map<string, (typeof existingServices)[number]>();
      for (const s of existingServices) {
        existingByName.set(s.name.toLowerCase(), s);
      }

      let createdCount = 0;
      let updatedCount = 0;

      for (const item of input.approvedItems) {
        let catId = categoryIdByName.get(item.categoryName.toLowerCase());
        if (!catId) {
          const slug = item.categoryName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          const [newCat] = await tx
            .insert(serviceCategories)
            .values({
              salonId: input.salonId,
              name: item.categoryName,
              slug: `${slug || 'cat'}-${Date.now().toString(36)}`,
            })
            .returning();
          catId = newCat!.id;
          categoryIdByName.set(item.categoryName.toLowerCase(), catId);
        }

        const existingSvc = existingByName.get(item.serviceName.toLowerCase());
        if (existingSvc) {
          await tx
            .update(services)
            .set({
              categoryId: catId,
              description: item.description,
              pricePaise: item.pricePaise,
              durationMinutes: item.durationMinutes,
              genderTag: item.genderTag,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(and(eq(services.id, existingSvc.id), eq(services.salonId, input.salonId)));
          updatedCount++;
        } else {
          await tx.insert(services).values({
            salonId: input.salonId,
            categoryId: catId,
            name: item.serviceName,
            description: item.description,
            pricePaise: item.pricePaise,
            durationMinutes: item.durationMinutes,
            genderTag: item.genderTag,
          });
          createdCount++;
        }
      }

      await tx
        .update(menuImportJobs)
        .set({ status: 'published', updatedAt: new Date() })
        .where(and(eq(menuImportJobs.id, input.jobId), eq(menuImportJobs.salonId, input.salonId)));

      return { versionNumber: nextVersion, createdCount, updatedCount };
    });
  }

  async listVersions(salonId: string) {
    return this.db
      .select()
      .from(menuVersions)
      .where(eq(menuVersions.salonId, salonId))
      .orderBy(desc(menuVersions.versionNumber))
      .limit(20);
  }

  async rollbackToVersion(salonId: string, versionNumber: number, userId: string) {
    return this.db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(menuVersions)
        .where(
          and(eq(menuVersions.salonId, salonId), eq(menuVersions.versionNumber, versionNumber)),
        )
        .limit(1);

      if (!target) return null;

      const snapshot = target.snapshot as {
        services: Array<{
          id: string;
          categoryId: string | null;
          name: string;
          description: string | null;
          pricePaise: number;
          durationMinutes: number;
          genderTag: string;
          isActive: boolean;
        }>;
      };

      // Snapshot current before rollback
      const currentServices = await tx
        .select()
        .from(services)
        .where(eq(services.salonId, salonId));
      const [latestVer] = await tx
        .select({ maxVer: sql<number>`coalesce(max(${menuVersions.versionNumber}), 0)::int` })
        .from(menuVersions)
        .where(eq(menuVersions.salonId, salonId));

      await tx.insert(menuVersions).values({
        salonId,
        versionNumber: (latestVer?.maxVer ?? 0) + 1,
        snapshot: { services: currentServices },
        createdBy: userId,
      });

      await tx.delete(services).where(eq(services.salonId, salonId));
      if (snapshot.services && snapshot.services.length > 0) {
        await tx.insert(services).values(
          snapshot.services.map((s) => ({
            salonId,
            categoryId: s.categoryId,
            name: s.name,
            description: s.description,
            pricePaise: s.pricePaise,
            durationMinutes: s.durationMinutes,
            genderTag: s.genderTag,
            isActive: s.isActive,
          })),
        );
      }

      return { restoredVersion: versionNumber, restoredCount: snapshot.services?.length ?? 0 };
    });
  }
}

