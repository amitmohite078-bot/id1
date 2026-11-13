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
  salons,
  salonMembers,
  salonHours,
  staff,
  staffSchedules,
  services,
  staffServices,
  bookings,
  bookingItems,
  reviews,
} from './schema/index.js';
import { RoleName } from '@salonbridge/types';

export async function seedDemoSalons() {
  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://salonbridge:salonbridge_dev@localhost:5432/salonbridge';
  const { db, pool } = createDb(connectionString);

  console.log('Seeding SalonBridge demo salons, catalog, and bookings...');

  // 1. Roles & Plans (Base Seed)
  const roleDefinitions = [
    { name: RoleName.CUSTOMER, description: 'End-user booking salon services' },
    { name: RoleName.SALON_OWNER, description: 'Owner of a salon tenant' },
    { name: RoleName.SALON_MANAGER, description: 'Salon manager' },
    { name: RoleName.SALON_RECEPTIONIST, description: 'Front-desk booking manager' },
    { name: RoleName.SALON_STYLIST, description: 'Salon staff member' },
    { name: RoleName.SUPER_ADMIN, description: 'Platform owner' },
  ];
  for (const r of roleDefinitions) {
    await db.insert(roles).values(r).onConflictDoNothing({ target: roles.name });
  }

  const [ownerRole] = await db.select().from(roles).where(eq(roles.name, RoleName.SALON_OWNER)).limit(1);
  const [customerRole] = await db.select().from(roles).where(eq(roles.name, RoleName.CUSTOMER)).limit(1);

  // 2. Demo Salon Owner Users
  const owner1Phone = '+919811111111';
  let [owner1] = await db.select().from(users).where(eq(users.phone, owner1Phone)).limit(1);
  if (!owner1) {
    [owner1] = await db
      .insert(users)
      .values({
        phone: owner1Phone,
        email: 'priya@glowstudio.in',
        fullName: 'Priya Nair',
        status: 'active',
      })
      .returning();
    if (owner1 && ownerRole) {
      await db.insert(userRoles).values({ userId: owner1.id, roleId: ownerRole.id });
    }
  }

  const owner2Phone = '+919822222222';
  let [owner2] = await db.select().from(users).where(eq(users.phone, owner2Phone)).limit(1);
  if (!owner2) {
    [owner2] = await db
      .insert(users)
      .values({
        phone: owner2Phone,
        email: 'rohit@urbanclippers.in',
        fullName: 'Rohit Verma',
        status: 'active',
      })
      .returning();
    if (owner2 && ownerRole) {
      await db.insert(userRoles).values({ userId: owner2.id, roleId: ownerRole.id });
    }
  }

  // 3. Demo Customer User
  const custPhone = '+919833333333';
  let [demoCustomer] = await db.select().from(users).where(eq(users.phone, custPhone)).limit(1);
  if (!demoCustomer) {
    [demoCustomer] = await db
      .insert(users)
      .values({
        phone: custPhone,
        email: 'ananya@example.com',
        fullName: 'Ananya Sen',
        status: 'active',
      })
      .returning();
    if (demoCustomer && customerRole) {
      await db.insert(userRoles).values({ userId: demoCustomer.id, roleId: customerRole.id });
    }
  }

  // 4. Demo Salons in Bengaluru
  let [salon1] = await db.select().from(salons).where(eq(salons.slug, 'glow-studio-indiranagar')).limit(1);
  if (!salon1 && owner1) {
    [salon1] = await db
      .insert(salons)
      .values({
        ownerId: owner1.id,
        slug: 'glow-studio-indiranagar',
        name: 'Glow Luxury Studio & Spa',
        description: 'Premium organic hair care, luxury facials, and bridal makeovers in Indiranagar.',
        status: 'approved',
        genderFocus: 'unisex',
        phone: '+919811111111',
        email: 'contact@glowstudio.in',
        addressLine1: '100ft Road, HAL 2nd Stage, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        location: { lat: 12.9716, lng: 77.6412 },
        gstin: '29ABCDE1234F1Z5',
        slotIntervalMinutes: 30,
        bufferMinutes: 10,
        maxConcurrentBookings: 6,
        avgRating: '4.85',
        reviewCount: 42,
        isFeatured: true,
        commissionRateBps: 800,
        amenities: ['Wi-Fi', 'AC', 'Card Accepted', 'Parking', 'Beverages'],
      })
      .returning();

    await db.insert(salonMembers).values({
      salonId: salon1!.id,
      userId: owner1.id,
      role: RoleName.SALON_OWNER,
    });

    // Hours
    for (let day = 0; day < 7; day++) {
      await db.insert(salonHours).values({
        salonId: salon1!.id,
        dayOfWeek: day,
        openTime: '10:00',
        closeTime: '21:00',
        isClosed: false,
      });
    }

    // Staff
    const [stylist1] = await db
      .insert(staff)
      .values({
        salonId: salon1!.id,
        displayName: 'Aarav Mehta',
        title: 'Master Stylist & Colorist',
      })
      .returning();

    for (let day = 0; day < 7; day++) {
      await db.insert(staffSchedules).values({
        salonId: salon1!.id,
        staffId: stylist1!.id,
        dayOfWeek: day,
        startTime: '10:00',
        endTime: '20:00',
        breakStart: '14:00',
        breakEnd: '15:00',
        isOff: day === 1, // Mon off
      });
    }

    // Services
    const [s1] = await db
      .insert(services)
      .values({
        salonId: salon1!.id,
        name: 'Signature Haircut & Blowdry',
        description: 'Consultation, hair wash, scalp massage, custom haircut and blowdry styling.',
        pricePaise: 89900,
        durationMinutes: 45,
        genderTag: 'unisex',
      })
      .returning();

    const [s2] = await db
      .insert(services)
      .values({
        salonId: salon1!.id,
        name: 'Hydra-Dew Facial',
        description: 'Deep hydration facial restoring natural radiance.',
        pricePaise: 249900,
        durationMinutes: 60,
        genderTag: 'unisex',
      })
      .returning();

    if (stylist1 && s1 && s2) {
      await db.insert(staffServices).values([
        { staffId: stylist1.id, serviceId: s1.id },
        { staffId: stylist1.id, serviceId: s2.id },
      ]);
    }
  }

  let [salon2] = await db.select().from(salons).where(eq(salons.slug, 'urban-clippers-koramangala')).limit(1);
  if (!salon2 && owner2) {
    [salon2] = await db
      .insert(salons)
      .values({
        ownerId: owner2.id,
        slug: 'urban-clippers-koramangala',
        name: 'Urban Clippers Barbershop',
        description: 'Classic grooming, fades, beard sculpts, and hot towel treatments in Koramangala.',
        status: 'approved',
        genderFocus: 'men',
        phone: '+919822222222',
        email: 'info@urbanclippers.in',
        addressLine1: '80ft Road, 4th Block, Koramangala',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
        location: { lat: 12.9352, lng: 77.6245 },
        gstin: '29FGHIJ5678K1Z2',
        slotIntervalMinutes: 20,
        bufferMinutes: 5,
        maxConcurrentBookings: 4,
        avgRating: '4.65',
        reviewCount: 28,
        isFeatured: false,
        commissionRateBps: 1000,
        amenities: ['Wi-Fi', 'AC', 'UPI Accepted', 'PlayStation Lounge'],
      })
      .returning();

    await db.insert(salonMembers).values({
      salonId: salon2!.id,
      userId: owner2.id,
      role: RoleName.SALON_OWNER,
    });

    for (let day = 0; day < 7; day++) {
      await db.insert(salonHours).values({
        salonId: salon2!.id,
        dayOfWeek: day,
        openTime: '09:00',
        closeTime: '21:00',
        isClosed: false,
      });
    }

    const [barber] = await db
      .insert(staff)
      .values({
        salonId: salon2!.id,
        displayName: 'Kabir Khan',
        title: 'Senior Barber',
      })
      .returning();

    for (let day = 0; day < 7; day++) {
      await db.insert(staffSchedules).values({
        salonId: salon2!.id,
        staffId: barber!.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '21:00',
        isOff: day === 2, // Tue off
      });
    }

    const [s3] = await db
      .insert(services)
      .values({
        salonId: salon2!.id,
        name: 'Classic Skin Fade & Beard Sculpt',
        description: 'Precision clipper fade with razor finish and beard oil treatment.',
        pricePaise: 49900,
        durationMinutes: 30,
        genderTag: 'men',
      })
      .returning();

    if (barber && s3) {
      await db.insert(staffServices).values([{ staffId: barber.id, serviceId: s3.id }]);
    }
  }

  console.log('Demo salons seeded successfully.');
  await pool.end();
}

if (process.argv[1]?.includes('seed-demo')) {
  seedDemoSalons().catch((err) => {
    console.error('Seed demo failed:', err);
    process.exit(1);
  });
}

