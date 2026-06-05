export interface BrowserExtensionCookie {
  domain: string;
  expirationDate?: number;
  hostOnly?: boolean;
  httpOnly?: boolean;
  name: string;
  path?: string;
  sameSite?: string | null;
  secure?: boolean;
  session?: boolean;
  storeId?: string | null;
  value: string;
}

export interface PropertyInfo {
  title: string;
  vrboId: string;
  propertyId: string;
  calendarId: string;
  address?: string;
}

export interface BookingDetail {
  guestName: string;
  reservationId: string;
  dateRange: string;
  nights: string;
  guests: string;
  checkInDate: string;
  checkOutDate: string;
  status?: string;
  rawText?: string;
}

export interface PropertyBookingsResult {
  property: PropertyInfo;
  scrapedAt: string;
  dateRange: {
    from: string;
    to: string;
    days: number;
  };
  bookings: BookingDetail[];
}

export type ScrapeStatus = "idle" | "running" | "completed" | "error";

export type ScrapeEvent =
  | { type: "log"; message: string; url?: string }
  | { type: "navigate"; url: string; label: string }
  | { type: "progress"; step: string; current?: number; total?: number }
  | { type: "property-found"; property: PropertyInfo }
  | { type: "property-done"; result: PropertyBookingsResult }
  | { type: "booking-found"; booking: BookingDetail; propertyTitle: string }
  | { type: "bot-challenge"; message: string }
  | { type: "complete"; results: PropertyBookingsResult[] }
  | { type: "error"; message: string };

export type ScrapeProgressCallback = (event: ScrapeEvent) => void;
