import { expect, test, type Page } from "@playwright/test";

const PW = process.env.SEED_PASSWORD ?? "ChangeMe-2026!";
const stamp = Date.now();

async function signIn(page: Page, email: string, password = PW) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test.describe.serial("phase 4: help, storage and launch", () => {
  test("the assistant finds real listings and hands off to a consultant", async ({ page, browser }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ask us" }).click();
    const chat = page.getByRole("dialog", { name: "FIRST FLIGHT assistant" });
    await chat.getByLabel("Your question").fill("Any jobs in the Netherlands?");
    await chat.getByRole("button", { name: "Send" }).click();
    await expect(chat.getByText(/open jobs? in Netherlands/).first()).toBeVisible();
    await expect(chat.getByRole("link", { name: /\(Netherlands\)/ }).first()).toBeVisible();

    await chat.getByLabel("Your question").fill("I want a masters in the UK");
    await chat.getByRole("button", { name: "Send" }).click();
    await expect(chat.getByText(/master level/).first()).toBeVisible();

    await chat.getByLabel("Your question").fill("Do I need a visa for Canada?");
    await chat.getByRole("button", { name: "Send" }).click();
    await expect(chat.getByRole("link", { name: "Check visa requirements for Canada" })).toHaveAttribute("href", "/visa?dest=CA");

    await chat.getByLabel("Your question").fill("Can I talk to a person?");
    await chat.getByRole("button", { name: "Send" }).click();
    await chat.getByPlaceholder("Your name").fill(`Chat visitor ${stamp}`);
    await chat.getByPlaceholder("Email").fill(`chat-${stamp}@example.test`);
    await chat.getByRole("button", { name: "Send to a consultant" }).click();
    await expect(chat.getByRole("status").filter({ hasText: /Your reference is EQ-\d{4}-\d{4}/ })).toBeVisible();

    const ctx = await browser.newContext();
    const k = await ctx.newPage();
    await signIn(k, "consultant@firstflight.test");
    await k.goto("/staff/enquiries?show=new");
    const card = k.locator("article", { hasText: `Chat visitor ${stamp}` });
    await expect(card.getByText("Website assistant")).toBeVisible();
    await card.getByText("Chat with the assistant before this").click();
    await expect(card.getByText(/Visitor: Any jobs in the Netherlands\?/)).toBeVisible();
    await ctx.close();
  });

  test("WhatsApp picker lists contacts managed in Content", async ({ page }) => {
    await signIn(page, "admin@firstflight.test");
    await page.goto("/staff/content/whatsapp/new");
    await page.getByLabel(/^Name shown to visitors/).fill(`Visa desk ${stamp}`);
    await page.getByLabel(/^What they help with/).fill("Visa applications and appointments");
    await page.getByLabel(/^WhatsApp number/).fill("0788");
    await page.getByLabel(/^Show on the website/).check();
    await page.getByRole("button", { name: "Create WhatsApp contact" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "country code" })).toBeVisible();
    await page.getByLabel(/^WhatsApp number/).fill("+250 788 123 456");
    await page.getByRole("button", { name: "Create WhatsApp contact" }).click();
    await page.waitForURL(/created=1/);

    await page.goto("/study");
    await page.getByRole("button", { name: "Message us on WhatsApp" }).click();
    const picker = page.getByRole("dialog", { name: "Choose who to message on WhatsApp" });
    const link = picker.getByRole("link", { name: new RegExp(`Visa desk ${stamp}`) });
    await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/250788123456\?text=/);
    await expect(picker.getByRole("link", { name: /FIRST FLIGHT office/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
  });

  test("a file pretending to be a PDF is refused", async ({ page }) => {
    await signIn(page, "client@firstflight.test");
    await page.getByRole("link", { name: /FF-WA-\d{4}-0001/ }).first().click();
    const row = page.locator("li", { has: page.getByText("CV", { exact: true }) }).first();
    await row.getByLabel("Choose a file for CV").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ this is not a pdf") });
    await row.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "doesn't look like a real" })).toBeVisible();
  });

  test("repeated wrong passwords are slowed down", async ({ page }) => {
    const email = `nobody-${stamp}@example.test`;
    for (let i = 0; i < 8; i++) {
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("wrong-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    }
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Too many wrong attempts/)).toBeVisible();
  });

  test("launch checks, security headers and robots.txt", async ({ page, request }) => {
    await signIn(page, "admin@firstflight.test");
    await page.getByRole("link", { name: "Launch checks" }).click();
    await expect(page.getByRole("status").filter({ hasText: /must be fixed before launch/ })).toBeVisible();
    await expect(page.locator("li", { hasText: "Demo accounts switched off" }).getByText("Not ready")).toBeVisible();
    const res = await request.get("/");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /staff");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/work/");
  });
});
