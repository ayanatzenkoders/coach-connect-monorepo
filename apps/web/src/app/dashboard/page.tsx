'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminStats } from '@coach-connect/shared/types';
import { AdminShell } from '@/components/AdminShell';
import { ApiError } from '@/lib/api';
import { barHeights, barSummary, dayLabel, getStats } from '@/lib/dashboard';
import { shortDate } from '@/lib/admin';
import { useSession } from '@/lib/session';
import styles from './dashboard.module.css';

/**
 * The dashboard: how the product is doing, and what needs an admin right now (coaches waiting for approval).
 * One request (GET /admin/stats); every number is a count the database computed.
 */
export default function DashboardPage() {
  const session = useSession();
  const signedIn = session !== null; // not the token: it is renewed every 15 minutes and must not reload the page
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [asTable, setAsTable] = useState(false);

  /** Ask for the numbers. State is only set when the answer arrives (never synchronously inside an effect). */
  const fetchStats = useCallback(() => {
    getStats()
      .then((result) => {
        setStats(result);
        setError(null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return; // login could not be renewed: the shell shows Sign in
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (signedIn) fetchStats();
  }, [signedIn, fetchStats]);

  const retry = () => {
    setLoading(true);
    setError(null);
    fetchStats();
  };

  return (
    <AdminShell title="Dashboard" subtitle="How Coach Connect is doing, and what needs you.">
      {error && (
        <p role="alert" className={styles.error}>
          {error}{' '}
          <button type="button" className={styles.retry} onClick={retry}>
            Try again
          </button>
        </p>
      )}
      {loading && !stats && <p className={styles.muted}>Loading…</p>}

      {stats && (
        <div className={styles.page}>
          <section aria-label="People" className={styles.tiles}>
            <Tile label="Members" value={stats.users.members} />
            <Tile label="Approved coaches" value={stats.users.approvedCoaches} />
            <Tile label="Coaches waiting" value={stats.users.pendingCoaches} tone={stats.users.pendingCoaches > 0 ? 'warn' : undefined} hint="Applied, not approved yet" />
            <Tile label="New this week" value={stats.signups.last7Days} />
            <Tile label="Email not verified" value={stats.users.unverified} />
            <Tile label="Banned" value={stats.users.banned} />
          </section>

          <section aria-label="Activity" className={styles.tiles}>
            <Tile label="Messages, last 24 hours" value={stats.messages.last24Hours} />
            <Tile label="Messages, last 7 days" value={stats.messages.last7Days} />
            <Tile label="Active chats, 7 days" value={stats.chats.active7Days} hint="Had a message this week" />
            <Tile label="Direct chats" value={stats.chats.direct} />
            <Tile label="Group chats" value={stats.chats.group} />
          </section>

          <div className={styles.columns}>
            <section className={styles.card} aria-labelledby="signups-heading">
              <div className={styles.cardHead}>
                <h2 id="signups-heading">Sign-ups, last 14 days</h2>
                <button type="button" className={styles.toggle} aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
                  {asTable ? 'View as chart' : 'View as table'}
                </button>
              </div>
              {asTable ? <SignupsTable daily={stats.signups.daily} /> : <SignupsChart daily={stats.signups.daily} />}
            </section>

            <section className={styles.card} aria-labelledby="waiting-heading">
              <div className={styles.cardHead}>
                <h2 id="waiting-heading">Waiting for approval</h2>
                <Link href="/users" className={styles.link}>
                  Open Users
                </Link>
              </div>
              {stats.awaitingApproval.length === 0 ? (
                <p className={styles.muted}>No coach is waiting. Nice.</p>
              ) : (
                <ul className={styles.waiting}>
                  {stats.awaitingApproval.map((c) => (
                    <li key={c.id}>
                      <div>
                        <div className={styles.name}>{c.name}</div>
                        <div className={styles.email}>{c.email}</div>
                      </div>
                      <span className={styles.muted}>Applied {shortDate(c.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {stats.users.pendingCoaches > stats.awaitingApproval.length && <p className={styles.muted}>Showing the oldest {stats.awaitingApproval.length} of {stats.users.pendingCoaches}.</p>}
            </section>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

/** One headline number. Warn tone = something for an admin to do. */
function Tile({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: 'warn' }) {
  return (
    <div className={`${styles.tile} ${tone === 'warn' ? styles.tileWarn : ''}`}>
      <div className={styles.tileValue}>{value.toLocaleString('en-GB')}</div>
      <div className={styles.tileLabel}>{label}</div>
      {hint && <div className={styles.tileHint}>{hint}</div>}
    </div>
  );
}

/** Thin bars on a shared baseline, one hue. Hover (or keyboard focus) a bar for its day and number. */
function SignupsChart({ daily }: { daily: AdminStats['signups']['daily'] }) {
  const heights = barHeights(daily.map((d) => d.count));
  const max = Math.max(0, ...daily.map((d) => d.count));
  return (
    <figure className={styles.chart} aria-label="Sign-ups per day for the last 14 days">
      <div className={styles.plot}>
        <span className={styles.max}>{max}</span>
        <div className={styles.bars}>
          {daily.map((d, i) => (
            <div key={d.date} className={styles.barSlot} tabIndex={0} role="img" aria-label={barSummary(d.date, d.count)}>
              <div className={styles.bar} style={{ height: `${heights[i]}%` }} />
              <span className={styles.tip}>{barSummary(d.date, d.count)}</span>
            </div>
          ))}
        </div>
      </div>
      <figcaption className={styles.axis}>
        <span>{dayLabel(daily[0]?.date ?? '')}</span>
        <span>{dayLabel(daily[daily.length - 1]?.date ?? '')}</span>
      </figcaption>
    </figure>
  );
}

function SignupsTable({ daily }: { daily: AdminStats['signups']['daily'] }) {
  return (
    <table className={styles.table}>
      <caption className={styles.srOnly}>Sign-ups per day for the last 14 days</caption>
      <thead>
        <tr>
          <th scope="col">Day</th>
          <th scope="col">Sign-ups</th>
        </tr>
      </thead>
      <tbody>
        {[...daily].reverse().map((d) => (
          <tr key={d.date}>
            <td>{dayLabel(d.date)}</td>
            <td>{d.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
