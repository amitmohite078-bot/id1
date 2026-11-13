import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { Redis } from 'ioredis';
import type { Database, DbPool } from '@salonbridge/db';
import type { AppEnv } from './config/env.js';
import { Queue, Worker } from 'bullmq';
import { formatErrorHandler } from './lib/errors.js';
import { createOtpProvider } from './lib/otp-provider.js';
import { StorageService } from './lib/storage.js';
import { registerHealthRoutes } from './modules/health/health.routes.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { SalonRepository } from './modules/salon/salon.repository.js';
import { SalonService } from './modules/salon/salon.service.js';
import { registerSalonRoutes } from './modules/salon/salon.routes.js';
import { MenuImportRepository } from './modules/menu-import/menu-import.repository.js';
import {
  ClaudeMenuExtractor,
  MockMenuAiExtractor,
} from './modules/menu-import/menu.ai-extractor.js';
import { MenuImportService } from './modules/menu-import/menu-import.service.js';
import { registerMenuImportRoutes } from './modules/menu-import/menu-import.routes.js';
import { createPaymentProvider } from './lib/payment-provider.js';
import { DiscoveryRepository } from './modules/customer/discovery.repository.js';
import { BookingRepository } from './modules/customer/booking.repository.js';
import { CustomerService } from './modules/customer/customer.service.js';
import { registerCustomerRoutes } from './modules/customer/customer.routes.js';
import { MultiChannelNotificationDispatcher } from './lib/notification-dispatcher.js';
import { SalonOpsRepository } from './modules/salon-ops/salon-ops.repository.js';
import { SalonOpsService } from './modules/salon-ops/salon-ops.service.js';
import { registerSalonOpsRoutes } from './modules/salon-ops/salon-ops.routes.js';
import { AdminRepository } from './modules/admin/admin.repository.js';
import { AdminService } from './modules/admin/admin.service.js';
import { registerAdminRoutes } from './modules/admin/admin.routes.js';

export interface BuildAppDeps {
  env: AppEnv;
  db: Database;
  pool: DbPool;
  redis: Redis;
}

export async function buildApp(deps: BuildAppDeps) {
  const app = Fastify({
    logger: {
      level: deps.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        deps.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(formatErrorHandler);

  await app.register(helmet);

  const allowedOrigins = deps.env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  await app.register(cookie, {
    secret: deps.env.COOKIE_SECRET,
  });

  await app.register(jwt, {
    secret: deps.env.JWT_ACCESS_SECRET,
    cookie: {
      cookieName: 'sb_access',
      signed: false,
    },
    sign: {
      expiresIn: '15m',
    },
  });

  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    ...(deps.redis.status === 'ready' ? { redis: deps.redis } : {}),
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SalonBridge API',
        description: 'Multi-tenant SaaS Salon Marketplace REST API',
        version: '0.1.0',
      },
      servers: [{ url: `http://localhost:${deps.env.API_PORT}` }],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  registerHealthRoutes(app, { pool: deps.pool, redis: deps.redis });

  const authRepo = new AuthRepository(deps.db);
  const otpProvider = createOtpProvider(deps.env, app.log);
  const authService = new AuthService(
    authRepo,
    otpProvider,
    {
      signAccess: (payload) => app.jwt.sign(payload),
    },
    deps.env,
  );

  registerAuthRoutes(app, authService);

  const salonRepo = new SalonRepository(deps.db);
  const salonService = new SalonService(salonRepo, deps.env.CUSTOMER_WEB_URL);
  registerSalonRoutes(app, salonService);

  const storage = new StorageService(deps.env);
  const menuImportRepo = new MenuImportRepository(deps.db);
  const aiExtractor = deps.env.ANTHROPIC_API_KEY
    ? new ClaudeMenuExtractor(deps.env.ANTHROPIC_API_KEY, deps.env.CLAUDE_MODEL)
    : new MockMenuAiExtractor();

  let menuQueue: Queue | undefined;
  let menuWorker: Worker | undefined;
  const menuImportService = new MenuImportService(
    menuImportRepo,
    storage,
    aiExtractor,
    deps.redis.status === 'ready'
      ? {
          enqueue: async (payload) => {
            await menuQueue!.add('process-menu', payload, {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
            });
          },
        }
      : undefined,
  );

  if (deps.redis.status === 'ready') {
    menuQueue = new Queue('menu-import', { connection: deps.redis });
    menuWorker = new Worker(
      'menu-import',
      async (job) => {
        const data = job.data as { jobId: string; rawText?: string };
        await menuImportService.processJob(data.jobId, data.rawText);
      },
      { connection: deps.redis },
    );
    app.addHook('onClose', async () => {
      await menuWorker?.close();
      await menuQueue?.close();
    });
  }

  registerMenuImportRoutes(app, menuImportService);

  const paymentProvider = createPaymentProvider(deps.env);
  const discoveryRepo = new DiscoveryRepository(deps.db);
  const bookingRepo = new BookingRepository(deps.db);
  const customerService = new CustomerService(
    discoveryRepo,
    bookingRepo,
    salonRepo,
    paymentProvider,
  );
  registerCustomerRoutes(app, customerService);

  const notifications = new MultiChannelNotificationDispatcher(deps.env, app.log);
  const salonOpsRepo = new SalonOpsRepository(deps.db);
  const salonOpsService = new SalonOpsService(
    salonOpsRepo,
    salonRepo,
    bookingRepo,
    authRepo,
    notifications,
  );
  registerSalonOpsRoutes(app, salonOpsService);

  const adminRepo = new AdminRepository(deps.db);
  const adminService = new AdminService(adminRepo, salonRepo);
  registerAdminRoutes(app, adminService, deps.env.ADMIN_IP_ALLOWLIST);

  return app;
}

