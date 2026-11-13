# SalonBridge — Customer Web Platform

Standalone customer web application for **SalonBridge**.

## Features
- **Geospatial Discovery:** Real-time distance search using PostGIS `ST_DWithin`.
- **Side-by-Side Comparison:** Compare 2 to 4 salons on price, ratings, and distances.
- **Real-Time Slot Locking:** 7-minute TTL Redis slot hold preventing double bookings.
- **Split Payments:** Razorpay Route marketplace split transfers & "Pay at Salon".
- **Customer Booking Management:** Cancel, reschedule, and rate past appointments.

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run local development server (Port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```
