import { z } from "zod";

/** Query strings arrive as text: "true" / "false" become real booleans. */
const booleanText = z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean());

export const PeopleQuerySchema = z.strictObject({
  /** Which tab of the People screen. */
  kind: z.enum(["coaches", "members"]),
  /** Search box: part of a name, any capitalisation. */
  q: z.string().trim().max(60).optional(),
  /** Coaches tab only: keep coaches that list this specialty (exact match). */
  specialty: z.string().max(40).optional(),
  /** Coaches tab only: `true` keeps only coaches who switched "available" on. */
  available: booleanText.optional(),
  /** Opaque "continue after this person" marker from the previous page's `nextCursor`. */
  cursor: z.string().max(200).optional(),
  /** Page size. Capped so one request can never return thousands of rows. */
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PeopleQueryParsed = z.infer<typeof PeopleQuerySchema>;

/** A coach switches "Available now" on or off. Only available coaches get a working Call button. */
export const SetAvailabilityInputSchema = z.strictObject({ available: z.boolean() });
export type SetAvailabilityInput = z.infer<typeof SetAvailabilityInputSchema>;
