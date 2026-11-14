/**
 * All demo salons and sample mock data have been completely removed.
 * Only base platform setup (seed.ts) is used for roles, plans, and system configs.
 */
export async function seedDemoSalons() {
  console.log('Demo salons have been removed. System runs in clean mode.');
}

if (process.argv[1]?.includes('seed-demo')) {
  seedDemoSalons().catch((err) => {
    console.error('Seed demo error:', err);
    process.exit(1);
  });
}
