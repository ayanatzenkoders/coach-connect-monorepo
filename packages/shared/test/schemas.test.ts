import { describe, expect, it } from "vitest";
import {
  API_ROUTES,
  LoginInputSchema,
  MessagesQuerySchema,
  PASSWORD_PATTERN,
  PeopleQuerySchema,
  RegisterInputSchema,
  SendMessageInputSchema,
  withParams,
} from "../src";

const device = { deviceId: "device-aaaaaaaa" };

describe("routes", () => {
  it("fills in :params and escapes them", () => {
    expect(withParams(API_ROUTES.chat.messages, { id: "abc" })).toBe("/chats/abc/messages");
    expect(withParams(API_ROUTES.admin.user, { id: "a/b" })).toBe("/admin/users/a%2Fb");
  });
});

describe("auth schemas", () => {
  it("lowercases and trims the email", () => {
    const parsed = LoginInputSchema.parse({ email: "  Sara@Example.COM ", password: "x", ...device });
    expect(parsed.email).toBe("sara@example.com");
  });

  it("applies the new-password rule at sign-up but not at login", () => {
    const base = { email: "a@b.com", name: "Ann", ...device };
    for (const weak of ["short1A", "alllowercase1", "ALLUPPERCASE1", "NoNumbersHere"]) {
      expect(RegisterInputSchema.safeParse({ ...base, password: weak }).success).toBe(false);
    }
    expect(RegisterInputSchema.safeParse({ ...base, password: "Password123!" }).success).toBe(true);
    expect(LoginInputSchema.safeParse({ email: "a@b.com", password: "weak", ...device }).success).toBe(true);
    expect(PASSWORD_PATTERN.test("x".repeat(129) + "aA1")).toBe(false);
  });

  it("rejects fields it does not know (e.g. a self-assigned role)", () => {
    const result = RegisterInputSchema.safeParse({ email: "a@b.com", password: "Password123!", name: "Ann", ...device, role: "ADMIN" });
    expect(result.success).toBe(false);
  });
});

describe("people and chat schemas", () => {
  it("turns query text into numbers and booleans, with defaults", () => {
    expect(PeopleQuerySchema.parse({ kind: "coaches", available: "true", limit: "5" })).toMatchObject({ available: true, limit: 5 });
    expect(PeopleQuerySchema.parse({ kind: "members" }).limit).toBe(20);
    expect(PeopleQuerySchema.safeParse({ kind: "robots" }).success).toBe(false);
    expect(PeopleQuerySchema.safeParse({ kind: "coaches", limit: "999" }).success).toBe(false);
    expect(MessagesQuerySchema.parse({ before: "4" })).toMatchObject({ before: 4, limit: 30 });
  });

  it("trims messages and refuses blank or oversized ones", () => {
    expect(SendMessageInputSchema.parse({ clientMessageId: "client-12345", body: "  hi  " }).body).toBe("hi");
    expect(SendMessageInputSchema.safeParse({ clientMessageId: "client-12345", body: "   " }).success).toBe(false);
    expect(SendMessageInputSchema.safeParse({ clientMessageId: "client-12345", body: "x".repeat(2001) }).success).toBe(false);
  });
});
