import fs from 'node:fs';
import { Redis } from 'ioredis';
import { createDb } from '@salonbridge/db';
import { loadEnv } from './config/env.js';
import { buildApp } from './app.js';

if (fs.existsSync('.env')) {
  process.loadEnvFile?.('.env');
}

async function start() {
  const env = loadEnv();
  const { db, pool } = createDb(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });
  redis.on('error', (err) => {
    if (env.NODE_ENV !== 'production') {
      console.warn('[Redis] connection warning:', err.message);
    }
  });

  try {
    await redis.connect();
  } catch {
    console.warn('[Redis] unavailable at startup; using in-memory rate-limit fallback');
  }

  const app = await buildApp({ env, db, pool, redis });

  const shutdown = async () => {
    app.log.info('Shutting down SalonBridge API...');
    await app.close();
    await pool.end();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: env.API_PORT, host: env.API_HOST });
}

start().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});

