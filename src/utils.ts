export const VRBO_BASE = "https://www.vrbo.com";
export const PROPERTIES_URL = `${VRBO_BASE}/en-gb/p/properties`;
export const DAYS_TO_SCAN = Number(process.env.DAYS_TO_SCAN ?? 300);

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);
}

export interface MonthScanRange {
  selectionStart: string;
  selectionEnd: string;
  label: string;
}

/** Build ~1-month URL windows from start through end (selectionEnd is exclusive, per VRBO). */
export function buildMonthScanRanges(start: Date, end: Date): MonthScanRange[] {
  const ranges: MonthScanRange[] = [];
  let cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);

  while (cursor <= end) {
    const monthEnd = endOfMonth(cursor);
    const rangeStart = cursor;
    const rangeEnd = monthEnd < end ? monthEnd : end;
    const selectionStart = formatDate(rangeStart);
    const selectionEnd = formatDate(addDays(rangeEnd, 1));

    ranges.push({
      selectionStart,
      selectionEnd,
      label: `${selectionStart} → ${formatDate(rangeEnd)}`,
    });

    cursor = addDays(startOfMonth(addDays(monthEnd, 1)), 0);
  }

  return ranges;
}

export function sanitizeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uniqueDates(dates: string[]): string[] {
  return [...new Set(dates)].sort();
}
