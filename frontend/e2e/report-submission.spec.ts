import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_PHOTO = join(__dirname, "fixtures", "test-photo.jpg");

test("full report submission flow", async ({ page }) => {
  await page.goto("/");

  // Step 1: Location
  await expect(page.getByTestId("step-location")).toBeVisible({ timeout: 15000 });

  // Wait for map to settle after fly-to
  await page.waitForTimeout(3000);

  // Use text fallback since clicking PMTiles features is unreliable in headless
  await page.getByTestId("input-location-fallback").fill("Test building near central market");
  await page.getByTestId("btn-next").click();

  // Step 2: Photo
  await expect(page.getByTestId("step-photo")).toBeVisible();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(TEST_PHOTO);
  await expect(page.getByTestId("photo-uploaded")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("btn-next").click();

  // Step 3: Damage
  await expect(page.getByTestId("step-damage")).toBeVisible();
  await page.getByTestId("damage-partial").click();
  await page.getByTestId("btn-next").click();

  // Step 4: Survey (7 sub-steps)

  // 4.1 Infrastructure type
  await expect(page.getByTestId("survey-step-0")).toBeVisible();
  await page.locator("#infra-Residential\\ Infrastructure\\ \\(Houses\\ and\\ apartments\\)").check();
  await page.getByTestId("btn-next").click();

  // 4.2 Infrastructure name (optional)
  await expect(page.getByTestId("survey-step-1")).toBeVisible();
  await page.getByTestId("btn-next").click();

  // 4.3 Crisis nature
  await expect(page.getByTestId("survey-step-2")).toBeVisible();
  await page.locator("#crisis-Earthquake").check();
  await page.getByTestId("btn-next").click();

  // 4.4 Debris
  await expect(page.getByTestId("survey-step-3")).toBeVisible();
  await page.locator("#debris-yes").check();
  await page.getByTestId("btn-next").click();

  // 4.5 Electricity
  await expect(page.getByTestId("survey-step-4")).toBeVisible();
  await page.locator("#elec-No\\ damage\\ observed").check();
  await page.getByTestId("btn-next").click();

  // 4.6 Health
  await expect(page.getByTestId("survey-step-5")).toBeVisible();
  await page.locator("#health-Fully\\ functional").check();
  await page.getByTestId("btn-next").click();

  // 4.7 Pressing needs
  await expect(page.getByTestId("survey-step-6")).toBeVisible();
  await page.locator("#need-Food\\ assistance\\ and\\ safe\\ drinking\\ water").check();
  await page.getByTestId("btn-submit").click();

  // Confirmation
  await expect(page.getByTestId("step-confirmation")).toBeVisible({ timeout: 15000 });
});
