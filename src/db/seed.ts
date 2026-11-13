import { eq } from 'drizzle-orm';
import { createDb } from './client.js';
import {
  roles,
  plans,
  platformConfigs,
  serviceCategories,
  users,
  userRoles,
  featureFlags,
} from './schema/index.js';
import { RoleName } from '@salonbridge/types';

async function seed() {
  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://salonbridge:salonbridge_dev@localhost:5432/salonbridge';
  const { db, pool } = createDb(connectionString);

  console.log('Seeding SalonBridge database...');

  // 1. Roles
  const roleDefinitions = [
    { name: RoleName.CUSTOMER, description: 'End-user booking salon services' },
    { name: RoleName.SALON_OWNER, description: 'Owner of a salon tenant' },
    { name: RoleName.SALON_MANAGER, description: 'Salon manager with full operational access' },
    { name: RoleName.SALON_RECEPTIONIST, description: 'Front-desk booking & walk-in manager' },
    { name: RoleName.SALON_STYLIST, description: 'Salon staff member viewing own schedule' },
    { name: RoleName.SUPER_ADMIN, description: 'Platform owner with 2FA-enforced access' },
  ];

  for (const r of roleDefinitions) {
    await db
      .insert(roles)
      .values(r)
      .onConflictDoNothing({ target: roles.name });
  }

  // 2. Subscription Plans
  const planDefinitions = [
    {
      code: 'free',
      name: 'Free Starter',
      monthlyPricePaise: 0,
      aiImportsPerMonth: 2,
      maxStaff: 5,
      commissionRateBps: 1000, // 10%
      features: { analytics: false, customNotifications: false, featuredEligible: false },
    },
    {
      code: 'basic',
      name: 'Basic Growth',
      monthlyPricePaise: 99900, // INR 999
      aiImportsPerMonth: 10,
      maxStaff: 15,
      commissionRateBps: 800, // 8%
      features: { analytics: true, customNotifications: true, featuredEligible: true },
    },
    {
      code: 'pro',
      name: 'Pro Studio',
      monthlyPricePaise: 249900, // INR 2,499
      aiImportsPerMonth: 50,
      maxStaff: 100,
      commissionRateBps: 500, // 5%
      features: { analytics: true, customNotifications: true, featuredEligible: true },
    },
  ];

  for (const p of planDefinitions) {
    await db
      .insert(plans)
      .values(p)
      .onConflictDoNothing({ target: plans.code });
  }

  // 3. Global Service Categories
  const categories = [
    { name: 'Haircut & Styling', slug: 'haircut-styling', sortOrder: 1 },
    { name: 'Hair Color & Treatment', slug: 'hair-color-treatment', sortOrder: 2 },
    { name: 'Facial & Skincare', slug: 'facial-skincare', sortOrder: 3 },
    { name: 'Spa & Massage', slug: 'spa-massage', sortOrder: 4 },
    { name: 'Bridal & Makeup', slug: 'bridal-makeup', sortOrder: 5 },
    { name: 'Nails & Pedicure', slug: 'nails-pedicure', sortOrder: 6 },
    { name: 'Beard & Grooming', slug: 'beard-grooming', sortOrder: 7 },
  ];

  for (const cat of categories) {
    const existing = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.slug, cat.slug))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(serviceCategories).values({ ...cat, salonId: null });
    }
  }

  // 4. Platform-enforced Cancellation Policy & Defaults
  await db
    .insert(platformConfigs)
    .values({
      key: 'cancellation_policy',
      value: {
        freeCancelHoursBefore: 4,
        lateCancelRefundPercent: 50,
        noShowRefundPercent: 0,
        slotHoldTtlMinutes: 7,
      },
      description: 'Platform-enforced standard cancellation and slot-hold policy',
    })
    .onConflictDoNothing({ target: platformConfigs.key });

  // 5. Feature Flags
  await db
    .insert(featureFlags)
    .values([
      {
        key: 'ai_menu_import_enabled',
        enabled: true,
        description: 'Enable AI-powered menu extraction pipeline',
      },
      {
        key: 'pay_at_salon_enabled',
        enabled: true,
        description: 'Allow customers to choose Pay at Salon',
      },
    ])
    .onConflictDoNothing({ target: featureFlags.key });

  // 6. Seed Default Super Admin user (for local dev)
  const adminPhone = '+919999999999';
  let [adminUser] = await db.select().from(users).where(eq(users.phone, adminPhone)).limit(1);
  if (!adminUser) {
    [adminUser] = await db
      .insert(users)
      .values({
        phone: adminPhone,
        email: 'admin@salonbridge.in',
        fullName: 'Platform Owner',
        status: 'active',
      })
      .returning();
  }

  const [superAdminRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, RoleName.SUPER_ADMIN))
    .limit(1);

  if (adminUser && superAdminRole) {
    await db
      .insert(userRoles)
      .values({ userId: adminUser.id, roleId: superAdminRole.id })
      .onConflictDoNothing();
  }

  console.log('Seed completed.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

