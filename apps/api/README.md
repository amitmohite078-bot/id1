# `@salonbridge/api`

Fastify REST API + OpenAPI/Swagger + Zod validation + Drizzle ORM + RBAC guards.

## Endpoints (Phase 2)
- `GET /health/live` — Liveness check
- `GET /health/ready` — Readiness check (Postgres + Redis)
- `GET /docs` — Swagger UI
- `POST /api/v1/auth/otp/send` — Send WhatsApp/SMS OTP
- `POST /api/v1/auth/otp/verify` — Verify OTP & issue httpOnly cookies
- `POST /api/v1/auth/admin/2fa/setup` — Setup TOTP 2FA for Super Admin
- `POST /api/v1/auth/admin/2fa/verify` — Verify TOTP 2FA for Super Admin
- `POST /api/v1/auth/refresh` — Rotate refresh token
- `POST /api/v1/auth/logout` — Revoke session
- `GET /api/v1/auth/me` — Get current user

