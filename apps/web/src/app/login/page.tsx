'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { ApiError } from '@/lib/api';
import { login, useSession } from '@/lib/session';
import styles from './login.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Admin sign-in (design "A1 Admin sign in"). For admin and support staff only. */
export default function LoginPage() {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    if (session) router.replace('/dashboard');
  }, [session, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid work email.';
    if (password.length === 0) next.password = 'Enter your password.';
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setErrors({ form: 'Too many attempts. Wait a minute and try again.' });
      else setErrors({ form: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <span className={styles.tile}>
          <Logo size={22} />
        </span>
        <span className={styles.name}>Coach Connect</span>
        <span className={styles.badge}>Operations</span>
      </div>

      <div className={styles.card}>
        <form onSubmit={onSubmit} noValidate className={styles.form}>
          <div className={styles.heading}>
            <h1>Sign in</h1>
            <p>For admin and support staff only.</p>
          </div>

          {errors.form && (
            <div role="alert" className={styles.banner}>
              {errors.form}
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((x) => ({ ...x, email: undefined, form: undefined }));
              }}
            />
            {errors.email && (
              <p id="email-error" role="alert" className={styles.error}>
                {errors.email}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((x) => ({ ...x, password: undefined, form: undefined }));
              }}
            />
            {errors.password && (
              <p id="password-error" role="alert" className={styles.error}>
                {errors.password}
              </p>
            )}
          </div>

          <button type="submit" className={styles.submit} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className={styles.note}>
        Sessions expire after 12 hours of inactivity. Every admin change and transcript view is recorded in the audit log.
      </p>
    </main>
  );
}
