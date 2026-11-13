# SalonBridge

Multi-tenant SaaS salon marketplace monorepo built with **Turborepo**, **pnpm**, **Next.js (App Router)**, **Fastify**, **Drizzle ORM**, **PostgreSQL + PostGIS**, **Redis + BullMQ**, and **MinIO/S3**.

## Apps & Packages

- `apps/customer-web` — Customer discovery, comparison, booking, and reviews (`http://localhost:3000`)
- `apps/salon-web` — Salon Dashboard: onboarding, AI menu import, calendar, CRM, payouts (`http://localhost:3001`)
- `apps/admin-web` — Super Admin Panel: approvals, 2FA, moderation, analytics (`http://localhost:3002`)
- `apps/api` — Fastify REST API + OpenAPI/Swagger + BullMQ workers (`http://localhost:4000`)
- `packages/db` — Drizzle ORM schema, PostGIS helpers, migrations, and seed scripts
- `packages/types` — Shared Zod validation schemas, DTOs, and error codes
- `packages/ui` — Shared React UI primitives and Tailwind utilities
- `packages/config` — Shared TypeScript configs

## Quick Start

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Start local infrastructure (Postgres+PostGIS, Redis, MinIO):
   ```bash
   docker compose up -d
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Run database migrations and seed data:
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```
5. Start all apps in dev mode:
   ```bash
   pnpm dev
   ```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full system architecture and ERD.

