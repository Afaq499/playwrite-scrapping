import { chromium, type BrowserContext } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = resolve(__dirname, "../.browser-data");

export async function launchVrboContext(headed = true): Promise<BrowserContext> {
  const options = {
    headless: !headed,
    locale: "en-GB",
    timezoneId: "Europe/London",
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  };

  try {
    return await chromium.launchPersistentContext(USER_DATA_DIR, {
      ...options,
      channel: "chrome",
    });
  } catch {
    return await chromium.launchPersistentContext(USER_DATA_DIR, options);
  }
}

export async function prepareStealthContext(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
}
