import { API_ROUTES } from '@coach-connect/shared/api';
import type { AdminStats } from '@coach-connect/shared/types';
import { authedRequest } from './session';

/** Ask the backend for the dashboard numbers (Support and Admin may both read them). */
export const getStats = () => authedRequest<AdminStats>(API_ROUTES.admin.stats);

/**
 * Bar heights for the chart, as percentages of the tallest bar (0 to 100). A day with people always gets at least a
 * sliver (4%) so it never looks like an empty day, and a chart with no signups at all is flat instead of dividing by zero.
 */
export function barHeights(counts: number[]): number[] {
  const max = Math.max(0, ...counts);
  if (max === 0) return counts.map(() => 0);
  return counts.map((c) => (c === 0 ? 0 : Math.max(4, Math.round((c / max) * 100))));
}

/** "2026-10-29" -> "29 Oct". A calendar day, so no time zone shifting. */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** The sentence a screen reader (and the hover tooltip) gives for one bar. */
export const barSummary = (date: string, count: number) => `${dayLabel(date)}: ${count} ${count === 1 ? 'sign-up' : 'sign-ups'}`;
