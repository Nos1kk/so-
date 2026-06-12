const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: "qa-unified-cards-admin-login.spec.js",
  reporter: "line",
  webServer: {
    command: "node ../server.js",
    cwd: __dirname,
    url: "http://127.0.0.1:8000",
    reuseExistingServer: true
  }
});
