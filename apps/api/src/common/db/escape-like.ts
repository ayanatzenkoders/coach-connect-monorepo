/**
 * In LIKE / ILIKE patterns % and _ are wildcards, and Prisma's `contains` does NOT escape them for you
 * (searching "%" would match everyone). A backslash in front makes each one literal. Use this on any
 * user-typed text that goes into `contains`, `startsWith` or `endsWith`.
 */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, '\\$&');
