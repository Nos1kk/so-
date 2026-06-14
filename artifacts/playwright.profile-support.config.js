const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: [
    "qa-profile-card-actions.spec.js",
    "qa-profile-behavior-final.spec.js",
    "qa-profile-admin-save-settings.spec.js",
    "qa-profile-support-threads.spec.js",
    "qa-support-full-regression.spec.js",
    "qa-zero-reviews-rating.spec.js"
  ],
  reporter: "line",
  workers: 1,
  webServer: {
    command: "node ../server.js",
    cwd: __dirname,
    url: "http://127.0.0.1:8000",
    reuseExistingServer: true
  }
});
