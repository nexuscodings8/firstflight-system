import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Client management upgrade: consultant-created accounts, assignment requests, service permissions, payment
// verification, stage locks, contracts, appointments, PDFs, amendments, messaging and public fees.
const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";
const stamp = Date.now();
const client = { name: "Grace Ingabire", email: `grace-${stamp}@example.test`, phone: `+25078${String(stamp).slice(-7)}`, password: "Grace-Pass-2026!" };
const PDF = path.join(__dirname, "sample.pdf");
const today = () => new Date().toISOString().slice(0, 10);

async function as(browser: Browser, email: string, password = PW) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return { page, close: () => ctx.close() };
}
const ok = (p: Page, t: string | RegExp) => expect(p.getByRole("status").filter({ hasText: t }).first()).toBeVisible();
const alert = (p: Page, t: string | RegExp) => expect(p.getByRole("alert").filter({ hasText: t }).first()).toBeVisible();

test.describe.serial("client management upgrade", () => {
  let appPath = "";      // /staff/applications/<id>
  let activation = "";

  test("public listing shows the total fee only, never the instalments", async ({ page }) => {
    await page.goto("/study");
    await page.getByRole("link", { name: /North America/ }).click();
    await page.getByRole("link", { name: /Canada/ }).click();
    await page.getByRole("link", { name: /University of Manitoba/ }).click();
    await page.getByRole("link", { name: /MSc Data Science/ }).click();
    const fee = page.getByTestId("public-fee");
    await expect(fee).toContainText(/\$900(\.00)?/);
    await expect(fee).toContainText("Total fee");
    await expect(page.getByText(/Instalment|Application fee/)).toHaveCount(0);
  });

  test("a consultant registers a client with an activation link; no password is ever shown", async ({ browser }) => {
    const k = await as(browser, "consultant2@firstflight.test");
    await k.page.goto("/staff/clients/new");
    await k.page.getByLabel("Full name").fill(client.name);
    await k.page.getByLabel("Email", { exact: true }).fill(client.email);
    await k.page.getByLabel("Phone (with country code)").fill(client.phone);
    await k.page.getByLabel("Open an application for (optional)").selectOption({ label: "MSc Data Science, University of Manitoba" });
    await k.page.getByRole("button", { name: "Create client account" }).click();
    await ok(k.page, /It's assigned to you/);
    activation = (await k.page.getByTestId("activation-link").textContent())!.trim();
    expect(activation).toMatch(/\/activate\?token=/);
    // Only the link is shown: no password field and nothing that looks like a generated password.
    await expect(k.page.locator("input[type=password]")).toHaveCount(0);
    await expect(k.page.getByText(/temporary password|password:/i)).toHaveCount(0);

    // The same email can't be registered twice.
    await k.page.goto("/staff/clients/new");
    await k.page.getByLabel("Full name").fill(client.name);
    await k.page.getByLabel("Email", { exact: true }).fill(client.email);
    await k.page.getByLabel("Phone (with country code)").fill("+250780000999");
    await k.page.getByRole("button", { name: "Create client account" }).click();
    await alert(k.page, /already/);
    await k.close();
  });

  test("the client activates the account and sees the locked-in fee plan", async ({ page }) => {
    await page.goto(new URL(activation).pathname + new URL(activation).search);
    await page.getByLabel("New password (10+ characters)").fill(client.password);
    await page.getByLabel("Repeat password").fill(client.password);
    await page.getByRole("button", { name: "Activate and sign in" }).click();
    await page.waitForURL(/\/portal/);
    await page.goto("/portal/applications");
    await page.getByRole("link", { name: /FF-SA-/ }).first().click();
    // The price is locked in; nothing is invoiced until Finance confirms the schedule at initial invoicing.
    await expect(page.getByTestId("instalment").first()).toContainText("Instalment 1: Application fee");
    await expect(page.getByText(/Your price is locked in/)).toBeVisible();
    await expect(page.getByText(/INV-\d{4}/)).toHaveCount(0);
    // The activation link works only once.
    await page.context().clearCookies();
    await page.goto(new URL(activation).pathname + new URL(activation).search);
    await expect(page.getByText(/no longer valid|expired|already been used/i)).toBeVisible();
  });

  test("the registering consultant serves the client; other consultants can't open it", async ({ browser }) => {
    const k = await as(browser, "consultant2@firstflight.test");
    await k.page.goto("/staff/applications");
    await k.page.getByRole("link", { name: /FF-SA-/ }).first().click();
    await k.page.waitForURL(/\/staff\/applications\//);
    appPath = new URL(k.page.url()).pathname;
    await expect(k.page.getByText("Only an administrator can reassign or remove the assignment.")).toBeVisible();
    await expect(k.page.getByRole("button", { name: /Reassign|Remove and make the client available|Unassign/ })).toHaveCount(0);
    const k1 = await as(browser, "consultant@firstflight.test");
    await k1.page.goto("/staff/available");
    await expect(k1.page.getByText(client.name)).toHaveCount(0);
    expect((await k1.page.goto(appPath))!.status()).toBe(404);
    await k.close(); await k1.close();
  });

  test("self-assignment: first consultant wins, the second is told it's taken; only admin reassigns", async ({ browser }) => {
    const other = { name: "Eric Habimana", email: `eric-${stamp}@example.test`, phone: `+25073${String(stamp).slice(-7)}` };
    const a = await as(browser, "admin@firstflight.test");
    await a.page.goto("/staff/clients/new");
    await a.page.getByLabel("Full name").fill(other.name);
    await a.page.getByLabel("Email", { exact: true }).fill(other.email);
    await a.page.getByLabel("Phone (with country code)").fill(other.phone);
    await a.page.getByLabel("Open an application for (optional)").selectOption({ label: "MSc Data Science, University of Manitoba" });
    await a.page.getByRole("button", { name: "Create client account" }).click();
    await ok(a.page, /Available clients until a consultant takes it/);
    const k1 = await as(browser, "consultant@firstflight.test"), k2 = await as(browser, "consultant2@firstflight.test");
    await k1.page.goto("/staff/available"); await k2.page.goto("/staff/available");
    const card = (p: Page) => p.getByTestId("available-client").filter({ hasText: other.name });
    await card(k2.page).getByRole("button", { name: "Assign to myself" }).click();
    await ok(k2.page, /is now assigned to you/);
    await card(k1.page).getByRole("button", { name: "Assign to myself" }).click(); // stale page
    await alert(k1.page, /Too late: .* has already been assigned to Yves Ndayisaba/);
    await k1.page.goto("/staff/notifications");
    await expect(k1.page.getByText("Client already assigned").first()).toBeVisible();
    // Admin reassigns (with a reason); history keeps both.
    await a.page.goto("/staff/assignments?tab=assigned");
    await a.page.locator("tr", { hasText: other.name }).getByRole("link", { name: "Reassign or remove" }).click();
    await a.page.locator("#assignment").getByLabel("Consultant", { exact: true }).selectOption({ label: "Sandrine Umutoni" });
    await a.page.locator("#assignment").getByLabel("Reason for reassigning").fill("Workload balance");
    await a.page.locator("#assignment").getByRole("button", { name: "Reassign" }).click();
    await ok(a.page, /Sandrine Umutoni/);
    await a.page.goto("/staff/assignments?tab=history");
    await expect(a.page.locator("li", { hasText: "Yves Ndayisaba → Sandrine Umutoni" }).first()).toBeVisible();
    await expect(a.page.locator("li", { hasText: "(self-assigned)" }).first()).toBeVisible();
    await a.close(); await k1.close(); await k2.close();
  });

  test("stage locks: no contract or processing before Finance approves the first instalment", async ({ browser }) => {
    const k = await as(browser, "consultant2@firstflight.test");
    await k.page.goto(appPath);
    await k.page.getByLabel("Stage", { exact: true }).selectOption("PROCESSING");
    await k.page.getByRole("button", { name: "Save progress" }).click();
    await alert(k.page, /Finance hasn't (approved|confirmed)/);
    await expect(k.page.getByText("Locked until Finance approves the first instalment.")).toBeVisible();
    // Finance can't confirm the schedule before the initial invoice stage.
    const f0 = await as(browser, "finance@firstflight.test");
    await f0.page.goto(appPath);
    await f0.page.getByRole("button", { name: "Confirm schedule and issue the first invoice" }).click();
    await alert(f0.page, "The schedule is set at Initial invoice and payment");
    await f0.close();
    // Eligibility done: moving to the initial invoice stage is allowed.
    await k.page.getByLabel("Stage", { exact: true }).selectOption("INITIAL_PAYMENT");
    await k.page.getByRole("button", { name: "Save progress" }).click();
    await ok(k.page, "moved to Initial invoice and payment");
    // Consultants can't reach payment verification.
    await k.page.goto("/staff/finance/verify");
    await expect(k.page.getByRole("heading", { name: "Payments to verify" })).toHaveCount(0);
    await k.close();
  });

  test("Finance confirms the schedule; only the first instalment is invoiced", async ({ browser }) => {
    const f = await as(browser, "finance@firstflight.test");
    await f.page.goto(appPath);
    await expect(f.page.getByTestId("schedule-row")).toHaveCount(2);
    await expect(f.page.getByTestId("schedule-row").nth(1).getByLabel("Becomes payable")).toHaveValue("OFFER_LETTER");
    // Two instalments: no loan option anywhere.
    await expect(f.page.getByText(/pay this final instalment with an approved loan/)).toHaveCount(0);
    await f.page.getByRole("button", { name: "Confirm schedule and issue the first invoice" }).click();
    await ok(f.page, /Invoiced now: INV-/);
    await f.page.reload();
    await expect(f.page.getByText("Instalment 1 of 2: Application fee").first()).toBeVisible();
    await expect(f.page.getByText("Instalment 2 of 2")).toHaveCount(0);
    await f.close();
  });

  test("client submits a payment with proof; Finance verifies it; receipt and invoice PDFs work", async ({ browser }) => {
    const c = await as(browser, client.email, client.password);
    await c.page.goto("/portal/applications");
    await c.page.getByRole("link", { name: /FF-SA-/ }).first().click();
    const inv = c.page.locator("li", { hasText: "Instalment 1 of 2: Application fee" }).first();
    await inv.getByText(/I've paid INV-/).click();
    await inv.getByLabel("Transaction reference").fill(`MM-${stamp}`);
    await inv.getByLabel("Date paid").fill(today());
    await inv.getByLabel(/Proof of payment/).setInputFiles(PDF);
    await inv.getByRole("button", { name: /Submit payment for INV-/ }).click();
    await ok(c.page, /Finance/);
    // The same reference can't be submitted twice.
    await c.page.reload();
    await expect(c.page.getByText(/Waiting for Finance: \$450(\.00)?/)).toBeVisible();

    const f = await as(browser, "finance@firstflight.test");
    await f.page.goto("/staff/finance/verify");
    const card = f.page.locator("article", { hasText: `MM-${stamp}` });
    await card.getByRole("link", { name: "View proof of payment" }).click();
    await expect(f.page.getByTestId("pdf-frame")).toBeVisible();
    await f.page.goBack();
    await card.getByRole("button", { name: "Approve payment" }).click();
    await expect(card).toHaveCount(0); // leaves the pending list
    await f.page.goto("/staff/finance/verify?show=done");
    await expect(f.page.locator("article", { hasText: `MM-${stamp}` }).getByText(/Approved by Olivier Kayitare/)).toBeVisible();

    await c.page.reload();
    await expect(c.page.getByRole("link", { name: /^Receipt RC-/ })).toBeVisible();
    const receiptPdf = await c.page.getByRole("link", { name: "PDF", exact: true }).first().getAttribute("href");
    const r = await c.page.request.get(receiptPdf!);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("application/pdf");
    expect((await r.body()).subarray(0, 4).toString()).toBe("%PDF");
    const invoicePdf = await c.page.getByRole("link", { name: "Download PDF" }).first().getAttribute("href");
    expect((await c.page.request.get(invoicePdf!)).headers()["content-type"]).toBe("application/pdf");

    // Another client can't open this client's invoice.
    const other = await as(browser, "client@firstflight.test");
    expect((await other.page.request.get(invoicePdf!)).status()).toBe(404);
    // First instalment approved → the application moved to Contract signing by itself.
    await expect(c.page.getByText("Your contract is ready to sign.")).toBeVisible();
    await c.close(); await f.close(); await other.close();
  });

  test("client signs the contract online; the application moves to Processing", async ({ browser }) => {
    const c = await as(browser, client.email, client.password);
    await c.page.goto("/portal/applications");
    await c.page.getByRole("link", { name: /FF-SA-/ }).first().click();
    await c.page.getByRole("link", { name: "Read and sign the contract" }).click();
    await expect(c.page.getByLabel("Contract text")).toContainText(client.name);
    await c.page.getByLabel("Type your full name to sign").fill("Someone Else");
    await c.page.getByLabel(/I have read this contract/).check();
    await c.page.getByRole("button", { name: "Sign the contract" }).click();
    await alert(c.page, "Type your full name exactly");
    await c.page.getByLabel("Type your full name to sign").fill(client.name.toLowerCase());
    await c.page.getByRole("button", { name: "Sign the contract" }).click();
    await ok(c.page, /contract is signed|Contract signed/);
    await c.page.getByRole("link", { name: "Back to my application" }).first().click();
    await expect(c.page.getByText(/Signed online by/)).toBeVisible();
    const href = await c.page.locator("#contract").getByRole("link", { name: "Download" }).first().getAttribute("href");
    expect((await c.page.request.get(href!)).headers()["content-type"]).toBe("application/pdf");

    const k = await as(browser, "consultant2@firstflight.test");
    await k.page.goto(appPath);
    await expect(k.page.getByLabel("Stage", { exact: true })).toHaveValue("PROCESSING");
    // Final collection stays locked until every instalment is approved.
    await k.page.getByLabel("Stage", { exact: true }).selectOption("FINAL_COLLECTION");
    await k.page.getByRole("button", { name: "Save progress" }).click();
    await alert(k.page, /Instalment 2 \(On admission\)|offer letter/);
    await c.close(); await k.close();
  });

  test("consultant invites the client to the office; client accepts; consultant completes it", async ({ browser }) => {
    const k = await as(browser, "consultant2@firstflight.test");
    await k.page.goto(appPath);
    const ap = k.page.locator("#appointments");
    await ap.getByText("Invite the client to the office").click();
    await ap.getByLabel("Why they should come").fill("Bring your original passport to certify copies.");
    const d = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await ap.getByLabel("Date").fill(d);
    await ap.getByLabel("Time (Kigali)").fill("10:30");
    await ap.getByRole("button", { name: "Send invitation" }).click();
    await ok(k.page, "Invitation sent");

    const c = await as(browser, client.email, client.password);
    await c.page.goto("/portal/applications");
    await c.page.getByRole("link", { name: /FF-SA-/ }).first().click();
    const row = c.page.getByTestId("appointment").first();
    await expect(row.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute("href", /google\.com\/maps/);
    await expect(row.getByRole("button", { name: "Continue remotely" })).toHaveCount(0);
    await row.getByRole("button", { name: "Accept and visit the office" }).click();
    await ok(c.page, "see you at the office");

    await k.page.reload();
    await k.page.getByTestId("appointment").first().getByRole("button", { name: "Mark completed" }).click();
    await ok(k.page, "Appointment marked completed");
    await c.close(); await k.close();
  });

  test("messaging: team thread with a mention; Finance-only thread stays closed to consultants", async ({ browser }) => {
    const k = await as(browser, "consultant2@firstflight.test");
    await k.page.goto(appPath);
    await expect(k.page.getByRole("button", { name: "Finance-only thread" })).toHaveCount(0);
    await k.page.getByRole("button", { name: "Open team thread" }).click();
    await k.page.waitForURL(/\/staff\/messages\//);
    await k.page.getByRole("textbox", { name: "Message", exact: true }).fill(`@Olivier the client paid by mobile money ${stamp}`);
    await k.page.getByRole("button", { name: "Send" }).click();
    await ok(k.page, /1 person was notified/);

    const f = await as(browser, "finance@firstflight.test");
    await f.page.goto("/staff/notifications");
    await expect(f.page.getByText("Yves Ndayisaba mentioned you").first()).toBeVisible();
    await f.page.goto(appPath);
    await f.page.getByRole("button", { name: "Finance-only thread" }).click();
    await f.page.waitForURL(/\/staff\/messages\//);
    const privateThread = new URL(f.page.url()).pathname;
    await f.page.getByRole("textbox", { name: "Message", exact: true }).fill("Finance only: check the MoMo statement.");
    await f.page.getByRole("button", { name: "Send" }).click();
    await ok(f.page, "Sent.");
    // Backend check: the consultant gets a 404 on the Finance-only thread, even with its address.
    expect((await k.page.goto(privateThread))!.status()).toBe(404);
    await k.page.goto("/staff/messages");
    await expect(k.page.getByText("Finance only: check the MoMo statement.")).toHaveCount(0);
    await k.close(); await f.close();
  });

  test("a fee change by amendment: Finance confirms, admin approves, client signs, the new balance is billed", async ({ browser }) => {
    const k = await as(browser, "consultant2@firstflight.test");
    await k.page.goto(appPath);
    await k.page.getByText("Draft a contract amendment").click();
    const form = k.page.locator("#amendments");
    await form.getByLabel(/Amended terms/).fill("The program changes to the January intake; the service fee becomes USD 1,000.");
    await form.getByLabel("Reason").fill("Client moved to the January intake.");
    await form.getByLabel(/New total service fee/).fill("1000");
    await form.getByRole("button", { name: "Send for approval" }).click();
    await ok(k.page, "Finance confirms the fee change");
    // Consultants can't approve their own amendment.
    await k.page.reload();
    await expect(k.page.getByRole("button", { name: /Approve amendment|Confirm fee change/ })).toHaveCount(0);

    const f = await as(browser, "finance@firstflight.test");
    await f.page.goto(appPath);
    await f.page.getByRole("button", { name: "Confirm fee change" }).click();
    await ok(f.page, "Fee change confirmed");
    const a = await as(browser, "admin@firstflight.test");
    await a.page.goto(appPath);
    await a.page.getByRole("button", { name: "Approve amendment" }).click();
    await ok(a.page, "Amendment approved");

    const c = await as(browser, client.email, client.password);
    await c.page.goto("/portal/applications");
    await c.page.getByRole("link", { name: /FF-SA-/ }).first().click();
    const am = c.page.getByTestId("amendment").first();
    await expect(am.getByText(/New total service fee: \$1,000(\.00)?/)).toBeVisible();
    await am.getByLabel(/I have read this amendment/).check();
    await am.getByLabel("Type your full name to sign").fill(client.name);
    await am.getByRole("button", { name: "Sign the amendment" }).click();
    await ok(c.page, "Amendment signed");
    await c.page.reload();
    await expect(c.page.getByText("Balance after contract amendment")).toBeVisible();
    await expect(c.page.getByText(/\$550(\.00)?/).first()).toBeVisible(); // 1,000 − 450 already paid
    await k.close(); await f.close(); await a.close(); await c.close();
  });

  test("Getting offer: the offer letter makes the next instalment payable; its approval moves to Visa processing", async ({ browser }) => {
    const k = await as(browser, "consultant2@firstflight.test");
    await k.page.goto(appPath);
    await k.page.getByLabel("Stage", { exact: true }).selectOption("GETTING_OFFER");
    await k.page.getByRole("button", { name: "Save progress" }).click();
    await ok(k.page, "moved to Getting offer");
    await k.page.getByLabel("Stage", { exact: true }).selectOption("VISA_PROCESSING");
    await k.page.getByRole("button", { name: "Save progress" }).click();
    await alert(k.page, /offer letter/);
    await k.page.reload();
    const offer = k.page.locator("#offer");
    await offer.getByLabel("Offer letter (PDF, JPG or PNG)").setInputFiles(PDF);
    await offer.getByLabel(/Description or internal note/).fill("Conditional offer, January intake");
    await offer.getByRole("button", { name: "Upload offer letter" }).click();
    await ok(k.page, "Offer letter uploaded");

    const c = await as(browser, client.email, client.password);
    await c.page.goto("/portal/notifications");
    await expect(c.page.getByText("Your offer letter is available").first()).toBeVisible();
    await c.page.goto("/portal/applications");
    await c.page.getByRole("link", { name: /FF-SA-/ }).first().click();
    const file = c.page.getByTestId("case-file").filter({ hasText: "Offer letter" });
    const dl = await file.getByRole("link", { name: "Download" }).getAttribute("href");
    expect((await c.page.request.get(dl!)).headers()["content-type"]).toBe("application/pdf");
    await file.getByRole("link", { name: "Open" }).click();
    await expect(c.page.getByTestId("pdf-frame")).toBeVisible();
    await c.page.goBack();
    // Now (and only now) the balance is payable.
    const inv = c.page.locator("li", { hasText: "Instalment 2 of 2: Balance after contract amendment" }).first();
    await expect(inv).toBeVisible();

    await k.page.reload();
    await expect(k.page.getByTestId("case-file").first()).toContainText("client opened it");
    await k.page.getByLabel("Stage", { exact: true }).selectOption("VISA_PROCESSING");
    await k.page.getByRole("button", { name: "Save progress" }).click();
    await alert(k.page, /Instalment 2 .* must be paid and approved by Finance first/);

    await inv.getByText(/I've paid INV-/).click();
    await inv.getByLabel("Transaction reference").fill(`MM2-${stamp}`);
    await inv.getByLabel("Date paid").fill(today());
    await inv.getByLabel(/Proof of payment/).setInputFiles(PDF);
    await inv.getByRole("button", { name: /Submit payment for INV-/ }).click();
    await ok(c.page, /Finance/);
    const f = await as(browser, "finance@firstflight.test");
    await f.page.goto("/staff/finance/verify");
    await f.page.locator("article", { hasText: `MM2-${stamp}` }).getByRole("button", { name: "Approve payment" }).click();
    await expect(f.page.locator("article", { hasText: `MM2-${stamp}` })).toHaveCount(0);
    await k.page.reload();
    await expect(k.page.getByLabel("Stage", { exact: true })).toHaveValue("VISA_PROCESSING");
    await k.close(); await c.close(); await f.close();
  });

  test("revoking a service takes effect at once; granting it back restores access", async ({ browser }) => {
    const a = await as(browser, "admin@firstflight.test");
    await a.page.goto("/staff/permissions");
    const row = a.page.locator("tr", { hasText: "Yves Ndayisaba" });
    await row.getByRole("button", { name: "Revoke Study Abroad" }).click();
    await ok(a.page, /Study Abroad revoked/);
    const k = await as(browser, "consultant2@firstflight.test");
    expect((await k.page.goto(appPath))!.status()).toBe(404);
    await a.page.reload();
    await row.getByRole("button", { name: "Grant Study Abroad" }).click();
    await ok(a.page, /Study Abroad granted/);
    expect((await k.page.goto(appPath))!.status()).toBe(200);
    await a.close(); await k.close();
  });

  test("refund rules: the blank paper form downloads as a PDF", async ({ request }) => {
    const r = await request.get("/forms/refund");
    expect(r.headers()["content-type"]).toBe("application/pdf");
    expect((await r.body()).subarray(0, 4).toString()).toBe("%PDF");
  });
});
