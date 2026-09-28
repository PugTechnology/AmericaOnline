// Shared test setup: a page that records errors and can't reach the network.
const base = require('@playwright/test');

exports.expect = base.expect;
exports.test = base.test.extend({
  // page.errors collects pageerrors, console errors and failed requests.
  page: async ({ page }, use) => {
    const errors = [];
    page.errors = errors;
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    // (Aborted off-site requests are ours, so only local failures count.)
    page.on('requestfailed', (r) => { if (/^https?:\/\/localhost[:/]/.test(r.url())) errors.push('requestfailed: ' + r.url()); });
    // Nothing leaves localhost, so Wayback and YouTube can't slow (or flake) a test.
    await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
    await use(page);
  }
});

// Opens the desktop directly and waits for the shell to be up.
exports.desktop = async function (page, query) {
  await page.goto('/index.html?desktop' + (query || ''));
  await page.waitForFunction(() => window.Shell && Shell.ready() && document.getElementById('desktop'));
};
