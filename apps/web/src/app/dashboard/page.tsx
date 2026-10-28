'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { ApiError } from '@/lib/api';
import { authedRequest, useSession } from '@/lib/session';
import styles from './dashboard.module.css';

interface Me {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

/**
 * Dashboard. The numbers and charts from the design come in a later step. For now the page proves
 * the connection works by showing what the backend says about the signed-in person (GET /auth/me).
 */
export default function DashboardPage() {
  const session = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = session !== null; // not the token itself: it is renewed every 15 minutes and must not reload the page

  useEffect(() => {
    if (!signedIn) return;
    authedRequest<Me>('/auth/me')
      .then(setMe)
      .catch((e) => setError(e instanceof ApiError ? `${e.status} ${e.code}` : 'failed'));
  }, [signedIn]);

  return (
    <AdminShell title="Dashboard" subtitle="Charts and numbers arrive in a later step.">
      <section className={styles.card} aria-labelledby="who-heading">
        <h2 id="who-heading">Signed in</h2>
        <dl className={styles.list}>
          <Row label="Name" value={me?.name} />
          <Row label="Email" value={me?.email} />
          <Row label="Role" value={me?.role} />
        </dl>
        {error && <p role="alert">Could not load profile: {error}</p>}
      </section>
    </AdminShell>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value ?? '…'}</dd>
    </div>
  );
}
