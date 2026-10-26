const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 17:48 -> "5:48 PM" (written by hand: Hermes on some phones has no Intl). */
export function clockTime(date: Date): string {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** The time shown on a Messages row: "5:48 PM" today, "Yesterday", "Tue" this week, otherwise "Oct 14". */
export function listTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (daysAgo <= 0) return clockTime(date);
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return WEEKDAYS[date.getDay()]!;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
