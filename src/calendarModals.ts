import type { Page } from "playwright";
import { delay } from "./utils.js";

// Only dismiss onboarding modals — NOT "Done" on booking tooltips.
const ONBOARDING_BUTTONS = [/^got it$/i, /^next$/i];

export async function dismissCalendarModals(
  page: Page,
  onMessage: (message: string) => void = () => undefined
): Promise<void> {
  for (let round = 0; round < 5; round++) {
    let dismissed = false;

    for (const pattern of ONBOARDING_BUTTONS) {
      const button = page.getByRole("button", { name: pattern }).first();
      if (await button.isVisible().catch(() => false)) {
        const label = (await button.innerText().catch(() => "")).trim() || "popup";
        await button.click().catch(() => undefined);
        onMessage(`Dismissed onboarding popup: ${label}`);
        await delay(400);
        dismissed = true;
      }
    }

    const changesModal = page.getByText(/we've made some changes to the calendar/i);
    if (await changesModal.isVisible().catch(() => false)) {
      const gotIt = page.getByRole("button", { name: /^got it$/i }).first();
      if (await gotIt.isVisible().catch(() => false)) {
        await gotIt.click().catch(() => undefined);
        onMessage("Dismissed calendar changes modal.");
        await delay(400);
        dismissed = true;
      }
    }

    if (!dismissed) break;
  }
}
