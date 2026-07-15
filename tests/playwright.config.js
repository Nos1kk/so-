const { defineConfig } = require("playwright/test");
const path = require("path");

const serverEnv = {
  ...process.env,
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: "8000",
  SONA_DATA_DIR: process.env.SONA_DATA_DIR || path.resolve(__dirname, "../tmp/e2e-speed-live-8000"),
  SONA_TEST_ADMIN_PASSWORD: process.env.SONA_TEST_ADMIN_PASSWORD || "SonaTest2026!",
  SONA_TEST_AUTH_CODE: process.env.SONA_TEST_AUTH_CODE || "123456"
};

// Some Windows launchers expose both Path and PATH; child_process only needs one.
delete serverEnv.Path;

module.exports = defineConfig({
  testDir: ".",
  testMatch: ["ui.e2e.spec.js", "desktop-home-design.e2e.spec.js"],
  reporter: "line",
  timeout: 90000,
  webServer: {
    command: `"${process.execPath}" server.js`,
    cwd: path.resolve(__dirname, ".."),
    env: serverEnv,
    url: "http://127.0.0.1:8000/health",
    reuseExistingServer: true,
    timeout: 30000,
    stdout: "pipe",
    stderr: "pipe"
  },
  use: {
    baseURL: process.env.SONA_TEST_BASE_URL || "http://127.0.0.1:8000",
    launchOptions: process.env.SONA_BROWSER_PATH ? { executablePath: process.env.SONA_BROWSER_PATH } : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});
