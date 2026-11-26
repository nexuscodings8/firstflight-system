import { test, expect } from "@playwright/test";

const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";

test("a user can change their password and sign in with the new one", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("content@firstflight.test");
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/staff/);
  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Profile and password" }).click();
  await page.getByLabel("Current password").fill("wrong-password");
  await page.getByLabel("New password", { exact: true }).fill("NewPass-2026-ok");
  await page.getByLabel("Repeat new password").fill("NewPass-2026-ok");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "current password is incorrect" })).toBeVisible();
  await page.getByLabel("Current password").fill(PW);
  await page.getByLabel("New password", { exact: true }).fill("NewPass-2026-ok");
  await page.getByLabel("Repeat new password").fill("NewPass-2026-ok");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toContainText("Password changed");
  await page.goto("/staff");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill("content@firstflight.test");
  await page.getByLabel("Password").fill("NewPass-2026-ok");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/staff/);
});
