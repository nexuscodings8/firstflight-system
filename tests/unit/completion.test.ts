import { describe, expect, it } from "vitest";
import { afterCompletion, optionStatus } from "@/lib/refund-policy";
import { applicationOf, sectionOf } from "@/lib/notice-sections";
import { estimateText } from "@/lib/final-collection";

const DAY = 86_400_000;
const done = new Date("2026-12-01T10:00:00Z");

describe("waiting periods after completion", () => {
  it("each option opens on its own date from the completion date", () => {
    const at = new Date(+done + 5 * DAY);
    const refund = afterCompletion(done, 30, at), reapply = afterCompletion(done, 15, at);
    expect(refund.state).toBe("WAITING");
    expect(refund.opensOn.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(refund.daysLeft).toBe(25);
    expect(reapply.opensOn.toISOString().slice(0, 10)).toBe("2026-12-16");
    expect(reapply.daysLeft).toBe(10);
  });
  it("activates automatically on the date, independently", () => {
    const at = new Date(+done + 15 * DAY);
    expect(afterCompletion(done, 15, at).state).toBe("AVAILABLE");
    expect(afterCompletion(done, 30, at).state).toBe("WAITING");
    expect(afterCompletion(done, 0, done).state).toBe("AVAILABLE");
  });
});

describe("option status", () => {
  const waiting = afterCompletion(done, 30, new Date(+done + DAY));
  const open = afterCompletion(done, 0, new Date(+done + DAY));
  const req = (kind: string, state: string, d = 2) => ({ kind, state, createdAt: new Date(+done + d * DAY) });
  it("waiting, available, submitted, under review, approved, rejected", () => {
    expect(optionStatus("REFUND", done, waiting, [])).toEqual({ status: "WAITING", canSubmit: false });
    expect(optionStatus("REFUND", done, open, [])).toEqual({ status: "AVAILABLE", canSubmit: true });
    expect(optionStatus("REFUND", done, open, [req("REFUND", "SUBMITTED")]).status).toBe("SUBMITTED");
    expect(optionStatus("REFUND", done, open, [req("REFUND", "ADMIN_APPROVAL")]).status).toBe("UNDER_REVIEW");
    expect(optionStatus("REFUND", done, open, [req("REFUND", "COMPLETED")]).status).toBe("APPROVED");
    expect(optionStatus("REFUND", done, open, [req("REFUND", "REJECTED")])).toEqual({ status: "REJECTED", canSubmit: true });
  });
  it("no conflicting refund and reapplication at the same time", () => {
    expect(optionStatus("REAPPLICATION", done, open, [req("REFUND", "FINANCE_REVIEW")])).toEqual({ status: "BLOCKED", canSubmit: false });
  });
  it("requests from before completion don't count", () => {
    expect(optionStatus("REFUND", done, open, [req("REFUND", "COMPLETED", -10)]).status).toBe("AVAILABLE");
  });
});

describe("notification sections", () => {
  it("files notifications under the section they belong to", () => {
    expect(sectionOf("/portal/applications/a1#invoices", "Instalment 2 is now payable")).toBe("payments");
    expect(sectionOf("/portal/applications/a1#visa", "Expected visa date updated")).toBe("visa");
    expect(sectionOf("/portal/applications/a1#final", "New Final collection document")).toBe("final");
    expect(sectionOf("/portal/applications/a1#offer", "Your offer letter is available")).toBe("offer");
    expect(sectionOf("/portal/applications/a1#contract", "Contract signed")).toBe("contracts");
    expect(sectionOf("/portal/applications/a1#appointments", "Invitation to the FIRST FLIGHT office")).toBe("appointments");
    expect(sectionOf("/portal/refunds", "Reapplication approved")).toBe("reapplication");
    expect(sectionOf("/portal/refunds", "Refund paid")).toBe("refunds");
    expect(sectionOf("/staff/messages/c1", "Ann mentioned you")).toBe("messages");
    expect(applicationOf("/staff/applications/abc123#final")).toBe("abc123");
    expect(applicationOf("/portal/refunds")).toBeNull();
  });
  it("shows visa estimates as Kigali dates", () => {
    expect(estimateText("2026-12-10", "14:30")).toBe("Thursday, 10 December 2026 around 14:30 (Kigali time)");
    expect(estimateText("2026-12-10", null)).toBe("Thursday, 10 December 2026");
  });
});
