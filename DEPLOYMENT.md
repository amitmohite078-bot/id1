# SalonBridge — Production Deployment & Operations Guide

This guide covers production deployment for the **SalonBridge** platform across:
- **Frontends (3 Next.js apps):** Vercel
- **Backend API & BullMQ Workers:** Railway / Render / AWS ECS
- **Database:** Managed PostgreSQL 16 with PostGIS extension (Supabase / Neon / AWS RDS)
- **Redis Cache & Queues:** Managed Redis 7 (Upstash / Railway Redis / AWS ElastiCache)
- **Object Storage:** Cloudflare R2 / AWS S3

---

## 1. Architecture Summary

| Component | Technology | Target Hosting | Ports / Domain |
| :--- | :--- | :--- | :--- |
| **Customer App** | Next.js 15 (App Router) | Vercel | `salonbridge.in` (:3000 in dev) |
| **Salon Dashboard** | Next.js 15 (App Router) | Vercel | `partner.salonbridge.in` (:3001 in dev) |
| **Super Admin** | Next.js 15 (App Router) | Vercel | `admin.salonbridge.in` (:3002 in dev) |
| **Backend REST API** | Fastify 5 + Drizzle + BullMQ | Railway / Render / Docker | `api.salonbridge.in` (:4000 in dev) |
| **Database** | PostgreSQL 16 + PostGIS | Neon / Supabase / RDS | Port 5432 |
| **Cache & Queues** | Redis 7 | Upstash / Railway | Port 6379 |
| **Media & Menus** | S3 API compatible | Cloudflare R2 / AWS S3 | HTTPS |

---

## 2. Environment Variables Checklist

### Backend API (`apps/api`)
```ini
NODE_ENV=production
API_PORT=4000
API_HOST=0.0.0.0
API_BASE_URL=https://api.salonbridge.in

# Database & Cache
DATABASE_URL=postgresql://user:pass@host:5432/salonbridge?sslmode=require
REDIS_URL=rediss://default:pass@host:6379

# Security & Tokens (Generate with: openssl rand -hex 32)
COOKIE_SECRET=change-in-production-minimum-32-characters
JWT_ACCESS_SECRET=change-in-production-minimum-32-characters
JWT_REFRESH_SECRET=change-in-production-minimum-32-characters
ADMIN_2FA_ENCRYPTION_KEY=change-in-production-minimum-32-characters
ADMIN_IP_ALLOWLIST=203.0.113.195,198.51.100.0/24

# CORS Allowed Origins
CORS_ORIGINS=https://salonbridge.in,https://partner.salonbridge.in,https://admin.salonbridge.in

# Storage (Cloudflare R2 or AWS S3)
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=salonbridge-media-prod
S3_ACCESS_KEY=your-r2-access-key
S3_SECRET_KEY=your-r2-secret-key
S3_FORCE_PATH_STYLE=false

# AI Menu Extraction
ANTHROPIC_API_KEY=sk-ant-api03-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# Payments (Razorpay Route)
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret

# Notifications
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155238886
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@salonbridge.in
```

### Frontends (`apps/*-web`)
```ini
NEXT_PUBLIC_API_URL=https://api.salonbridge.in
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1I...
```

---

## 3. Database Migration & Seeding Steps

1. **Enable required PostgreSQL extensions on your production database:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```
2. **Apply migrations:**
   ```bash
   pnpm --filter @salonbridge/db db:migrate
   ```
3. **Seed base system configurations and plans:**
   ```bash
   pnpm --filter @salonbridge/db db:seed
   ```
4. *(Optional)* Seed demo salons in Bengaluru:
   ```bash
   pnpm --filter @salonbridge/db exec tsx src/seed-demo.ts
   ```

---

## 4. Docker Deployment for Fastify API

Build the production API image from the repository root:
```dockerfile
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @salonbridge/types build
RUN pnpm --filter @salonbridge/db build
RUN pnpm --filter @salonbridge/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
RUN pnpm install --prod --frozen-lockfile

EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
```

---

## 5. Security & Verification Audit

- [x] **Double-Booking Race Conditions:** Protected via `pg_advisory_xact_lock(hashtext(...))` and 7-minute `slot_holds`.
- [x] **Tenant Data Isolation:** Scoped routes enforce `requireSalonMember()` where `salonId` is derived exclusively from authenticated tokens.
- [x] **File Uploads:** MIME sniffing and magic-byte validation (`detectMagicMime`) with presigned S3 URLs limited to 10MB.
- [x] **Super Admin 2FA:** Mandatory TOTP verification (`otplib` + AES-256-GCM encrypted secrets) and optional IP allow-list.
- [x] **Rate Limiting:** Global and per-route rate limiting backed by Redis.
- [x] **Platform Refund Policies:** Standard platform-enforced refund tiering with automated cancellation calculations.

