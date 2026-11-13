import type { FastifyInstance } from 'fastify';
import type { DbPool } from '@salonbridge/db';
import type { Redis } from 'ioredis';

export function registerHealthRoutes(app: FastifyInstance, deps: { pool: DbPool; redis: Redis }) {
  app.get('/health/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
    },
    handler: async () => ({ status: 'ok', timestamp: new Date().toISOString() }),
  });

  app.get('/health/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe (PostgreSQL + Redis)',
    },
    handler: async (_request, reply) => {
      const checks: Record<string, string> = { postgres: 'down', redis: 'down' };
      try {
        await deps.pool.query('SELECT 1');
        checks.postgres = 'up';
      } catch {
        checks.postgres = 'down';
      }
      try {
        const pong = await deps.redis.ping();
        checks.redis = pong === 'PONG' ? 'up' : 'down';
      } catch {
        checks.redis = 'down';
      }

      const healthy = checks.postgres === 'up' && checks.redis === 'up';
      return reply.status(healthy ? 200 : 503).send({
        status: healthy ? 'ready' : 'degraded',
        checks,
      });
    },
  });
}

