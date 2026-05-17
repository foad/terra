import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_PHOTO = join(__dirname, "fixtures", "test-photo.jpg");

test("classify failure does not block the submission flow", async ({
  page,
}) => {
  // Stub uploads to succeed, classify to 502 — the user should still reach
  // and complete the survey.
  await page.route("**/photos/upload", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photo_key: "uploads/11111111-1111-1111-1111-111111111111.jpg",
        upload_url: "https://example.invalid/upload",
      }),
    }),
  );
  await page.route("https://example.invalid/upload", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await page.route("**/photos/classify", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ message: "Bedrock unavailable" }),
    }),
  );

  await page.goto("/");
  await expect(page.getByTestId("step-location")).toBeVisible({
    timeout: 15000,
  });

  await page
    .getByTestId("input-location-fallback")
    .fill("Classify-fail test building");
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("step-photo")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(TEST_PHOTO);
  await expect(page.getByTestId("photo-uploaded")).toBeVisible({
    timeout: 15000,
  });
  await page.getByTestId("btn-next").click();

  // Damage step: no AI badge, nothing pre-selected, but the user can still pick.
  await expect(page.getByTestId("step-damage")).toBeVisible();
  await expect(page.getByTestId("damage-partial")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByTestId("damage-partial").click();
  await page.getByTestId("btn-next").click();

  // Survey: infra type NOT pre-checked (classify failed → no AI suggestion).
  await expect(page.getByTestId("survey-step-0")).toBeVisible();
  await expect(
    page.locator(
      "#infra-Residential\\ Infrastructure\\ \\(Houses\\ and\\ apartments\\)",
    ),
  ).not.toBeChecked();
});
