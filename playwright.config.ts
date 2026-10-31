import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm dev:api",
      url: "http://127.0.0.1:4000/health/live",
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgresql://astrelune:astrelune@localhost:5433/astrelune?schema=public",
        ALLOWED_ORIGINS: "http://localhost:5174,http://127.0.0.1:5174",
        ASTRELUNE_AUTH_RATE_LIMIT_MAX: "1000",
      },
    },
    {
      command: "pnpm dev:web",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: "",
      },
    },
  ],
});
