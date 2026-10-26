import { z } from "zod";

import { BAN_REASONS } from "../constants";

export const BanInputSchema = z.strictObject({
  reason: z.enum(BAN_REASONS),
  note: z.string().max(500).optional(),
});
export type BanInput = z.infer<typeof BanInputSchema>;
