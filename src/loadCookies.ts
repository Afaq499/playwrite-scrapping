import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserContext, Cookie } from "playwright";
import type { BrowserExtensionCookie } from "./types.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_PATH = resolve(__dirname, "../cookies.json");

const REQUIRED_AUTH_COOKIES = new Set(["HASESSIONV3", "EG_SESSIONTOKEN"]);

function mapSameSite(value: string | null | undefined): Cookie["sameSite"] {
  if (!value) return "Lax";
  const normalized = value.toLowerCase();
  if (normalized === "strict") return "Strict";
  if (normalized === "lax") return "Lax";
  if (normalized === "none" || normalized === "no_restriction") return "None";
  return "Lax";
}

export function toPlaywrightCookie(cookie: BrowserExtensionCookie): Cookie {
  let secure = cookie.secure ?? false;
  const sameSite = mapSameSite(cookie.sameSite);

  if (sameSite === "None") {
    secure = true;
  }

  const expires = cookie.session
    ? -1
    : cookie.expirationDate
      ? Math.floor(cookie.expirationDate)
      : -1;

  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path ?? "/",
    expires,
    httpOnly: cookie.httpOnly ?? false,
    secure,
    sameSite,
  };
}

function dedupeCookies(cookies: Cookie[]): Cookie[] {
  const seen = new Map<string, Cookie>();
  for (const cookie of cookies) {
    const key = `${cookie.domain}|${cookie.path}|${cookie.name}`;
    seen.set(key, cookie);
  }
  return [...seen.values()];
}

function filterExpiredCookies(cookies: Cookie[]): {
  cookies: Cookie[];
  expiredRequired: string[];
  expiredSkipped: string[];
} {
  const now = Math.floor(Date.now() / 1000);
  const expiredRequired: string[] = [];
  const expiredSkipped: string[] = [];
  const cookiesKept: Cookie[] = [];

  for (const cookie of cookies) {
    if (cookie.expires !== -1 && cookie.expires < now) {
      if (REQUIRED_AUTH_COOKIES.has(cookie.name)) {
        expiredRequired.push(cookie.name);
      } else {
        expiredSkipped.push(cookie.name);
      }
      continue;
    }
    cookiesKept.push(cookie);
  }

  return { cookies: cookiesKept, expiredRequired, expiredSkipped };
}

export function loadCookiesFromFile(filePath = COOKIES_PATH): Cookie[] {
  if (!existsSync(filePath)) {
    throw new Error(
      `cookies.json not found at ${filePath}.\n` +
        "Copy cookies.example.json to cookies.json and paste your exported browser cookies."
    );
  }

  const raw = readFileSync(filePath, "utf-8").trim();
  if (!raw || raw === "[]") {
    throw new Error(
      "cookies.json is empty. Paste your VRBO cookies (Chrome extension export format) into cookies.json."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("cookies.json is not valid JSON. Export cookies as JSON from your browser extension.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("cookies.json must be a JSON array of cookie objects.");
  }

  const converted = dedupeCookies((parsed as BrowserExtensionCookie[]).map(toPlaywrightCookie));
  const { cookies, expiredRequired, expiredSkipped } = filterExpiredCookies(converted);

  if (expiredRequired.length > 0) {
    throw new Error(
      `Expired session cookies in cookies.json: ${expiredRequired.join(", ")}. ` +
        "Export fresh cookies from your logged-in VRBO browser session."
    );
  }

  if (cookies.length === 0) {
    throw new Error("All cookies in cookies.json are expired. Export fresh cookies and try again.");
  }

  const hasSession = cookies.some((cookie) => REQUIRED_AUTH_COOKIES.has(cookie.name));
  if (!hasSession) {
    throw new Error(
      "cookies.json is missing required session cookies (HASESSIONV3, EG_SESSIONTOKEN). " +
        "Export cookies while logged into VRBO host dashboard."
    );
  }

  if (expiredSkipped.length > 0) {
    console.warn(
      `Skipped ${expiredSkipped.length} expired cookie(s): ${expiredSkipped.slice(0, 8).join(", ")}` +
        (expiredSkipped.length > 8 ? "…" : "") +
        ". Export fresh cookies if scraping fails."
    );
  }

  return cookies;
}

export async function applyCookiesToContext(
  context: BrowserContext,
  cookies: Cookie[]
): Promise<void> {
  // Add cookies directly — no extra navigation (avoids triggering captcha early).
  await context.addCookies(cookies);
}
