import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const TEST_PHOTO = join(__dirname, "fixtures", "test-photo.jpg");

/**
 * Stub everything except POST /reports so tests don't hit the real backend
 * (no Bedrock calls, no S3 photo uploads, no synthetic data in prod).
 * Tests retain control over POST /reports via their own `page.route` calls
 * registered AFTER this helper.
 */
export async function stubNonReportsApi(page: Page): Promise<void> {
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
}

/**
 * Run through the full submission flow from the location step (or via the
 * "Submit Another" button if already on the confirmation step) to the
 * confirmation. Caller is responsible for navigating to / waiting for SW.
 */
export async function completeReportFlow(
  page: Page,
  opts: { description?: string } = {},
): Promise<void> {
  // If we're on the confirmation step, bounce back to location first.
  const onConfirmation = await page
    .getByTestId("step-confirmation")
    .isVisible()
    .catch(() => false);
  if (onConfirmation) {
    await page.getByRole("button", { name: /submit another/i }).click();
  }

  await expect(page.getByTestId("step-location")).toBeVisible({
    timeout: 15000,
  });
  await page
    .getByTestId("input-location-fallback")
    .fill(opts.description ?? "Helper test building");
  await page.getByTestId("btn-next").click();

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
