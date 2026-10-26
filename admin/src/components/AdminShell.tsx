'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { logout, useSession } from '@/lib/session';
import { DashboardIcon, FlagIcon, ListIcon, PhoneIcon, SignOutIcon, UsersIcon } from './NavIcons';
import { Logo } from './Logo';
import styles from './AdminShell.module.css';

/** Pages from the design. Only the dashboard exists so far; the others are shown but not clickable yet. */
const NAV = [
  { label: 'Dashboard', icon: DashboardIcon, href: '/dashboard' },
  { label: 'Users & coaches', icon: UsersIcon },
  { label: 'Call logs', icon: PhoneIcon },
  { label: 'Moderation', icon: FlagIcon },
  { label: 'Audit log', icon: ListIcon },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Sidebar + page frame for every signed-in page. Sends people to Sign in if they are not signed in. */
export function AdminShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session) router.replace('/login');
  }, [session, router]);

  if (!session) return null; // while redirecting, show nothing rather than a flash of the panel

  const { user } = session;
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.tile}>
            <Logo size={20} />
          </span>
          <span className={styles.brandName}>Coach Connect</span>
        </div>

        <nav aria-label="Admin" className={styles.nav}>
          {NAV.map(({ label, icon: Icon, href }) =>
            href ? (
              <a key={label} href={href} aria-current="page" className={`${styles.item} ${styles.active}`}>
                <Icon />
                {label}
              </a>
            ) : (
              <span key={label} aria-disabled="true" title="Coming soon" className={`${styles.item} ${styles.disabled}`}>
                <Icon />
                {label}
              </span>
            ),
          )}
        </nav>

        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className={styles.who}>
            <span className={styles.whoName}>{user.name}</span>
            <span className={styles.whoRole}>{user.role === 'ADMIN' ? 'Admin' : 'Support'}</span>
          </span>
          <button type="button" aria-label="Sign out" className={styles.signOut} onClick={() => logout()}>
            <SignOutIcon />
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1>{title}</h1>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </header>
        {children}
      </main>
    </div>
  );
}
