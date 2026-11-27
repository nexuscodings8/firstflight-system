import { expect, test, type Browser, type Page } from "@playwright/test";
import path from "node:path";

// Phase 2 staff workflows against the seeded demo application (FF-WA-<year>-0001, client Aline, consultant Sandrine).
const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";
const REF = `FF-WA-${new Date().getFullYear()}-0001`;
const PDF = path.join(__dirname, "sample.pdf");
const stamp = Date.now();

async function signIn(page: Page, email: string, password = PW) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function as(browser: Browser, email: string, password = PW) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, email, password);
  return { page, close: () => ctx.close() };
}
const item = (page: Page, labelText: string) => page.locator("li", { has: page.getByText(labelText, { exact: true }) }).first();

test.describe.serial("phase 2: staff workflows", () => {
  let staffUrl = "", clientUrl = "", invoiceUrl = "", receiptUrl = "";

  test("client uploads; consultant rejects with a reason, then verifies the new copy", async ({ browser }) => {
    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto("/staff/applications");
    await k.page.getByRole("link", { name: REF }).click();
    await k.page.waitForURL(/\/staff\/applications\//);
    staffUrl = k.page.url();
    clientUrl = staffUrl.replace("/staff/", "/portal/");

    const c = await as(browser, "client@firstflight.test");
    await c.page.goto(clientUrl);
    await item(c.page, "Passport copy").getByLabel("Choose a file for Passport copy").setInputFiles(PDF);
    await item(c.page, "Passport copy").getByRole("button", { name: "Upload" }).click();
    await expect(c.page.getByRole("status").filter({ hasText: "sample.pdf uploaded." })).toBeVisible();

    await k.page.reload();
    const row = item(k.page, "Passport copy");
    await row.getByRole("button", { name: "Reject" }).click();
    await expect(row.getByRole("alert").filter({ hasText: "Tell the client why" })).toBeVisible();
    await row.getByLabel("Reason for rejecting Passport copy").fill("The photo page is cut off. Please scan the whole page.");
    await row.getByRole("button", { name: "Reject" }).click();
    await expect(k.page.getByText("rejected; the client has been told why")).toBeVisible();

    await c.page.reload();
    await expect(item(c.page, "Passport copy").getByText("Please re-upload")).toBeVisible();
    await expect(c.page.getByText("The photo page is cut off. Please scan the whole page.").first()).toBeVisible();
    await item(c.page, "Passport copy").getByLabel("Choose a file for Passport copy").setInputFiles(PDF);
    await item(c.page, "Passport copy").getByRole("button", { name: "Upload" }).click();
    await expect(c.page.getByRole("status").filter({ hasText: "sample.pdf uploaded." })).toBeVisible();

    await k.page.reload();
    await item(k.page, "Passport copy").getByRole("button", { name: "Verify Passport copy" }).click();
    await expect(item(k.page, "Passport copy").getByText("Verified", { exact: true })).toBeVisible();
    await c.page.reload();
    await expect(item(c.page, "Passport copy").getByText("Verified", { exact: true })).toBeVisible();
    await expect(item(c.page, "Passport copy").getByText(/Verified by Sandrine Umutoni/)).toBeVisible();
    await k.close(); await c.close();
  });

  test("consultant requests a document, posts an update and an internal note, and moves the stage", async ({ browser }) => {
    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto(staffUrl);
    await k.page.getByText("Request another document").click();
    await k.page.getByLabel("Document needed").fill("Police clearance certificate");
    await k.page.getByLabel("Instructions for the client (optional)").fill("Issued in the last 6 months");
    await k.page.getByRole("button", { name: "Request from client" }).click();
    await expect(k.page.getByRole("status").filter({ hasText: 'Requested "Police clearance certificate"' })).toBeVisible();

    await k.page.getByLabel("Message", { exact: true }).fill("Your file looks good so far.");
    await k.page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(k.page.getByRole("status").filter({ hasText: "Update posted." })).toBeVisible();
    await k.page.getByLabel("Message", { exact: true }).fill(`Employer prefers candidates with greenhouse experience ${stamp}`);
    await k.page.getByLabel("Internal note (staff only)").check();
    await k.page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(k.page.getByRole("status").filter({ hasText: "Internal note saved." })).toBeVisible();

    await k.page.getByLabel("Stage", { exact: true }).selectOption({ label: "Initial payment" });
    await k.page.getByRole("button", { name: "Save progress" }).click();
    await expect(k.page.getByRole("status").filter({ hasText: "Application moved to Initial payment." })).toBeVisible();

    const c = await as(browser, "client@firstflight.test");
    await c.page.goto(clientUrl);
    await expect(item(c.page, "Police clearance certificate").getByText("Requested by consultant")).toBeVisible();
    await expect(c.page.getByText("Your file looks good so far.")).toBeVisible();
    await expect(c.page.getByText(`greenhouse experience ${stamp}`)).toHaveCount(0);
    await expect(c.page.getByText("In progress").first()).toBeVisible();
    await k.close(); await c.close();
  });

  test("finance issues an instalment invoice, records payments, blocks duplicates and overpayment", async ({ browser }) => {
    const f = await as(browser, "finance@firstflight.test");
    await f.page.goto(staffUrl);
    await f.page.getByLabel("What it is for").fill("Instalment 1 of 2: processing fee");
    await f.page.getByLabel("Amount", { exact: true }).fill("300");
    await f.page.getByLabel("Currency").selectOption("USD");
    await f.page.getByRole("button", { name: "Issue invoice", exact: true }).click();
    await expect(f.page.getByRole("status").filter({ hasText: /Invoice INV-\d{4}-\d{4} issued/ })).toBeVisible();
    await f.page.reload();

    const record = async (amount: string, ref: string) => {
      await f.page.getByText(/Record a payment on INV-/).first().click();
      await f.page.getByLabel("Amount (USD)").fill(amount);
      await f.page.getByLabel("Method").selectOption({ label: "Mobile money" });
      await f.page.getByLabel("Payment reference", { exact: true }).fill(ref);
      await f.page.getByLabel("Date paid").fill(new Date().toISOString().slice(0, 10));
      await f.page.getByRole("button", { name: "Record payment and issue receipt" }).click();
    };
    await record("100", `MP ${stamp}`);
    await expect(f.page.getByRole("status").filter({ hasText: /Payment recorded\. Receipt RC-\d{4}-\d{4} issued\./ })).toBeVisible();
    await f.page.reload();
    await record("50", `mp${stamp}`);
    await expect(f.page.getByRole("alert").filter({ hasText: "was already recorded" })).toBeVisible();
    await f.page.reload();
    await record("250", `BK-${stamp}`);
    await expect(f.page.getByRole("alert").filter({ hasText: "more than the balance" })).toBeVisible();

    invoiceUrl = new URL((await f.page.getByRole("link", { name: /^INV-/ }).first().getAttribute("href"))!, f.page.url()).toString();
    receiptUrl = new URL((await f.page.getByRole("link", { name: /^Receipt RC-/ }).first().getAttribute("href"))!, f.page.url()).toString();
    await f.page.goto(invoiceUrl);
    await expect(f.page.getByText("Balance due")).toBeVisible();
    await expect(f.page.getByText("$200").first()).toBeVisible();

    await f.page.goto(`/staff/finance/report`);
    await expect(f.page.getByText(`MP${stamp}`)).toBeVisible();
    const dl = f.page.waitForEvent("download");
    await f.page.getByRole("link", { name: "Download CSV" }).click();
    expect((await dl).suggestedFilename()).toMatch(/^firstflight-payments-\d{4}-\d{2}\.csv$/);
    await f.close();
  });

  test("client sees balance, invoice and receipt; other people cannot", async ({ browser }) => {
    const c = await as(browser, "client@firstflight.test");
    await c.page.goto(clientUrl);
    await expect(c.page.getByText("Balance due:")).toBeVisible();
    await c.page.goto(receiptUrl);
    await expect(c.page.getByText("RECEIPT", { exact: true })).toBeVisible();
    await expect(c.page.getByText("$100").first()).toBeVisible();
    await c.close();
    for (const email of ["consultant2@firstflight.test"]) { // (content@ has a changed password after password.spec)
      const o = await as(browser, email);
      for (const u of [invoiceUrl, receiptUrl]) { await o.page.goto(u); await expect(o.page.getByText(/Page not found/i)).toBeVisible(); }
      await o.close();
    }
  });

  test("admin adds a staff member, who must choose a password; deactivated accounts can't sign in", async ({ browser }) => {
    const a = await as(browser, "admin@firstflight.test");
    await a.page.goto("/staff/users");
    const email = `new.consultant.${stamp}@example.test`;
    await a.page.getByLabel("Full name").fill("Test New Consultant");
    await a.page.getByLabel("Email").fill(email);
    await a.page.getByLabel("Role").first().selectOption("CONSULTANT");
    await a.page.getByRole("button", { name: "Create account" }).click();
    const temp = (await a.page.getByTestId("temp-password").textContent())!.trim();
    expect(temp).toMatch(/^Ff-/);

    const n = await (await browser.newContext()).newPage();
    await signIn(n, email, temp);
    await expect(n).toHaveURL(/\/account\/password\?required=1/);
    await n.goto("/staff");
    await expect(n).toHaveURL(/\/account\/password/);
    await n.getByLabel("Temporary password").fill(temp);
    await n.getByLabel("New password", { exact: true }).fill("Consultant-own-2026");
    await n.getByLabel("Repeat new password").fill("Consultant-own-2026");
    await n.getByRole("button", { name: "Change password" }).click();
    await n.getByRole("link", { name: "Continue" }).click();
    await expect(n.getByRole("heading", { name: /Welcome, Test/ })).toBeVisible();

    await a.page.reload();
    const row = a.page.locator("li", { hasText: email });
    await row.getByText("Manage Test New Consultant").click();
    await row.getByRole("button", { name: "Deactivate account" }).click();
    await expect(row.getByText("can no longer sign in")).toBeVisible();
    await n.goto("/staff");
    await expect(n).toHaveURL(/\/login/);
    await n.getByLabel("Email").fill(email);
    await n.getByLabel("Password").fill("Consultant-own-2026");
    await n.getByRole("button", { name: "Sign in" }).click();
    await expect(n.getByText("This account is deactivated")).toBeVisible();

    await a.page.goto("/staff/activity?q=" + encodeURIComponent("Test New Consultant"));
    await expect(a.page.getByText(/deactivated Test New Consultant/)).toBeVisible();
    await a.close();
  });

  test("a consultant takes an enquiry and closes it with the answer", async ({ page, browser }) => {
    await page.goto("/enquire?type=GENERAL");
    await page.getByLabel(/Full name|Your name|Name/).first().fill(`Enquirer ${stamp}`);
    await page.getByLabel("Email").fill(`enquirer-${stamp}@example.test`);
    await page.getByLabel(/message|question/i).first().fill("Do you help with Canadian student visas?");
    await page.getByRole("button", { name: /Send/ }).click();
    await expect(page).toHaveURL(/thanks/);

    const k = await as(browser, "consultant@firstflight.test");
    await k.page.goto("/staff/enquiries?show=new");
    const card = k.page.locator("article", { hasText: `Enquirer ${stamp}` });
    await card.getByRole("button", { name: "Take this enquiry" }).click();
    await expect(card).toHaveCount(0); // it leaves the "New" list once taken
    await k.page.goto("/staff/enquiries?show=mine");
    const mine = k.page.locator("article", { hasText: `Enquirer ${stamp}` });
    await mine.getByText("Record answer and close").click();
    await mine.getByLabel("Answer given").fill("Yes. Book a consultation and bring your admission letter.");
    await mine.getByRole("button", { name: "Close enquiry" }).click();
    await expect(mine).toHaveCount(0); // closed enquiries leave the "Mine" list
    await k.page.goto("/staff/enquiries?show=closed");
    await expect(k.page.getByText("Yes. Book a consultation and bring your admission letter.")).toBeVisible();
    await k.close();
  });
});
