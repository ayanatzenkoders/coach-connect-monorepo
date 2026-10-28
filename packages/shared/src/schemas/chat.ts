import { z } from "zod";
import { MESSAGE_MAX_LENGTH } from "../constants";
import { IdSchema } from "./common";


export const OpenChatInputSchema = z.strictObject({
  /** The person to chat with. */
  userId: IdSchema,
});
export type OpenChatInput = z.infer<typeof OpenChatInputSchema>;

export const SendMessageInputSchema = z.strictObject({
  /** Made by the app for every message. Sending the same one twice saves the message once. */
  clientMessageId: z.string().min(8).max(64),
  body: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

export const MessagesQuerySchema = z.strictObject({
  /** "Older than message number N": scrolling up. */
  before: z.coerce.number().int().min(1).optional(),
  /** "Newer than message number N": catching up with what arrived since. */
  after: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type MessagesQueryParsed = z.infer<typeof MessagesQuerySchema>;

export const MarkReadInputSchema = z.strictObject({
  /** The newest message number the person has seen. */
  upToSequenceNumber: z.coerce.number().int().min(1),
});
export type MarkReadInput = z.infer<typeof MarkReadInputSchema>;
