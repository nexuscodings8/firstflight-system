import { expect, test } from "@playwright/test";

test("main navigation and back links work on this screen size", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.locator("#mobile-nav").getByRole("link", { name: "Study Abroad" }).click();
  } else {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Study Abroad" }).click();
  }
  await expect(page).toHaveURL(/\/study$/);
  await page.getByRole("link", { name: /Europe/ }).click();
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/study$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
