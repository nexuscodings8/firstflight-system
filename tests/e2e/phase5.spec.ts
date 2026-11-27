import { expect, test, type Browser, type Page } from "@playwright/test";

// Phase 5: private fee plans with instalments, two-step refunds, change requests and flight requests.
const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";
const REF = `FF-WA-${new Date().getFullYear()}-0001`;
const stamp = Date.now();

async function as(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return { page, close: () => ctx.close() };
}
const ok = (p: Page, t: string | RegExp) => expect(p.getByRole("status").filter({ hasText: t }).first()).toBeVisible();
async function openDemo(p: Page) {
  // Clients find it under My applications, staff under Applications.
  await p.goto(new URL(p.url()).pathname.startsWith("/portal") ? "/portal/applications" : "/staff/applications");
  await p.getByRole("link", { name: new RegExp(REF) }).first().click();
  await p.waitForURL(/\/applications\//);
}

test.describe.serial("phase 5: fees, refunds, changes and flights", () => {
  test("finance confirms a stage-based schedule; only the first instalment is invoiced; consultants see clearance only", async ({ browser, page }) => {
    const f = await as(browser, "finance@firstflight.test");
    await openDemo(f.page);
    const select = f.page.getByLabel("Fee (most specific first)");
    await expect(select.locator("option").first()).toHaveText(/Netherlands work placement/);
    await f.page.getByRole("button", { name: "Start from this fee" }).click();
    await ok(f.page, /Draft from "Netherlands work placement"/);
    // (The demo application reached the initial invoice stage in the phase 2 tests; before it, confirming is refused:
    // see the upgrade tests.)
    await f.page.reload();
    const rows = f.page.getByTestId("schedule-row");
    await expect(rows).toHaveCount(3);
    await expect(f.page.getByTestId("schedule-sum")).toHaveText("Instalments add up to the total.");
    await rows.nth(2).getByLabel("Amount").fill("400");
    await expect(f.page.getByTestId("schedule-sum")).toContainText("short");
    await f.page.getByRole("button", { name: "Confirm schedule and issue the first invoice" }).click();
    await expect(f.page.getByRole("alert").filter({ hasText: "must match exactly" })).toBeVisible();
    await f.page.getByRole("button", { name: "Split the rest evenly" }).click();
    await rows.nth(0).getByLabel("Amount").fill("600");
    await rows.nth(1).getByLabel("Amount").fill("450");
    await rows.nth(2).getByLabel("Amount").fill("450");
    await rows.nth(1).getByLabel("Becomes payable").selectOption("OFFER_LETTER");
    await rows.nth(2).getByLabel("Becomes payable").selectOption("VISA");
    await f.page.getByRole("button", { name: "Confirm schedule and issue the first invoice" }).click();
    await ok(f.page, /Schedule confirmed. Invoiced now: INV-/);
    await f.page.reload();
    await expect(f.page.getByText("Instalment 1 of 3: Deposit").first()).toBeVisible();
    await expect(f.page.getByText(/Instalment 2 of 3/)).toHaveCount(0); // not invoiced before the offer letter
    await expect(f.page.getByTestId("instalment").nth(1)).toContainText("Scheduled");

    // Changing the fee afterwards never changes the agreed price.
    await f.page.goto("/staff/finance/fees");
    const card = f.page.locator("article", { hasText: "Netherlands work placement" });
    await card.getByText("Edit Netherlands work placement").click();
    await card.getByLabel("Total fee").fill("1800");
    await card.getByRole("button", { name: "Save fee" }).click();
    await ok(f.page, "keep their agreed price");

    const c = await as(browser, "client@firstflight.test");
    await openDemo(c.page);
    await expect(c.page.getByText("Total agreed fee").first()).toBeVisible();
    await expect(c.page.getByText("€1,500").first()).toBeVisible();
    await expect(c.page.getByTestId("amount-payable")).toContainText("€");
    await expect(c.page.getByText("Instalment 1 of 3: Deposit").first()).toBeVisible();
    await expect(c.page.getByText("Payable after your offer letter is received")).toBeVisible();

    const k = await as(browser, "consultant@firstflight.test");
    await openDemo(k.page);
    await expect(k.page.getByRole("heading", { name: "Payment clearance" })).toBeVisible();
    await expect(k.page.getByTestId("instalment").first()).toContainText("Deposit");
    await expect(k.page.getByText(/€1,500|€600/)).toHaveCount(0);

    await page.goto("/work/netherlands");
    await expect(page.getByText(/€1,500|1,500\.00/)).toHaveCount(0);
    const a = await as(browser, "admin@firstflight.test");
    await a.page.goto("/staff/activity?q=" + encodeURIComponent("Netherlands work placement"));
    await expect(a.page.getByText(/changed fee "Netherlands work placement" from €1,500 to €1,800/)).toBeVisible();
    await f.close(); await c.close(); await k.close(); await a.close();
  });

  test("refunds: client signs the online form; consultant, Finance and admin review; Finance pays", async ({ browser }) => {
    const f = await as(browser, "finance@firstflight.test");
    await openDemo(f.page);
    // Pay the deposit invoice (first instalment).
    const deposit = f.page.locator("li", { hasText: "Instalment 1 of 3: Deposit" }).first();
    await deposit.getByText(/Record a payment on/).click();
    await deposit.getByLabel(/Amount \(EUR\)/).fill("600");
    await deposit.getByLabel("Payment reference", { exact: true }).fill(`DEP-${stamp}`);
    await deposit.getByLabel("Date paid").fill(new Date().toISOString().slice(0, 10));
    await deposit.getByRole("button", { name: "Record payment and issue receipt" }).click();
    await expect(deposit.getByRole("link", { name: /^Receipt RC-/ })).toBeVisible();

    const c = await as(browser, "client@firstflight.test");
    await openDemo(c.page);
    await c.page.getByText("Request a refund or reapply").click();
    await expect(c.page.getByTestId("refund-eligibility")).toContainText("You can request a refund");
    const form = c.page.locator("#refund-form");
    const opt = await form.getByLabel("Payment to refund").locator("option", { hasText: "Deposit" }).getAttribute("value");
    await form.getByLabel("Payment to refund").selectOption(opt!);
    await form.getByLabel("Reason").fill("My employer cancelled the placement before the start date.");
    await form.getByLabel("Amount asked for").fill("700");
    await form.getByLabel("Name on the account").fill("Aline Uwase");
    await form.getByLabel("Mobile money number, or bank and account number").fill("+250 788 000 111");
    await form.getByLabel(/I confirm this information is correct/).check();
    await form.getByLabel("Type your full name to sign").fill("Aline Uwase");
    await form.getByRole("button", { name: "Sign and submit" }).click();
    await expect(form.getByRole("alert").filter({ hasText: "€600" })).toBeVisible();
    await form.getByLabel("Amount asked for").fill("600");
    await form.getByRole("button", { name: "Sign and submit" }).click();
    await ok(c.page, /Refund request RF-\d{4}-\d{4} submitted/);

    // Consultant: reviews without seeing amounts or account details, and can't approve or pay.
    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto("/staff/refunds");
    const kc = k.page.getByTestId("refund-card").filter({ hasText: "My employer cancelled" });
    await expect(kc.getByText("+250 788 000 111")).toHaveCount(0);
    await expect(kc.getByRole("button", { name: /Approve|Record refund/ })).toHaveCount(0);
    await kc.getByLabel("I support it").check();
    await kc.getByPlaceholder(/What you know about the case/).fill("Employer withdrew the offer; confirmed by email.");
    await kc.getByRole("button", { name: "Send to Finance" }).click();
    await ok(k.page, /sent to Finance/);

    await f.page.goto("/staff/refunds");
    const req = f.page.getByTestId("refund-card").filter({ hasText: "My employer cancelled" });
    await expect(req.getByText("+250 788 000 111")).toBeVisible();
    await req.getByLabel(/Amount Finance recommends/).fill("600");
    await req.getByPlaceholder(/What you checked/).fill("Deposit of €600 received and nothing spent yet.");
    await req.getByRole("button", { name: "Send for admin approval" }).click();
    await ok(f.page, /sent for admin approval/);

    const a = await as(browser, "admin@firstflight.test");
    await a.page.goto("/staff/refunds");
    const ar = a.page.getByTestId("refund-card").filter({ hasText: "My employer cancelled" });
    await ar.getByPlaceholder("Note to the client").fill("Approved in full: the employer cancelled.");
    await ar.getByRole("button", { name: "Approve" }).click();
    await ok(a.page, /approved/);

    await f.page.goto("/staff/refunds");
    await req.getByRole("button", { name: "Start processing the payment" }).click();
    await ok(f.page, /being processed/);
    await f.page.reload();
    await req.getByLabel("Transfer reference").fill(`RFD-${stamp}`);
    await req.getByLabel("Date paid").fill(new Date().toISOString().slice(0, 10));
    await req.getByRole("button", { name: "Record refund as paid" }).click();
    await ok(f.page, /completed/);
    await f.page.goto("/staff/finance/report");
    await expect(f.page.getByRole("heading", { name: "Refunds paid" })).toBeVisible();
    await expect(f.page.getByText(`RFD-${stamp}`)).toBeVisible();

    await c.page.goto("/portal/refunds");
    const row = c.page.getByTestId("refund-row").first();
    await expect(row.getByText("Completed", { exact: true })).toBeVisible();
    await expect(row.getByText(`RFD-${stamp}`, { exact: false })).toBeVisible();
    await f.close(); await c.close(); await k.close(); await a.close();
  });

  test("a change request is decided by the consultant", async ({ browser }) => {
    const c = await as(browser, "client@firstflight.test");
    await openDemo(c.page);
    await c.page.getByText("Ask to change something").click();
    await c.page.getByLabel("What do you want to change?").selectOption("CHANGE_DATES");
    await c.page.getByLabel("Details").fill(`I can only start after 15 March ${stamp}.`);
    await c.page.getByRole("button", { name: "Send change request" }).click();
    await ok(c.page, "Change request sent");

    const k = await as(browser, "consultant@firstflight.test");
    await openDemo(k.page);
    const item = k.page.locator("li", { hasText: `15 March ${stamp}` });
    await item.getByPlaceholder("What happens next (shown to the client)").fill("Approved. I've asked the employer for a later start date.");
    await item.getByRole("button", { name: "Approve change" }).click();
    await expect(item.getByText("Approved", { exact: true })).toBeVisible();

    await c.page.reload();
    await expect(c.page.getByText("I've asked the employer for a later start date.").first()).toBeVisible();
    await c.close(); await k.close();
  });

  test("a visitor requests flight options and a consultant sees the route", async ({ page, browser }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Flights" }).click();
    await page.getByLabel("Country").first().selectOption("RW");
    await page.getByLabel("City or airport").first().fill("Kigali");
    await page.getByLabel("Country").nth(1).selectOption("CA");
    await page.getByLabel("City or airport").nth(1).fill("Toronto");
    const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Travel date").fill(d(20));
    await page.getByLabel("Return date").fill(d(10));
    await page.getByLabel("Adults (12+)").fill("2");
    await page.getByLabel("Class").selectOption("BUSINESS");
    await page.getByLabel("Full name").fill(`Flyer ${stamp}`);
    await page.getByLabel("Email").fill(`flyer-${stamp}@example.test`);
    await page.getByLabel("Phone or WhatsApp").fill("+250 788 222 333");
    await page.getByRole("button", { name: "Request flight options" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "return date on or after" })).toBeVisible();
    await page.getByLabel("Return date").fill(d(34));
    await page.getByRole("button", { name: "Request flight options" }).click();
    await expect(page).toHaveURL(/\/enquire\/thanks\?ref=EQ-/);

    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto("/staff/enquiries?show=new");
    const card = k.page.locator("article", { hasText: `Flyer ${stamp}` });
    await expect(card.getByText("Kigali, Rwanda").first()).toBeVisible();
    await expect(card.getByText("Toronto, Canada").first()).toBeVisible();
    await expect(card.getByText("Business").first()).toBeVisible();
    await k.close();
  });
});
