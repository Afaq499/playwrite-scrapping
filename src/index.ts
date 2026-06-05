import { runScraper } from "./runScraper.js";

async function main(): Promise<void> {
  await runScraper((event) => {
    if (event.type === "log") {
      console.log(event.message);
      return;
    }
    if (event.type === "navigate") {
      console.log(`→ ${event.label}: ${event.url}`);
      return;
    }
    if (event.type === "booking-found") {
      console.log(`  Booking: ${event.booking.guestName} (${event.booking.reservationId})`);
      return;
    }
    if (event.type === "complete") {
      console.log(`\nDone. ${event.results.length} propert${event.results.length === 1 ? "y" : "ies"} scraped.`);
      return;
    }
    if (event.type === "error") {
      console.error(event.message);
    }
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Scrape failed: ${message}`);
  process.exit(1);
});
