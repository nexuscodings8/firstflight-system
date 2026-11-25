import { describe, expect, it } from "vitest";
import { canAssign, canManageContent, canManageFinance, canSeeInternalNotes, canViewApplication, canViewDocuments, homeFor } from "@/lib/permissions";

const app = { clientId: "c1", consultantId: "k1" };
describe("application access", () => {
  it("lets a client see only their own application", () => {
    expect(canViewApplication({ id: "c1", role: "CLIENT" }, app)).toBe(true);
    expect(canViewApplication({ id: "c2", role: "CLIENT" }, app)).toBe(false);
  });
  it("lets a consultant see only assigned applications", () => {
    expect(canViewApplication({ id: "k1", role: "CONSULTANT" }, app)).toBe(true);
    expect(canViewApplication({ id: "k2", role: "CONSULTANT" }, app)).toBe(false);
  });
  it("gives admin and finance oversight, but not content managers", () => {
    expect(canViewApplication({ id: "a", role: "ADMIN" }, app)).toBe(true);
    expect(canViewApplication({ id: "f", role: "FINANCE" }, app)).toBe(true);
    expect(canViewApplication({ id: "m", role: "CONTENT_MANAGER" }, app)).toBe(false);
  });
});
describe("documents and internal data", () => {
  it("keeps uploaded documents from finance, content managers and other clients", () => {
    expect(canViewDocuments({ id: "f", role: "FINANCE" }, app)).toBe(false);
    expect(canViewDocuments({ id: "m", role: "CONTENT_MANAGER" }, app)).toBe(false);
    expect(canViewDocuments({ id: "c2", role: "CLIENT" }, app)).toBe(false);
    expect(canViewDocuments({ id: "c1", role: "CLIENT" }, app)).toBe(true);
    expect(canViewDocuments({ id: "k1", role: "CONSULTANT" }, app)).toBe(true);
  });
  it("never shows internal notes to clients", () => {
    expect(canSeeInternalNotes({ id: "c1", role: "CLIENT" })).toBe(false);
    expect(canSeeInternalNotes({ id: "k1", role: "CONSULTANT" })).toBe(true);
  });
  it("limits assignment, finance and content to the right roles", () => {
    expect(canAssign({ id: "k", role: "CONSULTANT" })).toBe(false);
    expect(canAssign({ id: "a", role: "ADMIN" })).toBe(true);
    expect(canManageFinance({ id: "k", role: "CONSULTANT" })).toBe(false);
    expect(canManageContent({ id: "m", role: "CONTENT_MANAGER" })).toBe(true);
    expect(homeFor("CLIENT")).toBe("/portal");
    expect(homeFor("FINANCE")).toBe("/staff");
  });
});
