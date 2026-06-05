import { applyCookiesToContext, loadCookiesFromFile } from "../src/loadCookies.js";
import { launchVrboContext, prepareStealthContext } from "../src/browser.js";
import { parseBookingsFromDrawer } from "../src/parseBookingsDrawer.js";
import { bookingsAndBlocksUrl } from "../src/calendarUrls.js";

const CALENDAR_ID = "611.12072840.7117389";
const CHECK_IN = "2026-06-01";
const CHECK_OUT = "2026-07-01";

async function main(): Promise<void> {
  const cookies = loadCookiesFromFile();
  const context = await launchVrboContext(true);
  await prepareStealthContext(context);
  await applyCookiesToContext(context, cookies);

  const page = await context.newPage();
  const url = bookingsAndBlocksUrl(CALENDAR_ID, CHECK_IN, CHECK_OUT);
  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });

  const bookings = await parseBookingsFromDrawer(page, CHECK_IN, CHECK_OUT);
  console.log("Parsed bookings:", JSON.stringify(bookings, null, 2));

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
