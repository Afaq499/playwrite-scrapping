import { formatDate } from "./utils.js";

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseYearHint(rawText: string, fallbackYear: number): number {
  const match = rawText.match(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i
  );
  return match ? Number(match[1]) : fallbackYear;
}

export function parseVrboDateRange(
  dateRange: string,
  yearHint: number
): { checkInDate: string; checkOutDate: string } | null {
  const match = dateRange.match(
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*-\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i
  );
  if (!match) return null;

  const [, startDay, startMonth, endDay, endMonth] = match;
  const startMonthIndex = MONTH_INDEX[startMonth.toLowerCase().slice(0, 3)];
  const endMonthIndex = MONTH_INDEX[endMonth.toLowerCase().slice(0, 3)];

  let startYear = yearHint;
  let endYear = yearHint;
  if (endMonthIndex < startMonthIndex) {
    endYear += 1;
  }

  const checkIn = new Date(startYear, startMonthIndex, Number(startDay), 12);
  const checkOut = new Date(endYear, endMonthIndex, Number(endDay), 12);

  return {
    checkInDate: formatDate(checkIn),
    checkOutDate: formatDate(checkOut),
  };
}

export function countNights(checkInDate: string, checkOutDate: string): number {
  const start = new Date(`${checkInDate}T12:00:00`);
  const end = new Date(`${checkOutDate}T12:00:00`);
  const diff = (end.getTime() - start.getTime()) / 86_400_000;
  return Math.max(0, Math.round(diff));
}

export function formatNightsLabel(nights: number): string {
  return nights === 1 ? "1 Night" : `${nights} Nights`;
}

export function formatDisplayDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
