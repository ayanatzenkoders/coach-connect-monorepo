import { z } from "zod";
import { CODE_LENGTH } from "../constants";

/** Emails are compared lowercase and without spaces everywhere (the database enforces it too). */
export const EmailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** A 6-digit code from an email. */
export const CodeSchema = z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), `code must be ${CODE_LENGTH} digits`);

/** Random id the app creates once per install and keeps in secure storage. */
export const DeviceIdSchema = z.string().min(8).max(128);

/** A UUID (ids of users and conversations). */
export const IdSchema = z.uuid();
