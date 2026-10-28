'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { BAN_REASONS } from '@coach-connect/shared/constants';
import type { AdminUser } from '@coach-connect/shared/types';
import { AdminShell } from '@/components/AdminShell';
import { ApiError } from '@/lib/api';
import { approveCoach, banUser, birthDate, canApprove, canBan, canManage, describeTags, listUsers, patchUser, shortDate, unbanUser, type UsersFilter } from '@/lib/admin';
import { useSession } from '@/lib/session';
import styles from './users.module.css';

const ROLE_LABEL: Record<AdminUser['role'], string> = { MEMBER: 'Member', COACH: 'Coach', SUPPORT: 'Support', ADMIN: 'Admin' };
const NO_FILTER: UsersFilter = { q: '', role: '', status: '' };

/** Which row has its ban / unban confirmation open. */
type Panel = { id: string; kind: 'ban' | 'unban' | 'details' } | null;

/**
 * "Users & coaches": search the accounts, approve coaches (so members can find them in the app), and ban or
 * unban. Support sees the same list but no buttons (the backend refuses their writes too).
 */
export default function UsersPage() {
  const session = useSession();
  const signedIn = session !== null; // not the token: it is renewed every 15 minutes and must not reload the list
  const canWrite = canManage(session?.user.role);

  const [filter, setFilter] = useState<UsersFilter>(NO_FILTER);
  // The search box is sent 300 ms after typing stops, not on every keystroke.
  const [typed, setTyped] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState<string>(BAN_REASONS[0]);
  const [note, setNote] = useState('');
  // Every request gets a number; an answer that is not the newest request's is ignored (a slow old search must not overwrite a newer one).
  const latest = useRef(0);

  /** Change a filter: show "Loading…" and clear the old error right away. The effect below then fetches. */
  const applyFilter = useCallback((next: UsersFilter) => {
    setFilter(next);
    setLoading(true);
    setError(null);
    setNotice(null); // the message belonged to the old list
    setPanel(null);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typed !== filter.q) applyFilter({ ...filter, q: typed });
    }, 300);
    return () => clearTimeout(timer);
  }, [typed, filter, applyFilter]);

  /** A 401 here means the login could not be renewed: `authedRequest` already signed out and the shell shows Sign in. */
  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) return;
    setError(e instanceof Error ? e.message : 'Something went wrong.');
  }, []);

  // REQUEST FLOW 1: whenever the filters change, ask the backend for page 1 of the matching users.
  useEffect(() => {
    if (!signedIn) return;
    const mine = ++latest.current;
    listUsers(filter)
      .then((page) => {
        if (mine !== latest.current) return;
        setUsers(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((e) => mine === latest.current && fail(e))
      .finally(() => mine === latest.current && setLoading(false));
  }, [signedIn, filter, fail]);

  // REQUEST FLOW 2: "Load more" sends the cursor the last page gave us and appends the next page.
  async function loadMore() {
    if (!signedIn || !nextCursor || loadingMore) return;
    const mine = latest.current;
    setLoadingMore(true);
    try {
      const page = await listUsers(filter, nextCursor);
      if (mine !== latest.current) return;
      setUsers((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (e) {
      fail(e);
    } finally {
      setLoadingMore(false);
    }
  }

  /** Run one admin action for one row, then update that row from the answer (no full reload). */
  async function act(user: AdminUser, run: () => Promise<Partial<AdminUser>>, done: string) {
    if (!signedIn) return;
    setBusyId(user.id);
    setError(null);
    setNotice(null);
    try {
      const change = await run(); // what the backend confirmed, e.g. { isApproved: true }
      setUsers((current) => patchUser(current, user.id, change));
      setNotice(`${user.name}: ${done}`);
      setPanel(null);
      setNote('');
    } catch (e) {
      fail(e);
    } finally {
      setBusyId(null);
    }
  }

  // The three actions below only say WHICH request to send and what to show afterwards; `act` does the rest.
  const approve = (user: AdminUser) =>
    act(
      user,
      async () => {
        const result = await approveCoach(user.id);
        return { isApproved: result.isApproved };
      },
      'approved. Members can now find this coach.',
    );

  const ban = (user: AdminUser) =>
    act(
      user,
      async () => {
        await banUser(user.id, reason, note);
        return { bannedAt: new Date().toISOString() };
      },
      'banned and signed out everywhere.',
    );

  const unban = (user: AdminUser) =>
    act(
      user,
      async () => {
        await unbanUser(user.id);
        return { bannedAt: null };
      },
      'unbanned. They can sign in again.',
    );

  const filtered = filter.q !== '' || filter.role !== '' || filter.status !== '';

  return (
    <AdminShell title="Users & coaches" subtitle="Approve coaches and manage accounts.">
      <section className={styles.card} aria-label="Users">
        <div className={styles.toolbar} role="search">
          <input aria-label="Search users" className={styles.search} type="search" placeholder="Search name or email" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <select aria-label="Role" className={styles.select} value={filter.role} onChange={(e) => applyFilter({ ...filter, role: e.target.value as UsersFilter['role'] })}>
            <option value="">All roles</option>
            <option value="MEMBER">Members</option>
            <option value="COACH">Coaches</option>
            <option value="SUPPORT">Support</option>
            <option value="ADMIN">Admins</option>
          </select>
          <select aria-label="Status" className={styles.select} value={filter.status} onChange={(e) => applyFilter({ ...filter, status: e.target.value as UsersFilter['status'] })}>
            <option value="">Any status</option>
            <option value="pending">Pending coach approval</option>
            <option value="unverified">Email not verified</option>
            <option value="banned">Banned</option>
          </select>
        </div>

        {!canWrite && session && <p className={styles.note}>You have read-only access. Only admins can approve coaches or ban users.</p>}
        {/* aria-live: screen readers hear "Ana: banned…" when it appears */}
        <div aria-live="polite">{notice && <p className={styles.success}>{notice}</p>}</div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                {canWrite && <th className={styles.actionsHead}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const tags = describeTags(u);
                const busy = busyId === u.id;
                return (
                  <Fragment key={u.id}>
                    <tr>
                      <td>
                        <div className={styles.name}>{u.name}</div>
                        <div className={styles.email}>{u.email}</div>
                        <button type="button" className={styles.link} aria-expanded={panel?.id === u.id && panel.kind === 'details'} onClick={() => setPanel(panel?.id === u.id && panel.kind === 'details' ? null : { id: u.id, kind: 'details' })}>
                          {panel?.id === u.id && panel.kind === 'details' ? 'Hide details' : 'Details'}
                        </button>
                      </td>
                      <td>{ROLE_LABEL[u.role]}</td>
                      <td>
                        <div className={styles.tags}>
                          {tags.map((tag) => (
                            <span key={tag.label} className={`${styles.pill} ${styles[tag.tone]}`}>
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={styles.nowrap}>{shortDate(u.createdAt)}</td>
                      {canWrite && (
                        <td>
                          <div className={styles.actions}>
                          {canApprove(u) && (
                            <button type="button" className={styles.primary} disabled={busy} onClick={() => approve(u)} aria-label={`Approve ${u.name}`}>
                              Approve
                            </button>
                          )}
                          {canBan(u) && (
                            <button type="button" className={u.bannedAt ? styles.button : styles.danger} disabled={busy} onClick={() => setPanel({ id: u.id, kind: u.bannedAt ? 'unban' : 'ban' })} aria-label={`${u.bannedAt ? 'Unban' : 'Ban'} ${u.name}`}>
                              {u.bannedAt ? 'Unban' : 'Ban'}
                            </button>
                          )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {panel?.id === u.id && (
                      <tr className={styles.panelRow}>
                        <td colSpan={5}>
                          {panel.kind === 'details' ? (
                            <dl className={styles.details} aria-label={`Details of ${u.name}`}>
                              <div>
                                <dt>Email</dt>
                                <dd>{u.emailVerified ? 'Verified' : 'Not verified yet'}</dd>
                              </div>
                              <div>
                                <dt>Date of birth</dt>
                                <dd>{birthDate(u.dateOfBirth)}</dd>
                              </div>
                              <div>
                                <dt>Phone</dt>
                                <dd>{canWrite ? (u.phone ?? 'Not given') : 'Admins only'}</dd>
                              </div>
                              {u.coach && (
                                <>
                                  <div>
                                    <dt>Specialties</dt>
                                    <dd>{u.coach.specialties.length > 0 ? u.coach.specialties.join(', ') : 'None'}</dd>
                                  </div>
                                  <div className={styles.wide}>
                                    <dt>About</dt>
                                    <dd>{u.coach.bio || 'Nothing written yet.'}</dd>
                                  </div>
                                </>
                              )}
                            </dl>
                          ) : panel.kind === 'ban' ? (
                            <form
                              className={styles.panel}
                              onSubmit={(e) => {
                                e.preventDefault();
                                void ban(u);
                              }}>
                              <strong>Ban {u.name}?</strong>
                              <span>They are signed out of every device at once and cannot sign in.</span>
                              <select aria-label="Reason" className={styles.select} value={reason} onChange={(e) => setReason(e.target.value)}>
                                {BAN_REASONS.map((r) => (
                                  <option key={r}>{r}</option>
                                ))}
                              </select>
                              <input aria-label="Note (optional)" className={styles.search} maxLength={500} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                              <div className={styles.panelButtons}>
                                <button type="submit" className={styles.dangerSolid} disabled={busy}>
                                  Confirm ban
                                </button>
                                <button type="button" className={styles.button} onClick={() => setPanel(null)}>
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className={styles.panel}>
                              <strong>Unban {u.name}?</strong>
                              <span>They can sign in again. Their old sessions stay closed.</span>
                              <div className={styles.panelButtons}>
                                <button type="button" className={styles.primary} disabled={busy} onClick={() => unban(u)}>
                                  Confirm unban
                                </button>
                                <button type="button" className={styles.button} onClick={() => setPanel(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {loading && <p className={styles.empty}>Loading…</p>}
          {!loading && users.length === 0 && !error && <p className={styles.empty}>{filtered ? 'No users match these filters.' : 'No users yet.'}</p>}
        </div>

        {nextCursor && (
          <button type="button" className={styles.more} disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>
    </AdminShell>
  );
}
