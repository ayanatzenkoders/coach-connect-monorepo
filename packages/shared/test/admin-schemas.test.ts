import { describe, expect, it } from "vitest";
import { API_ROUTES, withParams } from "../src/api";
import { AdminUsersQuerySchema } from "../src/schemas";

describe("admin contract", () => {
  it("has the list and coach approval routes", () => {
    expect(API_ROUTES.admin.users).toBe("/admin/users");
    expect(withParams(API_ROUTES.admin.coachApprove, { id: "abc" })).toBe("/admin/coaches/abc/approve");
  });

  it("the user list query: empty is fine, limit defaults to 25 and is capped", () => {
    expect(AdminUsersQuerySchema.parse({})).toEqual({ limit: 25 });
    expect(AdminUsersQuerySchema.parse({ q: "  ana ", role: "COACH", status: "pending", limit: "10" })).toEqual({ q: "ana", role: "COACH", status: "pending", limit: 10 });
    expect(AdminUsersQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("rejects unknown roles, statuses and unknown fields", () => {
    expect(AdminUsersQuerySchema.safeParse({ role: "OWNER" }).success).toBe(false);
    expect(AdminUsersQuerySchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(AdminUsersQuerySchema.safeParse({ sort: "name" }).success).toBe(false);
    expect(AdminUsersQuerySchema.safeParse({ cursor: "not-an-id" }).success).toBe(false);
  });
});
