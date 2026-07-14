const { defineConfig } = require("playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: "ui.e2e.spec.js",
  reporter: "line",
  timeout: 90000,
  use: {
    baseURL: process.env.SONA_TEST_BASE_URL || "http://127.0.0.1:8000",
    launchOptions: process.env.SONA_BROWSER_PATH ? { executablePath: process.env.SONA_BROWSER_PATH } : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});
