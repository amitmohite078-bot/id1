# SalonBridge — Backend REST API & Engine

Standalone backend API service for **SalonBridge**.

## Tech Stack
- **Framework:** Fastify 5 + TypeScript + Zod
- **Database:** PostgreSQL 16 + PostGIS + Drizzle ORM
- **Cache & Queue:** Redis 7 + BullMQ
- **Object Storage:** MinIO / Cloudflare R2 / AWS S3
- **Documentation:** OpenAPI / Swagger (`/docs`)

## Getting Started

```bash
# 1. Start local PostgreSQL & Redis (Docker)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Run database migrations & seed demo salons
npm run db:migrate
npm run db:seed

# 4. Start API development server (Port 4000)
npm run dev
```

Open Swagger documentation at [http://localhost:4000/docs](http://localhost:4000/docs).
