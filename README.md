# SalonBridge — Salon Partner Platform

Standalone salon partner dashboard for **SalonBridge**.

## Features
- **Frosted Pearl UI:** Clean modern spa glass surfaces with luminous backdrop blur.
- **Dynamic Front Desk QR Standee:** Automatic high-res scannable counter cards (PNG & Vector SVG) and 1-click A4 / 4x6" print standee.
- **AI Rate-Card Vision Importer:** Auto-parse menu photos, PDFs, or CSVs into structured services.
- **Availability Engine:** Timezone-aware slot calculator enforcing breaks, leaves, buffer times, and max concurrent appointments.
- **Revenue & Performance Analytics:** Real-time GMV, completed bookings, cancellation rates, and no-show stats.
- **Staff & Schedules:** Roster management, leave tracking, and working hours.

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run local development server (Port 3001)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```
