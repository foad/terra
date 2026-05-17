import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_PHOTO = join(__dirname, "fixtures", "test-photo.jpg");

test("AI classification pre-selects damage and infrastructure with confidence badge", async ({
  page,
}) => {
  // Stub the classify endpoint with a confident response BEFORE the photo
  // upload completes; the PWA fires classify the moment the photo_key is set.
  await page.route("**/photos/classify", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        damage_level: "partial",
        damage_confidence: 0.9,
        infrastructure_type: ["residential"],
        infrastructure_confidence: 0.9,
      }),
    }),
  );

  // Stub the upload endpoint so the photo step succeeds without S3.
  await page.route("**/photos/upload", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photo_key: "uploads/00000000-0000-0000-0000-000000000000.jpg",
        upload_url: "https://example.invalid/upload",
      }),
    }),
  );
  await page.route("https://example.invalid/upload", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );

  await page.goto("/");
  await expect(page.getByTestId("step-location")).toBeVisible({
    timeout: 15000,
  });

  // Location: text fallback (map interaction is fiddly in headless)
  await page
    .getByTestId("input-location-fallback")
    .fill("AI test building");
  await page.getByTestId("btn-next").click();

  // Photo: upload, the stubbed classify fires automatically
  await expect(page.getByTestId("step-photo")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(TEST_PHOTO);
  await expect(page.getByTestId("photo-uploaded")).toBeVisible({
    timeout: 15000,
  });
  await page.getByTestId("btn-next").click();

  // Damage step: AI should have pre-selected "partial" with a 90% badge.
  await expect(page.getByTestId("step-damage")).toBeVisible();
  const partialCard = page.getByTestId("damage-partial");
  await expect(partialCard).toHaveAttribute("aria-pressed", "true");
  await expect(partialCard).toContainText("90%");

  await page.getByTestId("btn-next").click();

  // Survey step 0: infrastructure type checkbox for residential should be
  // checked from the AI pre-fill.
  await expect(page.getByTestId("survey-step-0")).toBeVisible();
  await expect(
    page.locator(
      "#infra-Residential\\ Infrastructure\\ \\(Houses\\ and\\ apartments\\)",
    ),
  ).toBeChecked();
});
