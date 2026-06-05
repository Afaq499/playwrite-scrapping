import type { Page } from "playwright";
import type { BookingDetail } from "./types.js";
import { parseVrboDateRange, parseYearHint } from "./parseBookingDates.js";

export async function parseBookingsFromDrawer(
  page: Page,
  selectionStart: string,
  selectionEnd: string
): Promise<BookingDetail[]> {
  const fallbackYear = Number(selectionStart.slice(0, 4));
  await page
    .getByText(/bookings and blocks/i)
    .first()
    .waitFor({ state: "visible", timeout: 3_000 })
    .catch(() => undefined);

  await page
    .getByText(/res id:\s*[A-Z0-9-]+/i)
    .first()
    .waitFor({ state: "visible", timeout: 2_000 })
    .catch(() => undefined);

  const resIdLocator = page.getByText(/res id:\s*[A-Z0-9-]+/i);
  const count = await resIdLocator.count();
  if (count === 0) {
    return [];
  }

  const bookings: BookingDetail[] = [];

  for (let i = 0; i < count; i++) {
    const resLine = resIdLocator.nth(i);
    const ancestors = [
      resLine.locator("xpath=ancestor::li[1]"),
      resLine.locator("xpath=ancestor::article[1]"),
      resLine.locator('xpath=ancestor::*[@role="listitem"][1]'),
      resLine.locator("xpath=ancestor::div[contains(@class,'list')][1]"),
      resLine.locator("xpath=.."),
    ];

    let rawText = "";
    for (const ancestor of ancestors) {
      rawText = (await ancestor.innerText().catch(() => "")).trim();
      if (rawText && rawText.length > 10) break;
    }

    if (!rawText) continue;

    const firstLine = rawText.split("\n")[0]?.trim() ?? "";
    if (/^block$/i.test(firstLine)) continue;

    const lines = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const reservationId = rawText.match(/res id:\s*([A-Z0-9-]+)/i)?.[1] ?? "";

    const guestName =
      lines.find(
        (line) =>
          !/res id:/i.test(line) &&
          !/^(bookings and blocks|block|add block|add booking)$/i.test(line) &&
          !/adult|child|night/i.test(line) &&
          !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(line) &&
          !/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(line) &&
          !/^\d{4}$/.test(line) &&
          line.length > 2 &&
          /^[A-Za-z]/.test(line)
      ) ?? "Unknown guest";

    const dateRange =
      lines.find((line) =>
        /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b.*\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(
          line
        )
      ) ?? `${selectionStart} - ${selectionEnd}`;

    const yearHint = parseYearHint(rawText, fallbackYear);
    const parsedDates = parseVrboDateRange(dateRange, yearHint);
    const checkInDate = parsedDates?.checkInDate ?? selectionStart;
    const checkOutDate = parsedDates?.checkOutDate ?? selectionEnd;

    const nights = lines.find((line) => /night/i.test(line)) ?? "";
    const guests = lines.find((line) => /adult|child/i.test(line)) ?? "";

    bookings.push({
      guestName,
      reservationId: reservationId || `unknown-${checkInDate}`,
      dateRange,
      nights,
      guests,
      checkInDate,
      checkOutDate,
      rawText,
    });
  }

  return bookings;
}
