import { VRBO_BASE } from "./utils.js";

export function bookingsAndBlocksUrl(
  calendarId: string,
  selectionStart: string,
  selectionEnd: string
): string {
  return (
    `${VRBO_BASE}/en-gb/p/calendar/${calendarId}/rail/bookingsAndBlocks` +
    `?selectionStart=${selectionStart}&selectionEnd=${selectionEnd}`
  );
}

export function manageUrl(calendarId: string, selectionStart: string, selectionEnd: string): string {
  return (
    `${VRBO_BASE}/en-gb/p/calendar/${calendarId}/rail/manage` +
    `?selectionStart=${selectionStart}&selectionEnd=${selectionEnd}`
  );
}

/** Example: .../rail/bookingsAndBlocks?selectionStart=2026-06-18&selectionEnd=2026-06-19 */
export function calendarRailUrl(
  calendarId: string,
  rail: "bookingsAndBlocks" | "manage",
  selectionStart: string,
  selectionEnd: string
): string {
  return rail === "manage"
    ? manageUrl(calendarId, selectionStart, selectionEnd)
    : bookingsAndBlocksUrl(calendarId, selectionStart, selectionEnd);
}
