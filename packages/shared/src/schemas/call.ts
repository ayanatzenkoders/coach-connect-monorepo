import { z } from "zod";
import { IdSchema } from "./common";

/** Start a call in a chat you are a member of. `video: false` = voice call. */
export const StartCallInputSchema = z.strictObject({
  chatId: IdSchema,
  video: z.boolean().default(false),
});
export type StartCallInput = z.infer<typeof StartCallInputSchema>;
