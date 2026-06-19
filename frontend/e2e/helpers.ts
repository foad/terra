import { expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const TEST_PHOTO = join(__dirname, "fixtures", "test-photo.jpg");

export function e2ePrefix(testInfo: TestInfo): string {
  return `device-e2e-w${testInfo.workerIndex}-`;
}

const API_BASE = (process.env.VITE_API_URL ?? "").replace(/\/+$/, "");

type ReportFixture = {
  latitude: number;
  longitude: number;
  damage_level: "minimal" | "partial" | "complete";
  infrastructure_type: string[];
  crisis_nature: string[];
  pressing_needs?: string[];
};

export async function postE2EReport(
  prefix: string,
  report: ReportFixture,
): Promise<string> {
  const res = await fetch(`${API_BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...report,
      device_id: `${prefix}${randomUUID()}`,
    }),
  });
  if (!res.ok) throw new Error(`postE2EReport: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { id: string };
  return body.id;
}

export async function deleteE2EReports(prefix: string, token: string): Promise<number> {
  const res = await fetch(
    `${API_BASE}/reports/e2e?prefix=${encodeURIComponent(prefix)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) throw new Error(`deleteE2EReports: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { deleted: number };
  return body.deleted;
}

export async function setupDashboard(
  page: Page,
  testInfo: TestInfo,
): Promise<{ prefix: string; cleanup: () => Promise<void> }> {
  const { signInAsAnalyst } = await import("./auth");
  const prefix = e2ePrefix(testInfo);
  const { accessToken } = await signInAsAnalyst(page);

  await page.addInitScript((p) => {
    (globalThis as unknown as { __E2E_PREFIX__: string }).__E2E_PREFIX__ = p;
  }, prefix);

  return {
    prefix,
    cleanup: async () => {
      await deleteE2EReports(prefix, accessToken);
    },
  };
}

/**
 * Stub everything except POST /reports so tests don't hit the real backend
 * Reports are tagged and ignored
 */
export async function stubNonReportsApi(page: Page, testInfo: TestInfo): Promise<void> {
  const prefix = e2ePrefix(testInfo);
  await page.addInitScript((p) => {
    (globalThis as unknown as { __E2E_PREFIX__: string }).__E2E_PREFIX__ = p;
  }, prefix);
  await page.route("**/photos/upload", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photo_key: `uploads/${randomUUID()}.jpg`,
        upload_url: "/__e2e_fake_upload__",
      }),
    }),
  );
  await page.route("**/__e2e_fake_upload__", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await page.route("**/photos/classify", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "stubbed" }),
    }),
  );
  await page.route("**/crisis-events/active**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "stubbed" }),
    }),
  );
  // Stub the bbox reports fetch used by the coverage map so tests don't hit
  // the real reports endpoint on every map move.
  await page.route("**/reports**", (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "GET" && url.searchParams.has("west")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ type: "FeatureCollection", features: [] }),
      });
    } else {
      route.continue();
    }
  });
}

/**
 * Set the report location by dropping a pin on the map and advance to the
 * photo step. The location step stays disabled until a building is tapped or a
 * pin is placed; clicking empty map drops a draggable pin. Assumes the caller
 * is already on (or has just navigated to) the location step.
 */
export async function selectLocation(page: Page): Promise<void> {
  await expect(page.getByTestId("step-location")).toBeVisible({
    timeout: 15000,
  });
  // Let the map settle after the fly-to before clicking.
  await page.waitForTimeout(3000);
  await page
    .locator(".maplibregl-canvas")
    .click({ position: { x: 200, y: 250 } });
  await expect(page.getByTestId("btn-next")).not.toHaveClass(/disabled/, {
    timeout: 5000,
  });
  await page.getByTestId("btn-next").click();
}

/**
 * Run through the full submission flow from the location step (or via the
 * "Submit Another" button if already on the confirmation step) to the
 * confirmation. Caller is responsible for navigating to / waiting for SW.
 */
export async function completeReportFlow(page: Page): Promise<void> {
  // If we're on the confirmation step, bounce back to location first.
  const onConfirmation = await page
    .getByTestId("step-confirmation")
    .isVisible()
    .catch(() => false);
  if (onConfirmation) {
    await page.getByRole("button", { name: /submit another/i }).click();
  }

  await selectLocation(page);

  await expect(page.getByTestId("step-photo")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(TEST_PHOTO);
  await expect(page.getByTestId("photo-uploaded")).toBeVisible({
    timeout: 15000,
  });
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("step-damage")).toBeVisible();
  await page.getByTestId("damage-partial").click();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-0")).toBeVisible();
  await page
    .locator(
      "#infra-Residential\\ Infrastructure\\ \\(Houses\\ and\\ apartments\\)",
    )
    .check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-1")).toBeVisible();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-2")).toBeVisible();
  await page.locator("#crisis-Earthquake").check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-3")).toBeVisible();
  await page.locator("#debris-yes").check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-4")).toBeVisible();
  await page.locator("#elec-No\\ damage\\ observed").check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-5")).toBeVisible();
  await page.locator("#health-Fully\\ functional").check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-6")).toBeVisible();
  await page
    .locator("#need-Food\\ assistance\\ and\\ safe\\ drinking\\ water")
    .check();
  await page.getByTestId("btn-submit").click();

  await expect(page.getByTestId("step-confirmation")).toBeVisible({
    timeout: 15000,
  });
}
