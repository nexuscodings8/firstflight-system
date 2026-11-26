import { expect, test, type Browser, type Page } from "@playwright/test";

// Phase 3 content management. Signs in as the administrator (who has Content Manager rights),
// because password.spec changes the content@ demo account's password.
const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";
const stamp = Date.now();

async function signIn(page: Page, email: string, password = PW) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function visitor(browser: Browser) { const ctx = await browser.newContext(); return { page: await ctx.newPage(), close: () => ctx.close() }; }
const ok = (p: Page, t: string | RegExp) => expect(p.getByRole("status").filter({ hasText: t }).first()).toBeVisible();
const err = (p: Page, t: string | RegExp) => expect(p.getByRole("alert").filter({ hasText: t }).first()).toBeVisible();

test.describe.serial("phase 3: content management", () => {
  test("a job goes from draft to published, with a checklist and a preview", async ({ page, browser }) => {
    await signIn(page, "admin@firstflight.test");
    await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Website content" }).click();
    await page.getByRole("link", { name: "Job offers" }).first().click();
    await page.getByRole("link", { name: "New job offer" }).click();
    const title = `Test warehouse operative ${stamp}`;
    await page.getByLabel(/^Job title/).fill(title);
    await page.getByLabel(/^Country/).selectOption({ label: "Netherlands" });
    await page.getByLabel(/^City or region/).fill("Venlo");
    await page.getByLabel(/^Category/).selectOption({ label: "Logistics and driving" });
    await page.getByLabel(/^Employment type/).selectOption({ label: "Full time" });
    await page.getByLabel(/^Availability/).selectOption({ label: "Open" });
    await page.getByLabel(/^Salary from/).fill("2600");
    await page.getByLabel(/^Salary to/).fill("2400");
    await page.getByLabel(/^Salary currency/).selectOption("EUR");
    await page.getByLabel(/^Salary per/).selectOption({ label: "Month" });
    await page.getByLabel(/^Summary/).fill("Picking and packing in a modern distribution centre.");
    await page.getByLabel(/^Job description/).fill("Order picking with handheld scanners; training provided.");
    await page.getByLabel(/^Who can apply/).fill("18+, basic English, able to stand for long periods.");
    await page.getByLabel(/^Benefits/).fill("Housing support, transport to work.");
    await page.getByRole("button", { name: "Create job offer" }).click();
    await err(page, "Salary from can't be more than salary to.");
    await page.getByLabel(/^Salary to/).fill("2900");
    await page.getByRole("button", { name: "Create job offer" }).click();
    await page.waitForURL(/\/staff\/content\/jobs\/[\w-]+\?created=1/);
    await expect(page.getByText("Created as a draft.")).toBeVisible();

    const previewHref = (await page.getByRole("link", { name: /Preview on the website/ }).getAttribute("href"))!;
    const publicPath = previewHref.replace("?preview=1", "");
    const v = await visitor(browser);
    await v.page.goto(publicPath);
    await expect(v.page.getByText(/Page not found/i)).toBeVisible();
    await page.goto(previewHref);
    await expect(page.getByText(/Preview: draft/)).toBeVisible();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.goBack();

    await page.getByRole("button", { name: "Publish" }).click();
    await err(page, "Add at least one document");
    await page.getByLabel("Document", { exact: true }).fill("Passport copy");
    await page.getByLabel("Note for applicants (optional)").fill("Valid for 12 months or more");
    await page.getByRole("button", { name: "Add document" }).click();
    await ok(page, 'Added "Passport copy"');
    await page.getByLabel("Document", { exact: true }).fill("CV");
    await page.getByRole("button", { name: "Add document" }).click();
    await ok(page, 'Added "CV"');
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.locator("main").getByText("Published", { exact: true }).first()).toBeVisible();

    await v.page.goto(publicPath);
    await expect(v.page.getByRole("heading", { name: title })).toBeVisible();
    await expect(v.page.getByText("Valid for 12 months or more")).toBeVisible();
    await v.page.goto("/work/jobs?q=" + encodeURIComponent(String(stamp)));
    await expect(v.page.getByText(title)).toBeVisible();

    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.locator("main").getByText("Archived", { exact: true }).first()).toBeVisible();
    await v.page.goto(publicPath);
    await expect(v.page.getByText(/Page not found/i)).toBeVisible();
    await v.close();
  });

  test("testimonials need consent; promotions need sensible dates and then show on the home page", async ({ page, browser }) => {
    await signIn(page, "admin@firstflight.test");
    await page.goto("/staff/content/testimonials/new");
    await page.getByLabel(/^Client name/).fill(`Jean P. ${stamp}`);
    await page.getByLabel(/^Service/).selectOption({ label: "Study Abroad" });
    await page.getByLabel(/^What they said/).fill("They guided me through every step of my student visa.");
    await page.getByRole("button", { name: "Create testimonial" }).click();
    await page.waitForURL(/created=1/);
    await page.getByRole("button", { name: "Publish" }).click();
    await err(page, "written consent");
    await page.getByLabel("The client gave written consent to publish this").check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await ok(page, "Saved.");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.locator("main").getByText("Published", { exact: true }).first()).toBeVisible();

    await page.goto("/staff/content/promotions/new");
    const promo = `Winter intake offer ${stamp}`;
    const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel(/^Headline/).fill(promo);
    await page.getByLabel(/^Button text/).fill("See programs");
    await page.getByLabel(/^Button link/).fill("javascript:alert(1)");
    await page.getByLabel(/^Show from/).fill(d(0));
    await page.getByLabel(/^Show until/).fill(d(10));
    await page.getByLabel(/^Text/).fill("Free application review for January intakes.");
    await page.getByRole("button", { name: "Create promotion" }).click();
    await err(page, "Button link must be a page on this site");
    await page.getByLabel(/^Button link/).fill("/study");
    await page.getByLabel(/^Show until/).fill(d(-3));
    await page.getByRole("button", { name: "Create promotion" }).click();
    await err(page, "The end date must be after the start date.");
    await page.getByLabel(/^Show until/).fill(d(10));
    await page.getByRole("button", { name: "Create promotion" }).click();
    await page.waitForURL(/created=1/);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.locator("main").getByText("Published", { exact: true }).first()).toBeVisible();

    const v = await visitor(browser);
    await v.page.goto("/");
    await expect(v.page.getByRole("heading", { name: promo })).toBeVisible();
    await expect(v.page.getByText(`Jean P. ${stamp}`)).toBeVisible();
    await v.close();
  });

  test("stale visa guidance is listed for review and leaves the queue once checked", async ({ page }) => {
    await signIn(page, "admin@firstflight.test");
    await page.goto("/staff/content/visa-review");
    const card = page.locator("article").filter({ hasText: /Not checked since/ }).first();
    const name = (await card.getByRole("link").first().textContent())!;
    await card.getByRole("button", { name: "Mark as checked today" }).click();
    await expect(card.getByRole("alert")).toContainText("Tick the box");
    await card.getByRole("checkbox").check();
    await card.getByRole("button", { name: "Mark as checked today" }).click();
    await expect(page.locator("article").filter({ hasText: name })).toHaveCount(0);
    await page.goto("/staff/activity?q=" + encodeURIComponent(name));
    await expect(page.getByText(/checked ".*" against/).first()).toBeVisible();
  });

  test("clients and other staff can't reach content management", async ({ browser }) => {
    for (const email of ["client@firstflight.test", "finance@firstflight.test", "consultant@firstflight.test"]) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await signIn(p, email);
      await p.goto("/staff/content/jobs/new");
      await expect(p).toHaveURL(/\/forbidden|\/portal/);
      await ctx.close();
    }
  });
});
