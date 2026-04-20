import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_PHOTO = join(__dirname, "fixtures", "test-photo.jpg");

const PREVIEW_URL = process.env.E2E_BASE_URL ?? "http://localhost:4173";

test("offline submit then sync on reconnect", async ({ browser }) => {
  const context = await browser.newContext({
    geolocation: { latitude: 36.2, longitude: 36.16 },
    permissions: ["geolocation"],
  });

  const page = await context.newPage();

  // Install and activate service worker
  await page.goto(PREVIEW_URL);
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Go offline
  await context.setOffline(true);

  // Step 1: Location
  await page.getByTestId("input-location-fallback").fill("Offline test building");
  await page.getByTestId("btn-next").click();

  // Step 2: Photo
  await expect(page.getByTestId("step-photo")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(TEST_PHOTO);
  await expect(page.getByTestId("photo-uploaded")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("btn-next").click();

  // Step 3: Damage
  await expect(page.getByTestId("step-damage")).toBeVisible();
  await page.getByTestId("damage-partial").click();
  await page.getByTestId("btn-next").click();

  // Step 4: Survey (7 sub-steps)
  await expect(page.getByTestId("survey-step-0")).toBeVisible();
  await page.locator("#infra-Residential\\ Infrastructure\\ \\(Houses\\ and\\ apartments\\)").check();
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
  await page.locator("#need-Food\\ assistance\\ and\\ safe\\ drinking\\ water").check();
  await page.getByTestId("btn-submit").click();

  // Should show queued confirmation
  await expect(page.getByTestId("step-confirmation")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Report Queued")).toBeVisible();

  // Go back online
  await context.setOffline(false);

  // Wait for sync to process
  await expect(page.getByText("Syncing")).not.toBeVisible({ timeout: 30000 });

  await context.close();
});
