import Link from 'next/link';
import { Button } from '@salonbridge/ui';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
      <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700">
        Customer Web App (Port 3000)
      </span>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">SalonBridge</h1>
      <p className="mt-2 max-w-xl text-zinc-600">
        Browse verified salon services, check live specialist availability, and book real-time appointment slots.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/search">
          <Button>Explore Salons</Button>
        </Link>
        <Link href="/bookings">
          <Button variant="outline">My Bookings</Button>
        </Link>
      </div>
    </main>
  );
}

