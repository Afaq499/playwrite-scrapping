import type { Page } from "playwright";
import type { BookingDetail } from "./types.js";
import {
  countNights,
  formatNightsLabel,
  parseVrboDateRange,
  parseYearHint,
} from "./parseBookingDates.js";

const LOCATOR_TIMEOUT_MS = 800;
const DRAWER_WAIT_MS = 12_000;

const DATE_RANGE_PATTERN =
  /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b.*\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;

function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function resIdPattern(reservationId: string): RegExp {
  return new RegExp(`res id:\\s*${reservationId}\\b`, "i");
}

function extractReservationIds(text: string): string[] {
  return [...new Set([...text.matchAll(/res id:\s*([A-Z0-9-]+)/gi)].map((match) => match[1]))];
}

function parseBookingFromText(
  rawText: string,
  reservationId: string,
  selectionStart: string,
  selectionEnd: string,
  fallbackYear: number
): BookingDetail | null {
  const lines = toLines(rawText);
  const resIdx = lines.findIndex((line) => resIdPattern(reservationId).test(line));
  if (resIdx === -1) return null;

  const beforeResId = lines.slice(0, resIdx);
  const afterResId = lines.slice(resIdx + 1);

  const guestName =
    [...beforeResId]
      .reverse()
      .find(
        (line) =>
          !/^(block|bookings and blocks|add block|add booking)$/i.test(line) &&
          !DATE_RANGE_PATTERN.test(line) &&
          !/adult|child|night/i.test(line) &&
          !/^\d{4}$/.test(line) &&
          line.length > 2 &&
          /^[A-Za-z]/.test(line)
      ) ?? "Unknown guest";

  const dateRange =
    afterResId.find((line) => DATE_RANGE_PATTERN.test(line)) ??
    `${selectionStart} - ${selectionEnd}`;

  const yearHint = parseYearHint(rawText, fallbackYear);
  const parsedDates = parseVrboDateRange(dateRange, yearHint);
  const checkInDate = parsedDates?.checkInDate ?? selectionStart;
  const checkOutDate = parsedDates?.checkOutDate ?? selectionEnd;

  const guests = afterResId.find((line) => /adult|child/i.test(line)) ?? "";

  return {
    guestName,
    reservationId,
    dateRange,
    nights: formatNightsLabel(countNights(checkInDate, checkOutDate)),
    guests,
    checkInDate,
    checkOutDate,
    rawText: [...beforeResId, lines[resIdx], ...afterResId].join("\n"),
  };
}

async function waitForDrawerContent(page: Page): Promise<void> {
  const resId = page.getByText(/res id:\s*[A-Z0-9-]+/i).first();
  const noBookings = page.getByText(/no bookings or blocks/i).first();
  const header = page.getByText(/bookings and blocks/i).first();

  await header.waitFor({ state: "visible", timeout: DRAWER_WAIT_MS }).catch(() => undefined);

  await Promise.race([
    resId.waitFor({ state: "visible", timeout: DRAWER_WAIT_MS }).catch(() => undefined),
    noBookings.waitFor({ state: "visible", timeout: DRAWER_WAIT_MS }).catch(() => undefined),
  ]);
}

async function readDrawerText(page: Page): Promise<string> {
  const fromLocator = await page
    .locator("aside, section, [class*='rail'], [class*='drawer']")
    .filter({ hasText: /bookings and blocks/i })
    .first()
    .innerText({ timeout: LOCATOR_TIMEOUT_MS })
    .catch(() => "");

  if (fromLocator.trim()) {
    return fromLocator.trim();
  }

  return page
    .evaluate(() => {
      const candidates = [...document.querySelectorAll("aside, section, div")];
      const panel = candidates.find((element) =>
        /bookings and blocks/i.test(element.textContent ?? "")
      );
      return panel?.textContent?.trim() ?? "";
    })
    .catch(() => "");
}

async function readResLineText(
  page: Page,
  reservationId: string
): Promise<string> {
  const resLine = page.getByText(new RegExp(`res id:\\s*${reservationId}`, "i")).first();
  if ((await resLine.count()) === 0) return "";

  const ancestors = [
    "ancestor::*[1]",
    "ancestor::li[1]",
    "ancestor::article[1]",
    'ancestor::*[@role="listitem"][1]',
  ];

  for (const xpath of ancestors) {
    const ancestor = resLine.locator(`xpath=${xpath}`);
    if ((await ancestor.count()) === 0) continue;
    const text = (await ancestor
      .first()
      .innerText({ timeout: LOCATOR_TIMEOUT_MS })
      .catch(() => "")).trim();
    if (text && resIdPattern(reservationId).test(text)) {
      return text;
    }
  }

  return "";
}

export async function parseBookingsFromDrawer(
  page: Page,
  selectionStart: string,
  selectionEnd: string
): Promise<BookingDetail[]> {
  const fallbackYear = Number(selectionStart.slice(0, 4));

  await waitForDrawerContent(page);

  const drawerText = await readDrawerText(page);
  const reservationIds = extractReservationIds(drawerText);

  if (reservationIds.length === 0) {
    const locatorCount = await page.getByText(/res id:\s*[A-Z0-9-]+/i).count();
    if (locatorCount === 0) {
      return [];
    }

    for (let i = 0; i < locatorCount; i++) {
      const lineText = await page
        .getByText(/res id:\s*[A-Z0-9-]+/i)
        .nth(i)
        .innerText({ timeout: LOCATOR_TIMEOUT_MS })
        .catch(() => "");
      const id = lineText.match(/res id:\s*([A-Z0-9-]+)/i)?.[1];
      if (id) reservationIds.push(id);
    }
  }

  const uniqueIds = [...new Set(reservationIds)];
  const bookings: BookingDetail[] = [];

  for (const reservationId of uniqueIds) {
    const cardText = await readResLineText(page, reservationId);
    const candidates = [cardText, drawerText].filter(Boolean);

    let booking: BookingDetail | null = null;
    for (const text of candidates) {
      booking = parseBookingFromText(text, reservationId, selectionStart, selectionEnd, fallbackYear);
      if (booking && DATE_RANGE_PATTERN.test(booking.dateRange)) {
        break;
      }
    }

    if (booking) {
      bookings.push(booking);
    }
  }

  return bookings;
}
