import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

// An existing client served manually before the platform: registered at their real stage with a past payment that
// Finance validates, then a schedule where the 2nd and 3rd instalments are payable after the visa (the 3rd by loan).
const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";
const stamp = Date.now();
const who = { name: "Diane Mukamana", email: `diane-${stamp}@example.test`, phone: `+25072${String(stamp).slice(-7)}`, password: "Diane-Pass-2026!" };
const PDF = path.join(__dirname, "sample.pdf");
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function as(browser: Browser, email: string, password = PW) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return { page, close: () => ctx.close() };
}
const ok = (p: Page, t: string | RegExp) => expect(p.getByRole("status").filter({ hasText: t }).first()).toBeVisible();
const alert = (p: Page, t: string | RegExp) => expect(p.getByRole("alert").filter({ hasText: t }).first()).toBeVisible();
const move = async (p: Page, stage: string) => { await p.getByLabel("Stage", { exact: true }).selectOption(stage); await p.getByRole("button", { name: "Save progress" }).click(); };

test.describe.serial("existing client, visa-conditioned instalments and a third-instalment loan", () => {
  test.describe.configure({ timeout: 90_000 });
  let appPath = "", activation = "";

  test("consultant registers an existing client at their real stage; the stage is checked against the records", async ({ browser }) => {
    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto("/staff/clients/new?existing=1");
    await k.page.getByLabel("Full name").fill(who.name);
    await k.page.getByLabel("Email", { exact: true }).fill(who.email);
    await k.page.getByLabel("Phone (with country code)").fill(who.phone);
    await k.page.getByLabel("Service being received").selectOption({ label: "Warehouse order picker (Netherlands)" });
    await k.page.getByLabel("Service started on (if known)").fill(daysAgo(120));
    await k.page.getByLabel("Actual current stage").selectOption("PROCESSING");
    await k.page.getByLabel("Date this stage was reached (if known)").fill(daysAgo(20));
    await k.page.getByLabel("Currency").selectOption("EUR");
    const pay = k.page.getByTestId("previous-payment").first();
    await pay.getByLabel("Amount").fill("600");
    await pay.getByLabel("Date paid").fill(daysAgo(60));
    await pay.getByLabel("Reference").fill(`OLD-${stamp}`);
    await pay.getByLabel("Evidence").setInputFiles(PDF);
    // Processing means a signed contract exists: without it the registration is refused.
    await k.page.getByRole("button", { name: "Register existing client" }).click();
    await alert(k.page, "has a signed contract");
    await k.page.getByLabel("Signed contract (scan)").setInputFiles(PDF);
    await k.page.getByLabel("Date the contract was signed").fill(daysAgo(30));
    await k.page.getByLabel("Other application documents (you can choose several)").setInputFiles(PDF);
    await k.page.getByRole("button", { name: "Register existing client" }).click();
    await ok(k.page, /open at Processing. It's assigned to you. Finance validates the previous payments/);
    activation = (await k.page.getByTestId("activation-link").textContent())!.trim();
    await k.page.getByRole("link", { name: "Open the application" }).click();
    await k.page.waitForURL(/\/staff\/applications\//);
    appPath = new URL(k.page.url()).pathname;
    await expect(k.page.getByLabel("Stage", { exact: true })).toHaveValue("PROCESSING");
    await expect(k.page.getByText(/Paper copy signed/)).toBeVisible();
    // Not invoiced again: nothing is payable for the instalment paid before the platform.
    await expect(k.page.getByText(/INV-\d{4}/)).toHaveCount(0);
    await k.close();

    const a = await as(browser, "admin@firstflight.test");
    await a.page.goto("/staff/activity?q=" + encodeURIComponent("as an existing client already at Processing"));
    await expect(a.page.getByText(/registered .* as an existing client already at Processing/).first()).toBeVisible();
    await a.close();
  });

  test("the client activates the account and sees where they are and what's left", async ({ page }) => {
    await page.goto(new URL(activation).pathname + new URL(activation).search);
    await page.getByLabel("New password (10+ characters)").fill(who.password);
    await page.getByLabel("Repeat password").fill(who.password);
    await page.getByRole("button", { name: "Activate and sign in" }).click();
    await page.waitForURL(/\/portal/);
    await page.goto("/portal/applications");
    await page.getByRole("link", { name: /FF-WA-/ }).first().click();
    await expect(page.getByText("Processing").first()).toBeVisible();
    await expect(page.getByText("Earlier documents (from before the platform)")).toBeVisible();
  });

  test("Finance sets the schedule (2nd and 3rd after the visa, loan allowed on the 3rd) and validates the old payment", async ({ browser }) => {
    const f = await as(browser, "finance@firstflight.test");
    await f.page.goto(appPath);
    const hp = f.page.getByTestId("historical-payment").first();
    await expect(hp).toContainText("Waiting for validation");
    await expect(hp.getByText(/Confirm the instalment schedule first/)).toBeVisible();
    const rows = f.page.getByTestId("schedule-row");
    await expect(rows).toHaveCount(3);
    await rows.nth(0).getByLabel(/Paid before the platform/).check();
    await rows.nth(1).getByLabel("Becomes payable").selectOption("VISA");
    await rows.nth(2).getByLabel("Becomes payable").selectOption("VISA");
    // The loan option exists only on the third instalment.
    await expect(rows.nth(0).getByText(/approved loan/)).toHaveCount(0);
    await expect(rows.nth(1).getByText(/approved loan/)).toHaveCount(0);
    await rows.nth(2).getByLabel(/pay this final instalment with an approved loan/).check();
    await f.page.getByRole("button", { name: "Confirm schedule and issue the first invoice" }).click();
    await ok(f.page, "Nothing is payable yet");
    await f.page.reload();
    await hp.getByRole("button", { name: "Validate payment" }).click();
    await ok(f.page, /Validated against instalment 1/);
    await f.page.reload();
    await expect(f.page.getByTestId("instalment").first()).toContainText("Paid");
    await expect(f.page.getByText(/\(paid before the platform\)/).first()).toBeVisible();
    // Validated once: the same reference can't be recorded again.
    await expect(f.page.getByTestId("historical-payment").first()).toContainText("Validated");
    await f.close();
  });

  test("instalments due after the visa never block the stages before it", async ({ browser }) => {
    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto(appPath);
    await move(k.page, "GETTING_OFFER");
    await ok(k.page, "moved to Getting offer");
    await k.page.reload();
    const offer = k.page.locator("#offer");
    await offer.getByLabel("Offer letter (PDF, JPG or PNG)").setInputFiles(PDF);
    await offer.getByRole("button", { name: "Upload offer letter" }).click();
    await ok(k.page, "Offer letter uploaded");
    await k.page.reload();
    await move(k.page, "VISA_PROCESSING");
    await ok(k.page, "moved to Visa processing");
    await k.page.reload();
    // Expected visa date: set, then updated with a time and an explanation.
    const ve = k.page.locator("#visa");
    await ve.getByLabel("Expected visa receiving date").fill(inDays(20));
    await ve.getByRole("button", { name: "Save the expected date" }).click();
    await ok(k.page, "Expected visa date saved");
    await k.page.reload();
    await ve.getByLabel("Expected visa receiving date").fill(inDays(25));
    await ve.getByLabel("Expected time (optional)").fill("14:30");
    await ve.getByLabel(/Explanation for the client/).fill("The embassy added an extra check.");
    await ve.getByRole("button", { name: "Update the expected date" }).click();
    await ok(k.page, "Expected visa date updated");
    await k.page.reload();
    await move(k.page, "FINAL_COLLECTION");
    await alert(k.page, /after the visa is issued; that hasn't happened yet|Record the client's visa/);
    // Nothing was invoiced for the visa instalments yet.
    await expect(k.page.getByText(/Instalment [23] of 3/)).toHaveCount(0);
    await k.page.reload();
    const visa = k.page.locator("#offer");
    await visa.getByLabel("Copy of the visa (PDF, JPG or PNG)").setInputFiles(PDF);
    await visa.getByLabel("Date issued").fill(today());
    await visa.getByRole("button", { name: "Record visa" }).click();
    await ok(k.page, "Visa recorded");
    await k.page.reload();
    await move(k.page, "FINAL_COLLECTION");
    await alert(k.page, /Instalment 2 .* must be paid/);
    await k.close();
  });

  test("the client sees the latest visa estimate, clearly marked as an estimate, and was notified", async ({ browser }) => {
    const c = await as(browser, who.email, who.password);
    await c.page.goto("/portal/applications");
    await c.page.getByRole("link", { name: /FF-WA-/ }).first().click();
    const v = c.page.locator("#visa");
    await expect(v.getByTestId("visa-estimate")).toContainText("Estimated date, not confirmed");
    await expect(v.getByTestId("visa-estimate")).toContainText("around 14:30 (Kigali time)");
    await expect(v.getByTestId("visa-estimate")).toContainText("The embassy added an extra check.");
    await expect(v.getByTestId("visa-estimate")).toContainText("Last updated");
    // The notifications appear inside the Visa processing section, newest first, unread.
    const updated = v.getByTestId("section-notice").filter({ hasText: "Expected visa date updated" });
    await expect(updated).toHaveCount(1);
    await expect(updated).toHaveAttribute("data-unread", "true");
    await expect(v.getByTestId("section-notice").filter({ hasText: "Expected visa date" })).toHaveCount(2);
    // A notification for one section isn't repeated in another.
    await expect(c.page.locator("#invoices").getByText("Expected visa date")).toHaveCount(0);
    await v.getByRole("button", { name: "Mark as read" }).click();
    await expect(updated).not.toHaveAttribute("data-unread", "true");
    await c.close();
  });

  test("loan option only on the third instalment; a pending loan isn't payment; Finance approval completes it", async ({ browser }) => {
    const c = await as(browser, who.email, who.password);
    await c.page.goto("/portal/applications");
    await c.page.getByRole("link", { name: /FF-WA-/ }).first().click();
    const i2 = c.page.locator("li", { hasText: "Instalment 2 of 3" }).first();
    const i3 = c.page.locator("li", { hasText: "Instalment 3 of 3" }).first();
    await expect(i2).toBeVisible();
    await expect(i2.getByText("Request loan-based payment")).toHaveCount(0);
    await expect(i3.getByText("Pay final instalment")).toBeVisible();
    await i3.getByText("Request loan-based payment").click();
    await i3.getByLabel("Bank or lender").fill("Bank of Kigali");
    await i3.getByLabel(/Loan details/).fill("Personal loan, disbursed directly to FIRST FLIGHT within 10 days.");
    await i3.getByLabel(/Loan approval or offer/).setInputFiles(PDF);
    await i3.getByRole("button", { name: "Send loan request" }).click();
    await ok(c.page, /pending review; your instalment is not counted as paid/);
    await c.page.reload();
    await expect(c.page.getByTestId("loan-status").first()).toContainText("pending review (not counted as paid)");
    await expect(c.page.getByTestId("instalment").nth(2)).toContainText("Payable now");

    // Pay instalment 2 normally.
    await i2.getByText(/I've paid INV-/).click();
    await i2.getByLabel("Transaction reference").fill(`MM3-${stamp}`);
    await i2.getByLabel("Date paid").fill(today());
    await i2.getByLabel(/Proof of payment/).setInputFiles(PDF);
    await i2.getByRole("button", { name: /Submit payment for INV-/ }).click();
    await ok(c.page, /Finance/);
    const f = await as(browser, "finance@firstflight.test");
    await f.page.goto("/staff/finance/verify");
    await f.page.locator("article", { hasText: `MM3-${stamp}` }).getByRole("button", { name: "Approve payment" }).click();
    await expect(f.page.locator("article", { hasText: `MM3-${stamp}` })).toHaveCount(0);

    // The pending loan still blocks Final collection.
    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto(appPath);
    await move(k.page, "FINAL_COLLECTION");
    await alert(k.page, /Instalment 3 .* must be paid/);

    await f.page.goto("/staff/finance/loans");
    const card = f.page.getByTestId("loan-card").filter({ hasText: who.name });
    await card.getByRole("button", { name: "Approve loan" }).click();
    await alert(f.page, "verified the loan documents");
    await card.getByLabel("I verified the loan documents with the lender.").check();
    await card.getByLabel("Conditions (shown to the client)").fill("Lender pays FIRST FLIGHT directly.");
    await card.getByRole("button", { name: "Approve loan" }).click();
    await expect(card).toHaveCount(0);
    // Every instalment approved and the visa recorded: the application moved on by itself.
    await k.page.reload();
    await expect(k.page.getByLabel("Stage", { exact: true })).toHaveValue("FINAL_COLLECTION");
    await c.page.reload();
    await expect(c.page.getByTestId("loan-status").first()).toContainText("approved");
    await expect(c.page.getByTestId("remaining")).toHaveText("€0");
    await c.close(); await f.close(); await k.close();
  });
});

test.describe.serial("final collection, completion, refund and reapplication", () => {
  test.describe.configure({ timeout: 90_000 });
  let appPath = "";
  test("the client chooses to continue remotely; the consultant is notified and sees the choice", async ({ browser }) => {
    const c = await as(browser, who.email, who.password);
    await c.page.goto("/portal/applications");
    await c.page.getByRole("link", { name: /FF-WA-/ }).first().click();
    await c.page.waitForURL(/\/portal\/applications\/[^/]+$/);
    appPath = new URL(c.page.url()).pathname.replace("/portal/", "/staff/");
    const fin = c.page.locator("#final");
    await expect(fin.getByRole("button", { name: "Visit the office" })).toBeVisible();
    await fin.getByRole("button", { name: "Continue remotely" }).click();
    await ok(c.page, "you'll continue remotely");
    await c.page.reload();
    await expect(c.page.getByTestId("final-choice")).toHaveText("Continue remotely");
    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto("/staff/notifications");
    await expect(k.page.getByText("Client will continue remotely").first()).toBeVisible();
    await k.page.goto("/staff/final-collection");
    const card = k.page.getByTestId("final-client").filter({ hasText: who.name });
    await expect(card.getByTestId("final-choice")).toHaveText("Continue remotely");
    await expect(card.getByTestId("section-notices")).toHaveCount(0); // section notices sit at the top of the page
    await expect(k.page.getByTestId("section-notices").first()).toContainText("Client will continue remotely");
    await c.close(); await k.close();
  });

  test("the consultant uploads, the client previews, downloads and asks for a correction; the replacement keeps history", async ({ browser }) => {
    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto("/staff/final-collection");
    const card = k.page.getByTestId("final-client").filter({ hasText: who.name });
    await card.getByLabel("Document title").fill("Signed work contract");
    await card.getByLabel("Category").selectOption("CONTRACT");
    await card.getByLabel(/Description or instructions/).fill("Sign page 3 and keep a copy.");
    await card.getByLabel("File (PDF, JPG or PNG)").setInputFiles(PDF);
    await card.getByRole("button", { name: "Upload document" }).click();
    await ok(k.page, /shared with the client/);

    const c = await as(browser, who.email, who.password);
    await c.page.goto(appPath.replace("/staff/", "/portal/"));
    const fin = c.page.locator("#final");
    await expect(fin.getByTestId("section-notice").first()).toContainText("New Final collection document");
    const doc = fin.getByTestId("final-doc").first();
    await expect(doc).toContainText("Signed work contract");
    await expect(doc).toContainText("Employment or study contract");
    await expect(doc).toContainText("Sign page 3 and keep a copy.");
    await expect(doc.getByTestId("final-doc-status")).toHaveText("Available to client");
    const href = await doc.getByRole("link", { name: "Download" }).getAttribute("href");
    const r = await c.page.request.get(href!);
    expect(r.headers()["content-type"]).toBe("application/pdf");
    await doc.getByRole("link", { name: "Preview" }).click();
    await expect(c.page.getByTestId("pdf-frame")).toBeVisible();
    await c.page.goBack();
    await c.page.reload();
    await expect(fin.getByTestId("final-doc-status").first()).toHaveText("Viewed by client");
    await fin.getByText("Something wrong with this document?").click();
    await fin.getByPlaceholder("What needs correcting").fill("My name is misspelled on page 1.");
    await fin.getByRole("button", { name: "Ask for a correction" }).click();
    await ok(c.page, "asked to correct it");

    await k.page.reload();
    await expect(card.getByTestId("final-doc-status").first()).toHaveText("Correction required");
    await card.getByText("Replace or update").click();
    await card.getByLabel("File (PDF, JPG or PNG)").first().setInputFiles(PDF);
    await card.getByRole("button", { name: "Upload new version" }).click();
    await ok(k.page, /shared with the client/);
    await k.page.reload();
    await expect(card.getByTestId("final-doc-status").first()).toHaveText("Updated");
    await expect(card.getByText("Earlier versions (1)")).toBeVisible();
    // Other clients can't open it.
    const other = await as(browser, "client@firstflight.test");
    expect((await other.page.request.get(href!)).status()).toBe(404);
    await k.close(); await c.close(); await other.close();
  });

  test("on completion, refund and reapplication appear at once but stay disabled until their own dates", async ({ browser }) => {
    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto(appPath);
    await k.page.getByLabel("Status").selectOption("COMPLETED");
    await k.page.getByRole("button", { name: "Save progress" }).click();
    await ok(k.page, /marked completed/);
    await k.close();
    const c = await as(browser, who.email, who.password);
    await c.page.goto(appPath.replace("/staff/", "/portal/"));
    const refund = c.page.getByTestId("option-refund"), reapply = c.page.getByTestId("option-reapplication");
    await expect(refund.getByTestId("option-status")).toHaveText("Waiting period");
    await expect(reapply.getByTestId("option-status")).toHaveText("Waiting period");
    await expect(refund).toContainText("You can submit this request in 30 days");
    await expect(reapply).toContainText("You can submit this request in 15 days");
    await expect(refund.getByRole("button", { name: "Request a refund" })).toBeDisabled();
    await expect(reapply.getByRole("button", { name: "Request reapplication" })).toBeDisabled();
    await c.close();
  });

  test("a corrected completion date recalculates each date independently and is audited", async ({ browser }) => {
    const a = await as(browser, "admin@firstflight.test");
    await a.page.goto(appPath);
    await a.page.locator("#completion").getByText("Correct the completion date").click();
    await a.page.locator("#completion").getByLabel("Real completion date").fill(daysAgo(20));
    await a.page.locator("#completion").getByLabel("Reason", { exact: true }).fill("Completed at the office earlier");
    await a.page.getByRole("button", { name: "Save corrected date" }).click();
    await ok(a.page, "eligibility dates recalculated");
    await a.page.goto("/staff/activity?q=" + encodeURIComponent("corrected the completion date"));
    await expect(a.page.getByText(/corrected the completion date of FF-WA-/).first()).toBeVisible();

    const c = await as(browser, who.email, who.password);
    await c.page.goto(appPath.replace("/staff/", "/portal/"));
    const refund = c.page.getByTestId("option-refund"), reapply = c.page.getByTestId("option-reapplication");
    await expect(reapply.getByTestId("option-status")).toHaveText("Available"); // 15 days have passed
    await expect(refund.getByTestId("option-status")).toHaveText("Waiting period"); // 30 haven't
    await expect(refund).toContainText("You can submit this request in 10 days");
    await expect(refund.getByRole("button", { name: "Request a refund" })).toBeDisabled();

    // The server refuses an early request even from a page that showed it as available.
    await reapply.getByText("Request reapplication").click();
    await reapply.getByLabel("Reason").fill("I would like to apply for a different job in the Netherlands.");
    await reapply.getByLabel(/I confirm this information is correct/).check();
    await reapply.getByLabel("Type your full name to sign").fill(who.name);
    await a.page.goto(appPath);
    await a.page.locator("#completion").getByText("Correct the completion date").click();
    await a.page.locator("#completion").getByLabel("Real completion date").fill(daysAgo(1));
    await a.page.locator("#completion").getByLabel("Reason", { exact: true }).fill("Back to the real date");
    await a.page.getByRole("button", { name: "Save corrected date" }).click();
    await ok(a.page, "eligibility dates recalculated");
    await reapply.getByRole("button", { name: "Sign and submit" }).click();
    await alert(c.page, /Reapplication requests for this application open on .* \(in 14 days\)/);

    // Back to 20 days ago: the reapplication goes through, and the refund can't run alongside it.
    await a.page.reload();
    await a.page.locator("#completion").getByText("Correct the completion date").click();
    await a.page.locator("#completion").getByLabel("Real completion date").fill(daysAgo(20));
    await a.page.locator("#completion").getByLabel("Reason", { exact: true }).fill("Confirmed with the office");
    await a.page.getByRole("button", { name: "Save corrected date" }).click();
    await ok(a.page, "eligibility dates recalculated");
    await reapply.getByRole("button", { name: "Sign and submit" }).click();
    await ok(c.page, /Reapplication request RF-\d{4}-\d{4} submitted/);
    await c.page.reload();
    await expect(reapply.getByTestId("option-status")).toHaveText("Submitted");
    await expect(c.page.locator("#after-completion").getByTestId("section-notice").first()).toBeVisible();
    await c.page.goto("/portal/refunds");
    await expect(c.page.getByTestId("refund-row").first()).toContainText("Reapplication instead of a refund");
    await a.close(); await c.close();
  });
});
