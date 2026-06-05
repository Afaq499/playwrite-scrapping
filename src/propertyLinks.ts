import type { Frame, Page } from "playwright";

export interface PropertyRowLink {
  title: string;
  href: string;
  vrboId: string;
  address?: string;
}

const PROPERTY_LINK_SELECTORS = [
  'a.head[href*="propertyId="]',
  'a[href*="supply/home"][href*="propertyId="]',
];

export async function waitForPropertyLinks(
  page: Page,
  onMessage: (message: string) => void = () => undefined
): Promise<void> {
  const deadline = Date.now() + 90_000;
  let lastLog = 0;

  while (Date.now() < deadline) {
    const links = await extractLinksFromDom(page);
    if (links.length > 0) {
      onMessage(`Property link found: ${links[0].title}`);
      return;
    }

    const elapsed = Date.now() - lastLog;
    if (elapsed > 5000) {
      onMessage("Waiting for property list to finish loading...");
      lastLog = Date.now();
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(
    "Property links did not appear. The page may still be loading — refresh cookies.json and try again."
  );
}

export async function collectPropertyLinks(
  page: Page,
  onMessage: (message: string) => void = () => undefined
): Promise<PropertyRowLink[]> {
  await waitForPropertyLinks(page, onMessage);
  await page.waitForTimeout(1000);

  const domLinks = await extractLinksFromDom(page);
  const results: PropertyRowLink[] = [];

  for (const domLink of domLinks) {
    results.push({
      title: domLink.title,
      href: normalizeHref(domLink.href),
      vrboId: "",
      address: undefined,
    });
  }

  // Enrich with row data (vrbo id, address) when available.
  for (const result of results) {
    const propertyId = extractPropertyId(result.href);
    if (!propertyId) continue;

    const link = page.locator(`a.head[href*="propertyId=${propertyId}"], a[href*="propertyId=${propertyId}"]`).first();
    const row = link.locator("xpath=ancestor::*[@role='row' or self::tr][1]");
    const rowText = await row.innerText().catch(() => "");
    if (!rowText) continue;

    result.vrboId = rowText.match(/Vrbo\s*(\d+)/i)?.[1] ?? "";
    result.address = rowText
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.includes(",") && line !== result.title);
  }

  return results;
}

export function propertyDetailUrl(href: string): string {
  return normalizeHref(href);
}

async function extractLinksFromDom(page: Page): Promise<
  Array<{ href: string; title: string; propertyId: string; frameUrl: string }>
> {
  const results: Array<{ href: string; title: string; propertyId: string; frameUrl: string }> = [];

  for (const frame of getSearchContexts(page)) {
    const frameLinks = await frame
      .evaluate((selectors) => {
        const links: Array<{ href: string; title: string; propertyId: string }> = [];

        for (const selector of selectors) {
          for (const el of Array.from(document.querySelectorAll(selector))) {
            const anchor = el as HTMLAnchorElement;
            const href = anchor.getAttribute("href") ?? "";
            const title = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
            const match = href.match(/propertyId=(\d+)/i);
            if (!match || !title) continue;
            if (/^(dashboard|manage|inbox|calendar|help)$/i.test(title)) continue;

            links.push({ href, title, propertyId: match[1] });
          }
        }

        return links;
      }, PROPERTY_LINK_SELECTORS)
      .catch(() => []);

    for (const link of frameLinks) {
      results.push({ ...link, frameUrl: frame.url() });
    }
  }

  const seen = new Set<string>();
  return results.filter((link) => {
    if (seen.has(link.propertyId)) return false;
    seen.add(link.propertyId);
    return true;
  });
}

function getSearchContexts(page: Page): Array<Page | Frame> {
  const frames = page.frames();
  return frames.length > 0 ? frames : [page];
}

function extractPropertyId(href: string): string | null {
  return href.match(/propertyId=(\d+)/i)?.[1] ?? null;
}

function normalizeHref(href: string): string {
  if (href.startsWith("http")) return href;
  return `https://www.vrbo.com${href.startsWith("/") ? href : `/${href}`}`;
}
