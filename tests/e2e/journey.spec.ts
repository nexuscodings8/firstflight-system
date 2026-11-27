import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

// An existing client served manually before the platform: registered at their real stage with a past payment that
// Finance validates, then a schedule where the 2nd and 3rd instalments are payable after the visa (the 3rd by loan).
const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";
const stamp = Date.now();
const who = { name: "Diane Mukamana", email: `diane-${stamp}@example.test`, phone: `+25072${String(stamp).slice(-7)}`, password: "Diane-Pass-2026!" };
const PDF = path.join(__dirname, "sample.pdf");
const today = () => new Date().toISOString().slice(0, 10);
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
