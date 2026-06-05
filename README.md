# VRBO Booking Scraper

Playwright scraper for VRBO host calendar bookings. It authenticates with exported browser cookies, discovers all properties, scans the next 300 days on each calendar, and saves booking details per property.

## Setup

```bash
npm install
npx playwright install chromium
```

## Cookies

1. Copy the example file:

```bash
cp cookies.example.json cookies.json
```

2. Export cookies from your logged-in VRBO host session (Chrome extension JSON format, e.g. EditThisCookie / Cookie-Editor).
3. Paste the full JSON array into `cookies.json`.
4. Export cookies **while logged in** to the VRBO host dashboard. Session cookies (`HASESSIONV3`, `EG_SESSIONTOKEN`) must be present and not expired.

The scraper automatically:
- Converts browser-export cookies to Playwright format
- Skips expired short-lived cookies (with a warning)
- Navigates to VRBO before applying cookies
- Retries the properties page if VRBO rate-limits the API (429)

`cookies.json` is gitignored so your session cookies are not committed.

## Run with React dashboard (recommended)

Starts the API server and React frontend. Click **Start Scraping** to launch Playwright in a visible Chrome window and watch live navigation logs.

```bash
npm run dev
```

Open http://localhost:5173

- The dashboard shows live Playwright navigation logs
- A separate Chrome window opens for VRBO scraping
- Booking results appear in the UI when scraping completes

## Run from CLI

```bash
npm run scrape:headed
```

If VRBO shows a **slide captcha** ("Show us your human side"), complete it in the Playwright Chrome window. The scraper waits up to 5 minutes and then continues automatically.

A persistent browser profile is saved in `.browser-data/` so you usually only need to solve the captcha once.

Optional env vars:

- `REQUEST_DELAY_MS=500` — delay between calendar requests (default `400`)

## What it does

1. Loads cookies from `cookies.json`
2. Opens [all properties](https://www.vrbo.com/en-gb/p/properties)
3. Clicks each property title to open the property page
4. Resolves the calendar URL for that property
5. Scans booked dates for the next 300 days
6. For each booked date, opens the bookings drawer via:

   `https://www.vrbo.com/en-gb/p/calendar/{calendarId}/rail/bookingsAndBlocks?selectionStart=YYYY-MM-DD&selectionEnd=YYYY-MM-DD`

7. Extracts booking details (guest name, reservation ID, dates, nights, guests)
8. Saves results to `output/{property-name}-{propertyId}.json`

## Output example

```json
{
  "property": {
    "title": "Nice Apartment in Urago",
    "vrboId": "12072840",
    "propertyId": "127265570",
    "calendarId": "611.12072840.7117389"
  },
  "scrapedAt": "2026-06-05T12:00:00.000Z",
  "dateRange": {
    "from": "2026-06-05",
    "to": "2027-04-01",
    "days": 300
  },
  "bookings": [
    {
      "guestName": "Davide Di Peppe",
      "reservationId": "HA-XLRX1R",
      "dateRange": "Thu 18 Jun - Fri 19 Jun",
      "nights": "1 Night",
      "guests": "1 Adult - 0 Children",
      "checkInDate": "2026-06-18",
      "checkOutDate": "2026-06-19"
    }
  ]
}
```
# playwrite-scrapping
