import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserContext, Page } from "playwright";
import type {
  BookingDetail,
  PropertyBookingsResult,
  PropertyInfo,
  ScrapeProgressCallback,
} from "./types.js";
import {
  PROPERTIES_URL,
  DAYS_TO_SCAN,
  formatDate,
  addDays,
  sanitizeFilename,
  delay,
  buildMonthScanRanges,
} from "./utils.js";
import { bookingsAndBlocksUrl } from "./calendarUrls.js";
import { gotoSafely } from "./navigation.js";
import { collectPropertyLinks, propertyDetailUrl } from "./propertyLinks.js";
import { dismissCalendarModals } from "./calendarModals.js";
import { parseBookingsFromDrawer } from "./parseBookingsDrawer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../output");
export const SCRAPER_MODE = "bookingsAndBlocks-rail-month-v5";

export class VrboBookingScraper {
  constructor(
    private readonly context: BrowserContext,
    private readonly options: {
      headed?: boolean;
      requestDelayMs?: number;
      onProgress?: ScrapeProgressCallback;
    } = {}
  ) {}

  private emit(...args: Parameters<ScrapeProgressCallback>): void {
    this.options.onProgress?.(...args);
  }

  private get requestDelayMs(): number {
    return Number(process.env.REQUEST_DELAY_MS ?? this.options.requestDelayMs ?? 400);
  }

  private async getWorkingPage(): Promise<Page> {
    const existing = this.context.pages().find((p) => !p.isClosed());
    const page = existing ?? (await this.context.newPage());
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);
    await page.bringToFront();
    return page;
  }

  private log(message: string): void {
    this.emit({ type: "log", message });
  }

  private async goto(page: Page, url: string, label?: string): Promise<void> {
    this.emit({ type: "navigate", url, label: label ?? url });
    await gotoSafely(page, url, {
      label: label ?? url,
      headed: this.options.headed,
      onMessage: (message) => {
        if (/captcha/i.test(message)) {
          this.emit({ type: "bot-challenge", message });
        } else {
          this.log(message);
        }
      },
    });
  }

  async listProperties(): Promise<PropertyInfo[]> {
    this.log(`Scraper mode: ${SCRAPER_MODE}`);
    const page = await this.getWorkingPage();
    const properties: PropertyInfo[] = [];

    await this.goto(page, PROPERTIES_URL, "VRBO properties page");

    if (page.url().includes("/auth/") || page.url().includes("/login")) {
      throw new Error("Cookie session is invalid or expired. Update cookies.json and retry.");
    }

    this.log("Scanning page for property links...");
    const propertyLinks = await collectPropertyLinks(page, (message) => this.log(message));

    if (propertyLinks.length === 0) {
      throw new Error("No properties found on the properties page.");
    }

    this.log(`Found ${propertyLinks.length} property link(s).`);

    for (const propertyLink of propertyLinks) {
      const { title, href, vrboId, address: addressMatch } = propertyLink;
      const detailUrl = propertyDetailUrl(href);

      this.log(`Opening property: ${title}`);
      await page.bringToFront();
      await this.goto(page, detailUrl, `Property detail: ${title}`);

      const propertyId = new URL(page.url()).searchParams.get("propertyId") ?? "";
      const calendarId = await this.resolveCalendarId(page);
      const property = { title, vrboId, propertyId, calendarId, address: addressMatch };

      properties.push(property);
      this.emit({ type: "property-found", property });

      if (propertyLinks.length > 1) {
        await this.goto(page, PROPERTIES_URL, "Back to properties list");
        await delay(this.requestDelayMs);
      }
    }

    return properties;
  }

  private async resolveCalendarId(page: Page): Promise<string> {
    const calendarLink = page.locator('a[href*="/p/calendar/"]').first();
    await calendarLink.waitFor({ state: "attached", timeout: 30_000 });
    const href = await calendarLink.getAttribute("href");
    if (!href) {
      throw new Error("Could not find calendar link on property page.");
    }

    const match = href.match(/\/p\/calendar\/([^/?#]+)/);
    if (!match?.[1]) {
      throw new Error(`Could not parse calendar id from href: ${href}`);
    }

    return match[1];
  }

  async scrapePropertyBookings(property: PropertyInfo): Promise<PropertyBookingsResult> {
    const page = await this.getWorkingPage();
    const startDate = new Date();
    startDate.setHours(12, 0, 0, 0);
    const endDate = addDays(startDate, DAYS_TO_SCAN);
    const monthRanges = buildMonthScanRanges(startDate, endDate);
    const totalMonths = monthRanges.length;

    this.log(
      `Scanning ${property.title} in ${totalMonths} month window(s) from ${formatDate(startDate)} to ${formatDate(endDate)}`
    );

    const bookings: BookingDetail[] = [];
    const seenKeys = new Set<string>();

    for (let monthIndex = 0; monthIndex < monthRanges.length; monthIndex++) {
      const { selectionStart, selectionEnd, label } = monthRanges[monthIndex];
      const url = bookingsAndBlocksUrl(property.calendarId, selectionStart, selectionEnd);

      this.emit({
        type: "progress",
        step: `Scanning ${property.title}`,
        current: monthIndex + 1,
        total: totalMonths,
      });

      this.emit({
        type: "navigate",
        url,
        label: `${property.title} (${label})`,
      });

      await page.goto(url, { waitUntil: "commit", timeout: 30_000 });
      await page
        .getByText(/bookings and blocks/i)
        .first()
        .waitFor({ state: "visible", timeout: 10_000 })
        .catch(() => undefined);
      await dismissCalendarModals(page, (message) => this.log(message));

      const monthBookings = await parseBookingsFromDrawer(page, selectionStart, selectionEnd);
      this.log(`Checked ${label}: ${monthBookings.length} booking(s)`);

      for (const booking of monthBookings) {
        const key = booking.reservationId || `${booking.guestName}|${booking.checkInDate}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        bookings.push(booking);
        this.emit({
          type: "booking-found",
          booking,
          propertyTitle: property.title,
        });
        this.log(`Booking: ${booking.guestName} — ${booking.dateRange}`);
      }

      await delay(this.requestDelayMs);
    }

    bookings.sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
    this.log(`Finished ${property.title}: ${bookings.length} booking(s) found.`);

    return {
      property,
      scrapedAt: new Date().toISOString(),
      dateRange: {
        from: formatDate(startDate),
        to: formatDate(endDate),
        days: DAYS_TO_SCAN,
      },
      bookings,
    };
  }

  savePropertyResult(result: PropertyBookingsResult): string {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const filename = `${sanitizeFilename(result.property.title)}-${result.property.propertyId}.json`;
    const filePath = resolve(OUTPUT_DIR, filename);
    writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
    return filePath;
  }
}
