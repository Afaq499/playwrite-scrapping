import type { Page } from "playwright";
import { delay } from "./utils.js";

export async function isBotChallengePage(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  const body = await page.locator("body").innerText().catch(() => "");
  const url = page.url();

  return (
    /bot or not/i.test(title) ||
    /show us your human side/i.test(body) ||
    /slide right to secure/i.test(body) ||
    /can't tell if you're a human/i.test(body) ||
    /challengeReferer/i.test(url)
  );
}

export async function waitForHumanChallenge(
  page: Page,
  onMessage: (message: string) => void,
  maxWaitMs = 300_000
): Promise<void> {
  if (!(await isBotChallengePage(page))) {
    return;
  }

  onMessage(
    "VRBO captcha detected. Slide the captcha in the Playwright Chrome window, then wait for the properties page to load."
  );

  const started = Date.now();
  let lastReminder = 0;

  while (Date.now() - started < maxWaitMs) {
    const onChallenge = await isBotChallengePage(page);
    const hasProperties = await page
      .locator('a[href*="/supply/home?propertyId="], a[href*="propertyId="]')
      .first()
      .isVisible()
      .catch(() => false);

    if (!onChallenge && hasProperties) {
      onMessage("Captcha passed. Continuing scrape...");
      return;
    }

    if (!onChallenge) {
      await delay(2000);
      if (!(await isBotChallengePage(page))) {
        return;
      }
    }

    const elapsed = Date.now() - started;
    if (elapsed - lastReminder > 30_000) {
      onMessage("Still waiting for captcha to be completed in the Playwright browser window...");
      lastReminder = elapsed;
    }

    await delay(1500);
  }

  throw new Error(
    "Timed out waiting for VRBO captcha. Complete the slide captcha in the Playwright window and try again."
  );
}
