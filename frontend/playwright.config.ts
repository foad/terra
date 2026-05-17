import { defineConfig } from "@playwright/test";

const DEFAULT_BASE_URL = "http://localhost:4173";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL,
    geolocation: { latitude: 36.2, longitude: 36.16 },
    permissions: ["geolocation"],
  },
  // When E2E_BASE_URL is set we're targeting a deployed environment (CI runs
  // tests against terra.foad.dev); skip the local preview-server lifecycle.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node e2e/preview-server.mjs",
        url: DEFAULT_BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
