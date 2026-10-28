import { z } from "zod";
import { GROUP_DESCRIPTION_MAX, GROUP_MAX_MEMBERS, GROUP_MIN_MEMBERS, GROUP_TITLE_MAX, MESSAGE_MAX_LENGTH } from "../constants";
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

export const CreateGroupInputSchema = z.strictObject({
  title: z.string().trim().min(1, "Give the group a name.").max(GROUP_TITLE_MAX),
  /** Optional. Empty text counts as "no description". */
  description: z
    .string()
    .trim()
    .max(GROUP_DESCRIPTION_MAX)
    .optional()
    .transform((text) => text || undefined),
  /** The OTHER people (you are added automatically): the group has 3 to 6 people in total. */
  memberIds: z
    .array(IdSchema)
    .min(GROUP_MIN_MEMBERS - 1, `A group needs at least ${GROUP_MIN_MEMBERS} people, including you.`)
    .max(GROUP_MAX_MEMBERS - 1, `A group can have at most ${GROUP_MAX_MEMBERS} people, including you.`)
    .refine((ids) => new Set(ids).size === ids.length, "Each person can be added only once."),
});
export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>;

export const AddGroupMembersInputSchema = z.strictObject({
  /** The people to add. The total after adding still has to fit the group rules (6 people, one coach). */
  memberIds: z
    .array(IdSchema)
    .min(1, "Choose at least one person to add.")
    .max(GROUP_MAX_MEMBERS - 1, `A group can have at most ${GROUP_MAX_MEMBERS} people, including you.`)
    .refine((ids) => new Set(ids).size === ids.length, "Each person can be added only once."),
});
export type AddGroupMembersInput = z.infer<typeof AddGroupMembersInputSchema>;

