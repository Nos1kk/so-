const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: "qa-requested-sofa-cards.spec.js",
  reporter: "line",
  use: {
    viewport: { width: 390, height: 844 }
  },
  webServer: {
    command: "node ../server.js",
    cwd: __dirname,
    url: "http://127.0.0.1:8000",
    reuseExistingServer: true
  }
});
