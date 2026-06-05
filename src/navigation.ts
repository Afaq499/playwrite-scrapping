import type { Page } from "playwright";
import { delay } from "./utils.js";
import { isBotChallengePage, waitForHumanChallenge } from "./botCheck.js";

const NAVIGATION_TIMEOUT_MS = 120_000;

export async function gotoSafely(
  page: Page,
  url: string,
  options: {
    label?: string;
    headed?: boolean;
    onMessage?: (message: string) => void;
    maxAttempts?: number;
  } = {}
): Promise<void> {
  const { label, headed = true, onMessage = () => undefined, maxAttempts = 3 } = options;
  onMessage(label ? `Navigating: ${label}` : `Navigating: ${url}`);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT_MS,
      });
      await delay(1500);
      lastError = undefined;
      break;
    } catch (error: unknown) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isTimeout = /timeout|ERR_TIMED_OUT/i.test(message);

      if (!isTimeout || attempt === maxAttempts) {
        throw error;
      }

      onMessage(`Navigation timed out (attempt ${attempt}/${maxAttempts}). Retrying in ${attempt * 3}s...`);
      await delay(3000 * attempt);
    }
  }

  if (lastError) {
    throw lastError;
  }

  if (await isBotChallengePage(page)) {
    if (!headed) {
      throw new Error("VRBO captcha detected. Run via the dashboard so Playwright opens a visible browser window.");
    }

    await waitForHumanChallenge(page, onMessage);
  }
}
