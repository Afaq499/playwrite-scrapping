import type { Page } from "playwright";
import { delay } from "./utils.js";
import { isBotChallengePage } from "./botCheck.js";

export async function ensurePropertiesList(
  page: Page,
  onMessage: (message: string) => void = () => undefined
): Promise<boolean> {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await isBotChallengePage(page)) {
      onMessage("Captcha is still visible. Complete it in the Playwright browser window.");
      return false;
    }

    if (attempt > 1) {
      const waitMs = 5000 * attempt;
      onMessage(`Properties list not ready yet. Retrying in ${waitMs / 1000}s...`);
      await delay(waitMs);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 }).catch(() => undefined);
      await delay(2000);
    }

    await openAllPropertiesView(page);

    const loaded = await waitForPropertiesContent(page);
    if (loaded) {
      return true;
    }
  }

  return false;
}

async function openAllPropertiesView(page: Page): Promise<void> {
  const seeAll = page
    .getByRole("link", { name: /see all propert/i })
    .or(page.getByRole("button", { name: /see all propert/i }))
    .or(page.getByText(/see all propert/i));

  if (await seeAll.first().isVisible().catch(() => false)) {
    await seeAll.first().click();
    await delay(2500);
  }
}

async function waitForPropertiesContent(page: Page): Promise<boolean> {
  const graphqlLoaded = await page
    .waitForResponse(
      (response) =>
        response.url().includes("/p/properties/api/graphql") && response.status() === 200,
      { timeout: 45_000 }
    )
    .then(() => true)
    .catch(() => false);

  if (graphqlLoaded) {
    await delay(2000);
  }

  const indicators = [
    page.getByText(/total:\s*\d+\s*propert/i),
    page.locator('a.head[href*="propertyId="]').first(),
    page.locator('a[href*="supply/home"][href*="propertyId="]').filter({ hasText: /\d/ }).first(),
  ];

  for (const indicator of indicators) {
    if (await indicator.isVisible({ timeout: 15_000 }).catch(() => false)) {
      return true;
    }
  }

  const title = await page.title();
  const url = page.url();
  return url.includes("/p/properties") && /my propert/i.test(title) && graphqlLoaded;
}
