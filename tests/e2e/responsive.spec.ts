import { expect, test, type Page } from "@playwright/test";

// Layout checks on every screen size (desktop, phone, tablet): nothing spills sideways, the page heading
// is visible, and the floating help buttons and panels fit the screen.
const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const PUBLIC = ["/", "/work", "/work/jobs", "/work/netherlands", "/study", "/study/search", "/visa", "/flights", "/news", "/contact", "/enquire", "/login", "/register"];

for (const path of PUBLIC) {
  test(`public page ${path} fits the screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });
}

test("a job page and a program page fit the screen", async ({ page }) => {
  await page.goto("/work/jobs");
  await page.locator("main a[href^='/work/']").filter({ hasText: /View job/i }).first().click();
  await expect(page.locator("h1")).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.goto("/study/search");
  await page.locator("main a[href^='/study/']").filter({ hasText: /program|View/i }).first().click();
  await expect(page.locator("h1")).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test("help buttons, assistant and WhatsApp picker fit the screen", async ({ page }) => {
  await page.goto("/work");
  await page.getByRole("button", { name: "Ask us" }).click();
  const chat = page.getByRole("dialog", { name: "FIRST FLIGHT assistant" });
  await expect(chat).toBeInViewport();
  await chat.getByLabel("Your question").fill("jobs in Canada");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByRole("link", { name: /\(Canada\)/ }).first()).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Message us on WhatsApp" }).click();
  const wa = page.getByRole("dialog", { name: "Choose who to message on WhatsApp" });
  await expect(wa).toBeInViewport();
  await expect(wa.getByRole("link").first()).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+/);
});

test("expired promotions are not shown", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Expired promotion (test)")).toHaveCount(0);
});

test("client portal and staff dashboard fit the screen", async ({ page }) => {
  for (const [email, home] of [["client@firstflight.test", /\/portal/], ["finance@firstflight.test", /\/staff/]] as const) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PW);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(home);
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    await page.getByRole("link", { name: /FF-WA-\d{4}-0001/ }).first().click();
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  }
});
