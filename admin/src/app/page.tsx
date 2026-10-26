'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/lib/session';

/** The front door: send people to the dashboard if signed in, otherwise to sign in. */
export default function Home() {
  const router = useRouter();
  const session = useSession();
  useEffect(() => {
    router.replace(session ? '/dashboard' : '/login');
  }, [router, session]);
  return null;
}
