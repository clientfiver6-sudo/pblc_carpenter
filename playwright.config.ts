import { defineConfig, devices } from "playwright/test"

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    storageState: ".playwright/auth.json",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
