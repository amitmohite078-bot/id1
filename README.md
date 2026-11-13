# SalonBridge — Super Admin Control Plane

Standalone administrative control plane for **SalonBridge**.

## Features
- **Mandatory 2FA Security:** TOTP authenticator verification & optional IP CIDR allowlisting.
- **Salon Onboarding Approvals:** Queue to verify new registrations, GSTIN, and assign custom commission rates.
- **Platform Economics:** Global take-rates, commission overrides, and coupon management.
- **User Moderation:** Block malicious accounts, review flagged ratings and comments.
- **Immutable Audit Trail:** Append-only logs tracking all administrative actions with actor IP and timestamps.

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run local development server (Port 3002)
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

## Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```
