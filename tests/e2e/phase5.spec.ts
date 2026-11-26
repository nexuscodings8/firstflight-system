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
  test("finance applies the most specific fee plan; consultants see clearance only; fees stay private", async ({ browser, page }) => {
    const f = await as(browser, "finance@firstflight.test");
    await openDemo(f.page);
    const select = f.page.getByLabel("Fee (most specific first)");
    await expect(select.locator("option").first()).toHaveText(/Netherlands work placement/);
    await f.page.getByRole("button", { name: "Apply fee plan and issue invoices" }).click();
    await expect(f.page.getByText(/Agreed on .* in 3 instalments/)).toBeVisible();
    await expect(f.page.getByText("Instalment 1 of 3: Deposit").first()).toBeVisible();

    // Changing the fee afterwards never changes the agreed price.
    await f.page.goto("/staff/finance/fees");
    const card = f.page.locator("article", { hasText: "Netherlands work placement" });
    await card.getByText("Edit Netherlands work placement").click();
    await card.getByLabel("Total fee").fill("1800");
    await card.getByRole("button", { name: "Save fee" }).click();
    await ok(f.page, "keep their agreed price");

    const c = await as(browser, "client@firstflight.test");
    await openDemo(c.page);
    await expect(c.page.getByText("Service fee").first()).toBeVisible();
    await expect(c.page.getByText("€1,500").first()).toBeVisible();

    const k = await as(browser, "consultant@firstflight.test");
    await openDemo(k.page);
    await expect(k.page.getByRole("heading", { name: "Payment clearance" })).toBeVisible();
    await expect(k.page.getByText("Instalment 1 of 3: Deposit")).toBeVisible();
    await expect(k.page.getByText(/€1,500|€600/)).toHaveCount(0);

    await page.goto("/work/netherlands");
    await expect(page.getByText(/€1,500|1,500\.00/)).toHaveCount(0);
    const a = await as(browser, "admin@firstflight.test");
    await a.page.goto("/staff/activity?q=" + encodeURIComponent("Netherlands work placement"));
    await expect(a.page.getByText(/changed fee "Netherlands work placement" from €1,500 to €1,800/)).toBeVisible();
    await f.close(); await c.close(); await k.close(); await a.close();
  });

  test("refunds: client asks, finance approves, client fills the form, finance pays", async ({ browser }) => {
    const f = await as(browser, "finance@firstflight.test");
    await openDemo(f.page);
    // Pay the deposit invoice (first instalment).
    const deposit = f.page.locator("li", { hasText: "Instalment 1 of 3: Deposit" }).first();
    await deposit.getByText(/Record a payment on/).click();
    await deposit.getByLabel(/Amount \(EUR\)/).fill("600");
    await deposit.getByLabel("Payment reference").fill(`DEP-${stamp}`);
    await deposit.getByLabel("Date paid").fill(new Date().toISOString().slice(0, 10));
    await deposit.getByRole("button", { name: "Record payment and issue receipt" }).click();
    await expect(deposit.getByRole("link", { name: /^Receipt RC-/ })).toBeVisible();

    const c = await as(browser, "client@firstflight.test");
    await openDemo(c.page);
    await c.page.getByText("Request a refund").click();
    const opt = await c.page.getByLabel("Payment to refund").locator("option", { hasText: "Deposit" }).getAttribute("value");
    await c.page.getByLabel("Payment to refund").selectOption(opt!);
    await c.page.getByLabel("Why are you asking for a refund?").fill("My employer cancelled the placement before the start date.");
    await c.page.getByRole("button", { name: "Send refund request" }).click();
    await ok(c.page, /Refund request RF-\d{4}-\d{4} sent/);

    await f.page.goto("/staff/finance/refunds");
    const req = f.page.locator("article", { hasText: "My employer cancelled" });
    await req.getByRole("button", { name: "Approve and open the refund form" }).click();
    await expect(req.getByText("Waiting for the client to fill in the refund form.")).toBeVisible();

    await c.page.reload();
    await c.page.getByLabel(/^Amount \(EUR; up to/).fill("700");
    await c.page.getByLabel("Name on the account").fill("Aline Uwase");
    await c.page.getByLabel("Mobile money number, or bank and account number").fill("+250 788 000 111");
    await c.page.getByLabel(/I confirm these details are correct/).check();
    await c.page.getByRole("button", { name: "Send refund form" }).click();
    await expect(c.page.getByRole("alert").filter({ hasText: "at most €600" })).toBeVisible();
    await c.page.getByLabel(/^Amount \(EUR; up to/).fill("600");
    await c.page.getByRole("button", { name: "Send refund form" }).click();
    await expect(c.page.getByText("Form received: payment pending")).toBeVisible();

    await f.page.reload();
    await expect(req.getByText("+250 788 000 111")).toBeVisible();
    await req.getByLabel("Transfer reference").fill(`RFD-${stamp}`);
    await req.getByRole("button", { name: "Record refund as paid" }).click();
    await expect(req).toHaveCount(0);
    await f.page.goto("/staff/finance/report");
    await expect(f.page.getByRole("heading", { name: "Refunds paid" })).toBeVisible();
    await expect(f.page.getByText(`RFD-${stamp}`)).toBeVisible();

    await c.page.reload();
    await expect(c.page.getByText("Refunded", { exact: true })).toBeVisible();
    await f.close(); await c.close();
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
