import { describe, it, expect } from "vitest";
import {
  can,
  effectiveRole,
  isStaffRole,
  parseAdminUserIds,
} from "../apps/web/src/lib/admin-permissions";

describe("admin permissions", () => {
  it("ADMIN can do everything", () => {
    expect(can("ADMIN", "orders.refund")).toBe(true);
    expect(can("ADMIN", "users.role")).toBe(true);
    expect(can("ADMIN", "reference.manage")).toBe(true);
  });

  it("SUPPORT can view, triage and hide but not move money or change people", () => {
    expect(can("SUPPORT", "users.view")).toBe(true);
    expect(can("SUPPORT", "issues.triage")).toBe(true);
    expect(can("SUPPORT", "listings.hide")).toBe(true);
    expect(can("SUPPORT", "audit.view")).toBe(true);

    expect(can("SUPPORT", "orders.refund")).toBe(false);
    expect(can("SUPPORT", "orders.release")).toBe(false);
    expect(can("SUPPORT", "issues.resolve")).toBe(false);
    expect(can("SUPPORT", "users.suspend")).toBe(false);
    expect(can("SUPPORT", "users.role")).toBe(false);
    expect(can("SUPPORT", "reference.manage")).toBe(false);
    expect(can("SUPPORT", "marketing.export")).toBe(false);
  });

  it("only SUPPORT and ADMIN are staff", () => {
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("SUPPORT")).toBe(true);
    expect(isStaffRole("USER")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole("admin")).toBe(false);
  });

  it("parses the bootstrap list the same way proxy.ts does", () => {
    expect(parseAdminUserIds("user_a, user_b ,,")).toEqual(["user_a", "user_b"]);
    expect(parseAdminUserIds(undefined)).toEqual([]);
    expect(parseAdminUserIds("")).toEqual([]);
  });

  it("bootstrap IDs are ADMIN whatever the stored role says", () => {
    expect(effectiveRole("USER", "user_a", ["user_a"])).toBe("ADMIN");
    expect(effectiveRole("SUPPORT", "user_a", ["user_a"])).toBe("ADMIN");
  });

  it("otherwise the stored role decides, and USER is not staff", () => {
    expect(effectiveRole("SUPPORT", "user_b", ["user_a"])).toBe("SUPPORT");
    expect(effectiveRole("ADMIN", "user_b", [])).toBe("ADMIN");
    expect(effectiveRole("USER", "user_b", ["user_a"])).toBeNull();
  });
});
