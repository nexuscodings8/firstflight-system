import { defineConfig, devices } from "@playwright/test";

// Run against a production build with freshly seeded sample data:
//   npm run db:seed && npm run build && npm run start   (then)   npm run test:e2e
// CHROME_PATH lets you use an installed Chrome instead of downloading Playwright browsers.
const launchOptions = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000", launchOptions, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Phones and tablets run the navigation and layout checks (the workflow tests run once, on desktop).
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(navigation|responsive)\.spec\.ts/ },
    { name: "tablet", use: { ...devices["iPad Mini"], browserName: "chromium" }, testMatch: /(navigation|responsive)\.spec\.ts/ },
  ],
});
