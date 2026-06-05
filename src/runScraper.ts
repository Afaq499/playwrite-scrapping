import { applyCookiesToContext, loadCookiesFromFile } from "./loadCookies.js";
import { launchVrboContext, prepareStealthContext } from "./browser.js";
import { VrboBookingScraper, SCRAPER_MODE } from "./scraper.js";
import type { PropertyBookingsResult, ScrapeProgressCallback } from "./types.js";

export async function runScraper(onProgress: ScrapeProgressCallback): Promise<PropertyBookingsResult[]> {
  const cookies = loadCookiesFromFile();
  onProgress({ type: "log", message: `Loaded ${cookies.length} cookies.` });
  onProgress({ type: "log", message: `Scraper mode: ${SCRAPER_MODE}` });

  onProgress({
    type: "log",
    message: "Launching Playwright in a visible Chrome window (persistent session)...",
  });

  const context = await launchVrboContext(true);
  await prepareStealthContext(context);

  // Close stale tabs from previous runs so the active tab matches what you see.
  for (const oldPage of context.pages()) {
    await oldPage.close().catch(() => undefined);
  }

  onProgress({ type: "log", message: "Applying cookies to browser context..." });
  await applyCookiesToContext(context, cookies);

  const scraper = new VrboBookingScraper(context, {
    headed: true,
    requestDelayMs: Number(process.env.REQUEST_DELAY_MS ?? 400),
    onProgress,
  });

  try {
    onProgress({ type: "progress", step: "Opening properties page" });
    onProgress({
      type: "bot-challenge",
      message:
        "If VRBO shows a slide captcha, complete it in the Playwright Chrome window. The scraper will wait up to 5 minutes.",
    });

    const properties = await scraper.listProperties();
    onProgress({
      type: "log",
      message: `Found ${properties.length} propert${properties.length === 1 ? "y" : "ies"}.`,
    });

    const results: PropertyBookingsResult[] = [];

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      onProgress({
        type: "progress",
        step: `Scraping ${property.title}`,
        current: i + 1,
        total: properties.length,
      });

      const result = await scraper.scrapePropertyBookings(property);
      const filePath = scraper.savePropertyResult(result);
      results.push(result);

      onProgress({ type: "property-done", result });
      onProgress({
        type: "log",
        message: `Saved ${result.bookings.length} booking(s) for ${property.title} → ${filePath}`,
      });
    }

    onProgress({ type: "complete", results });
    return results;
  } finally {
    await context.close();
    onProgress({ type: "log", message: "Playwright browser closed." });
  }
}
