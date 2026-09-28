// Playwright smoke tests. Serves the folder with python and drives Chromium only.
// Set CHROMIUM_PATH to use an already-installed browser (e.g. /opt/pw-browsers/chromium).
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8123;

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 30000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:' + PORT,
    ...devices['Desktop Chrome'],
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'python3 -m http.server ' + PORT,
    url: 'http://localhost:' + PORT + '/index.html',
    reuseExistingServer: !process.env.CI
  }
});
