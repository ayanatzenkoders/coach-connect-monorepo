import { z } from "zod";
import { CODE_LENGTH } from "../constants";

/** Emails are compared lowercase and without spaces everywhere (the database enforces it too). */
export const EmailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** A 6-digit code from an email. */
export const CodeSchema = z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), `code must be ${CODE_LENGTH} digits`);

/** Random id the app creates once per install and keeps in secure storage. */
export const DeviceIdSchema = z.string().min(8).max(128);

/** A UUID (ids of users and chats). */
export const IdSchema = z.uuid();

/**
 * A date of birth as "YYYY-MM-DD" (what a date picker gives). It must be a real calendar day, not in the future,
 * and not before 1900 (a typo guard). No age limit: the rule is only that it is given.
 */
export const DateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value); // rejects 2020-02-31
  }, "Not a real date")
  .refine((value) => value >= "1900-01-01", "Date is too far in the past")
  .refine((value) => value <= new Date().toISOString().slice(0, 10), "Date cannot be in the future");

/** A phone number as people write it: digits, spaces, dashes, brackets, an optional leading +. Only admins can see it. */
export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
  .refine((value) => (value.match(/\d/g) ?? []).length >= 7, "Enter a valid phone number");
