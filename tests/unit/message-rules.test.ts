import { describe, expect, it } from "vitest";
import { badMembers, canUseConversation, findMentions } from "@/lib/message-rules";

const app = { consultantId: "c1", service: "WORK" };
describe("canUseConversation", () => {
  it("keeps clients out of every staff conversation", () => {
    expect(canUseConversation({ id: "x", role: "CLIENT" }, { kind: "DIRECT", financePrivate: false, applicationId: null }, true, null)).toBe(false);
  });
  it("keeps consultants out of Finance-only conversations, even as members", () => {
    expect(canUseConversation({ id: "c1", role: "CONSULTANT" }, { kind: "GROUP", financePrivate: true, applicationId: null }, true, null)).toBe(false);
    expect(canUseConversation({ id: "c1", role: "CONSULTANT", services: ["WORK"] }, { kind: "APPLICATION", financePrivate: true, applicationId: "a" }, false, app)).toBe(false);
  });
  it("lets the assigned consultant into the application thread, not others", () => {
    const c = { kind: "APPLICATION", financePrivate: false, applicationId: "a" };
    expect(canUseConversation({ id: "c1", role: "CONSULTANT", services: ["WORK"] }, c, false, app)).toBe(true);
    expect(canUseConversation({ id: "c2", role: "CONSULTANT", services: ["WORK"] }, c, false, app)).toBe(false);
    expect(canUseConversation({ id: "c1", role: "CONSULTANT", services: ["STUDY"] }, c, false, app)).toBe(false);
    expect(canUseConversation({ id: "f", role: "FINANCE" }, c, false, app)).toBe(true);
  });
  it("needs membership for direct and group conversations", () => {
    const c = { kind: "GROUP", financePrivate: false, applicationId: null };
    expect(canUseConversation({ id: "a", role: "ADMIN" }, c, false, null)).toBe(false);
    expect(canUseConversation({ id: "a", role: "CONTENT_MANAGER" }, c, true, null)).toBe(true);
  });
});
describe("badMembers", () => {
  it("rejects clients and non-finance members of private groups", () => {
    expect(badMembers(["CONSULTANT", "CLIENT"], false)).toMatch(/Clients/);
    expect(badMembers(["FINANCE", "CONSULTANT"], true)).toMatch(/Finance-only/);
    expect(badMembers(["FINANCE", "ADMIN"], true)).toBeNull();
  });
});
describe("findMentions", () => {
  const people = [{ id: "1", name: "Aline Uwase" }, { id: "2", name: "Eric Mugisha" }, { id: "3", name: "Eric Habimana" }];
  it("finds full names and unique first names", () => {
    expect(findMentions("Hi @Aline, can you check?", people)).toEqual(["1"]);
    expect(findMentions("@eric mugisha please", people)).toEqual(["2"]);
  });
  it("ignores ambiguous first names and partial words", () => {
    expect(findMentions("@Eric look", people)).toEqual([]);
    expect(findMentions("@Alineee", people)).toEqual([]);
  });
});
