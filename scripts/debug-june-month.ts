import { applyCookiesToContext, loadCookiesFromFile } from "../src/loadCookies.js";
import { launchVrboContext, prepareStealthContext } from "../src/browser.js";
import { bookingsAndBlocksUrl } from "../src/calendarUrls.js";
import { parseBookingsFromDrawer } from "../src/parseBookingsDrawer.js";

const CALENDAR_ID = "611.12072840.7117389";
const URL = bookingsAndBlocksUrl(CALENDAR_ID, "2026-06-05", "2026-07-01");

async function main(): Promise<void> {
  const cookies = loadCookiesFromFile();
  const context = await launchVrboContext(true);
  await prepareStealthContext(context);
  await applyCookiesToContext(context, cookies);

  const page = await context.newPage();
  console.log("URL:", URL);
  await page.goto(URL, { waitUntil: "commit", timeout: 30_000 });
  await page
    .getByText(/bookings and blocks/i)
    .first()
    .waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => console.log("No bookings panel header"));

  const started = Date.now();
  const bookings = await parseBookingsFromDrawer(page, "2026-06-05", "2026-07-01");
  console.log("Parse ms:", Date.now() - started);
  console.log("Parsed:", JSON.stringify(bookings, null, 2));

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
