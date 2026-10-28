import { describe, expect, it } from "vitest";
import {
  AddGroupMembersInputSchema,
  API_ROUTES,
  CreateGroupInputSchema,
  LoginInputSchema,
  MessagesQuerySchema,
  PASSWORD_PATTERN,
  PeopleQuerySchema,
  RegisterCoachInputSchema,
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
    const base = { email: "a@b.com", name: "Ann", ...device, dateOfBirth: "1990-05-17" };
    for (const weak of ["short1A", "alllowercase1", "ALLUPPERCASE1", "NoNumbersHere"]) {
      expect(RegisterInputSchema.safeParse({ ...base, password: weak }).success).toBe(false);
    }
    expect(RegisterInputSchema.safeParse({ ...base, password: "Password123!" }).success).toBe(true);
    expect(LoginInputSchema.safeParse({ email: "a@b.com", password: "weak", ...device }).success).toBe(true);
    expect(PASSWORD_PATTERN.test("x".repeat(129) + "aA1")).toBe(false);
  });

  it("rejects fields it does not know (e.g. a self-assigned role)", () => {
    const result = RegisterInputSchema.safeParse({ email: "a@b.com", password: "Password123!", name: "Ann", dateOfBirth: "1990-05-17", ...device, role: "ADMIN" });
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

describe("group chat contract", () => {
  const ids = ["01a17e06-c5d3-76be-9632-c7312e1982d8", "01a17e06-8f97-72fa-90d6-78e833aa3936", "01a178e5-1c68-762a-9a30-b62086022bef", "01a16871-c446-74cc-be85-88a4397eb659", "01a178e4-6cfa-726e-bc7d-3d7aed3b5b05"];

  it("routes", () => {
    expect(API_ROUTES.chat.groups).toBe("/chats/groups");
    expect(withParams(API_ROUTES.chat.detail, { id: "abc" })).toBe("/chats/abc");
  });

  it("accepts a group of 3 to 6 people (the creator is added by the server)", () => {
    expect(CreateGroupInputSchema.safeParse({ title: "Team", memberIds: ids.slice(0, 2) }).success).toBe(true);
    expect(CreateGroupInputSchema.safeParse({ title: "Team", memberIds: ids }).success).toBe(true);
  });

  it("refuses too few, too many, and duplicates", () => {
    expect(CreateGroupInputSchema.safeParse({ title: "Team", memberIds: ids.slice(0, 1) }).success).toBe(false);
    expect(CreateGroupInputSchema.safeParse({ title: "Team", memberIds: [...ids, "01a17e06-0000-7000-8000-000000000000"] }).success).toBe(false);
    expect(CreateGroupInputSchema.safeParse({ title: "Team", memberIds: [ids[0], ids[0]] }).success).toBe(false);
  });

  it("needs a name; trims it; a blank description means none; keeps limits", () => {
    expect(CreateGroupInputSchema.safeParse({ title: "   ", memberIds: ids.slice(0, 2) }).success).toBe(false);
    expect(CreateGroupInputSchema.parse({ title: "  Team  ", description: "   ", memberIds: ids.slice(0, 2) })).toMatchObject({ title: "Team", description: undefined });
    expect(CreateGroupInputSchema.safeParse({ title: "x".repeat(61), memberIds: ids.slice(0, 2) }).success).toBe(false);
    expect(CreateGroupInputSchema.safeParse({ title: "Team", description: "x".repeat(301), memberIds: ids.slice(0, 2) }).success).toBe(false);
    expect(CreateGroupInputSchema.safeParse({ title: "Team", media: "photo", memberIds: ids.slice(0, 2) }).success).toBe(false); // no media for now
  });
});

describe("adding people to a group", () => {
  const a = "01a17e06-c5d3-76be-9632-c7312e1982d8";
  const b = "01a17e06-8f97-72fa-90d6-78e833aa3936";

  it("has its route", () => {
    expect(withParams(API_ROUTES.chat.members, { id: "abc" })).toBe("/chats/abc/members");
  });

  it("takes 1 to 5 people, each once", () => {
    expect(AddGroupMembersInputSchema.safeParse({ memberIds: [a] }).success).toBe(true);
    expect(AddGroupMembersInputSchema.safeParse({ memberIds: [] }).success).toBe(false);
    expect(AddGroupMembersInputSchema.safeParse({ memberIds: [a, a] }).success).toBe(false);
    expect(AddGroupMembersInputSchema.safeParse({ memberIds: [a, b, "x"] }).success).toBe(false);
    expect(AddGroupMembersInputSchema.safeParse({ memberIds: [a], title: "no" }).success).toBe(false);
  });
});

describe("date of birth and coach sign-up", () => {
  const member = { email: "a@b.com", password: "Password123!", name: "Ann", dateOfBirth: "1990-05-17", ...device };
  const coach = { ...member, phone: "+49 170 1234567", bio: "I help people prepare for hard career conversations.", specialties: ["Burnout", "Salary talks"] };

  it("a member must give a real date of birth, not in the future", () => {
    expect(RegisterInputSchema.safeParse(member).success).toBe(true);
    const { dateOfBirth: _omit, ...without } = member;
    expect(RegisterInputSchema.safeParse(without).success).toBe(false); // required
    for (const bad of ["2020-02-31", "17-05-1990", "1899-12-31", "2999-01-01", "not a date", ""]) {
      expect(RegisterInputSchema.safeParse({ ...member, dateOfBirth: bad }).success, bad).toBe(false);
    }
    expect(RegisterInputSchema.safeParse({ ...member, dateOfBirth: "2024-02-29" }).success).toBe(true); // leap day, any age is allowed
  });

  it("a coach application needs phone, bio and 1 to 5 known specialties", () => {
    expect(RegisterCoachInputSchema.safeParse(coach).success).toBe(true);
    expect(RegisterCoachInputSchema.safeParse({ ...coach, phone: "abc" }).success).toBe(false);
    expect(RegisterCoachInputSchema.safeParse({ ...coach, phone: "12-34" }).success).toBe(false);
    expect(RegisterCoachInputSchema.safeParse({ ...coach, bio: "too short" }).success).toBe(false);
    expect(RegisterCoachInputSchema.safeParse({ ...coach, specialties: [] }).success).toBe(false);
    expect(RegisterCoachInputSchema.safeParse({ ...coach, specialties: ["Burnout", "Burnout"] }).success).toBe(false);
    expect(RegisterCoachInputSchema.safeParse({ ...coach, specialties: ["Made up topic"] }).success).toBe(false);
    expect(RegisterCoachInputSchema.safeParse({ ...coach, specialties: ["Burnout", "Salary talks", "Leadership", "Remote work", "New managers", "Interview prep"] }).success).toBe(false);
    expect(RegisterCoachInputSchema.safeParse({ ...coach, role: "ADMIN" }).success).toBe(false); // unknown fields are refused
  });
});
