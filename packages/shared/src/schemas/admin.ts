import { z } from "zod";

import { BAN_REASONS } from "../constants";
import { IdSchema } from "./common";

export const BanInputSchema = z.strictObject({
  reason: z.enum(BAN_REASONS),
  note: z.string().max(500).optional(),
});
export type BanInput = z.infer<typeof BanInputSchema>;

/** The user list in the admin panel: search, narrow down, and page through. */
export const AdminUsersQuerySchema = z.strictObject({
  /** Part of a name or an email address, any capitalisation. */
  q: z.string().trim().max(80).optional(),
  role: z.enum(["MEMBER", "COACH", "SUPPORT", "ADMIN"]).optional(),
  /** `banned`: only banned accounts. `pending`: coaches an admin has not approved yet. `unverified`: email not confirmed yet. */
  status: z.enum(["banned", "pending", "unverified"]).optional(),
  /** Opaque "continue after this person" marker from the previous page's `nextCursor`. */
  cursor: IdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminUsersQueryParsed = z.infer<typeof AdminUsersQuerySchema>;
