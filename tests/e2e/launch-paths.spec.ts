import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";
const stamp = Date.now();
const client = { name: "Test Client", email: `client-${stamp}@example.test`, phone: "+250 788 000 999", password: "Str0ng-pass-123" };

async function signIn(page: Page, email: string, password = PW) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test.describe.serial("launch paths", () => {
  let appUrl = "";

  test("country card → job details → apply → submitted application in the portal", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Find Jobs Abroad/ }).click();
    await page.getByRole("link", { name: /Germany/ }).click();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Germany");
    await page.getByRole("link", { name: /Care assistant, elderly care/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Care assistant, elderly care");
    await expect(page.getByText("€2,400 – €2,800 per month")).toBeVisible();
    await expect(page.getByText("Police clearance certificate")).toBeVisible();
    await page.getByRole("link", { name: "Apply for this job" }).click();

    // Not signed in: create an account and come straight back with the job carried over.
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByRole("link", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill(client.name);
    await page.getByLabel("Email").fill(client.email);
    await page.getByLabel("Phone").fill(client.phone);
    await page.getByLabel("Password").fill(client.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Care assistant, elderly care");
    await expect(page.getByText("Police clearance certificate")).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.getByText(/Application FF-WA-\d{4}-\d{4} submitted/)).toBeVisible();
    await expect(page.getByText("Being assigned")).toBeVisible();
    appUrl = new URL(page.url()).pathname;

    // Upload a checklist document.
    const item = page.locator("li", { hasText: "Passport copy" }).first();
    await item.locator('input[type="file"]').setInputFiles(path.join(__dirname, "sample.pdf"));
    await item.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(item.getByText("Uploaded, awaiting check")).toBeVisible();
    await expect(item.getByRole("link", { name: "sample.pdf" })).toBeVisible();

    // Applying again for the same job opens the existing application instead of a duplicate.
    await page.goto("/work/germany");
    await page.getByRole("link", { name: /Care assistant, elderly care/ }).click();
    await page.getByRole("link", { name: "Apply for this job" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("You already have an active application")).toBeVisible();
  });

  test("admin assigns the application; consultant sees it and can open the document", async ({ page, browser }) => {
    await signIn(page, "admin@firstflight.test");
    await expect(page).toHaveURL(/\/staff/);
    const row = page.locator("tr", { hasText: client.name });
    await row.getByRole("combobox").selectOption({ label: "Sandrine Umutoni" });
    await row.getByRole("button", { name: "Assign" }).click();
    await expect(page.locator("tr", { hasText: client.name }).getByRole("button", { name: "Reassign" })).toBeVisible();

    const ctx = await browser.newContext();
    const c = await ctx.newPage();
    await signIn(c, "consultant@firstflight.test");
    await c.locator("tr", { hasText: client.name }).getByRole("link").click();
    await expect(c).toHaveURL(/\/staff\/applications\//);
    await expect(c.locator("main").getByText(/Consultant:\s*Sandrine Umutoni/)).toBeVisible();
    const dl = c.waitForEvent("download");
    await c.getByRole("link", { name: "sample.pdf" }).click();
    expect((await dl).suggestedFilename()).toBe("sample.pdf");
    await ctx.close();
  });

  test("other users cannot reach the application or its documents", async ({ browser }) => {
    for (const email of ["client@firstflight.test", "consultant2@firstflight.test", "content@firstflight.test"]) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await signIn(p, email);
      const res = await p.goto(email.startsWith("client") ? appUrl : appUrl.replace("/portal/", "/staff/"));
      expect([403, 404].includes(res!.status()) || (await p.getByText(/Page not found|don't have access/).count()) > 0).toBeTruthy();
      await ctx.close();
    }
    const anon = await browser.newContext();
    const r = await anon.request.get("/api/documents/does-not-matter");
    expect(r.status()).toBe(401);
    await anon.close();
  });

  test("continent → country → university → program → guidance enquiry carries the selection", async ({ page }) => {
    await page.goto("/study");
    await page.getByRole("link", { name: /North America/ }).click();
    await page.getByRole("link", { name: /Canada/ }).click();
    await page.getByRole("link", { name: /University of Manitoba/ }).click();
    await page.getByRole("link", { name: /MSc Data Science/ }).click();
    await expect(page.getByText("CA$21,000 per year")).toBeVisible();
    await expect(page.getByText("September 2027").first()).toBeVisible();
    await page.getByRole("link", { name: "Request guidance" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Request study guidance");
    await expect(page.locator("main dl")).toContainText("MSc Data Science");
    await expect(page.locator("main dl")).toContainText("University of Manitoba");
    await page.getByLabel("Your name").fill("Guidance Tester");
    await page.getByLabel("Email").fill(`guide-${stamp}@example.test`);
    await page.getByLabel("Your message").fill("Which English test do you accept?");
    await page.getByRole("button", { name: "Send to a consultant" }).click();
    await expect(page.getByText(/Your reference is EQ-\d{4}-\d{4}/)).toBeVisible();
  });

  test("study search filters by level and intake", async ({ page }) => {
    await page.goto("/study/search");
    await page.getByLabel("Study level").selectOption("FOUNDATION");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("1 program found")).toBeVisible();
    await expect(page.getByRole("link", { name: /International Foundation Year/ })).toBeVisible();
  });

  test("visa checker → personalised checklist with source and last-checked date", async ({ page }) => {
    await page.goto("/visa");
    await page.getByLabel("1. Passport nationality").selectOption("RW");
    await page.getByLabel("2. Country of residence").selectOption("RW");
    await page.getByLabel("3. Destination country").selectOption("GB");
    await page.getByLabel("4. Destination city").fill("London");
    await page.getByText("Tourist", { exact: true }).click();
    await page.getByRole("button", { name: "Show my checklist" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("UK Standard Visitor visa (tourism)");
    await expect(page.getByText("Bank statements for the last 6 months")).toBeVisible();
    await expect(page.getByText("Invitation letter from your London host")).toBeVisible();
    await expect(page.getByRole("link", { name: "GOV.UK" })).toHaveAttribute("href", "https://www.gov.uk/standard-visitor");
    await expect(page.getByText("Last checked:")).toBeVisible();
  });

  test("visa guidance that needs review → consultation request with the selections carried over", async ({ page }) => {
    await page.goto("/visa/result?nat=RW&res=RW&dest=QA&purpose=transit");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("need a consultant's confirmation");
    await page.getByRole("link", { name: "Request a visa consultation" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Request a visa consultation");
    await expect(page.locator("main dl")).toContainText("Qatar");
    await expect(page.locator("main dl")).toContainText("Rwanda");
  });

  test("no published guidance → consultation", async ({ page }) => {
    await page.goto("/visa/result?nat=RW&res=RW&dest=JP&purpose=business");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("confirm these requirements");
  });

  test("expired promotions never appear; live ones do", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("September intake: application support")).toBeVisible();
    await expect(page.getByText("Expired promotion (test)")).toHaveCount(0);
  });

  test("job filters by category and availability", async ({ page }) => {
    await page.goto("/work/jobs");
    await page.getByLabel("Job category").selectOption({ label: "Hospitality" });
    await page.getByLabel("Availability").selectOption("open");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByText(/\d+ jobs? found/)).toBeVisible();
    for (const t of await page.locator("a h3").allTextContents()) expect(t).not.toMatch(/IT support/);
    await expect(page.getByRole("link", { name: /Hotel housekeeping attendant/ })).toBeVisible();
  });
});
