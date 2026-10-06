import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  fullyParallel: false,
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "iPhone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    { name: "Android", use: { ...devices["Pixel 7"] } },
  ],
});
