const fs = require('fs');
const path = require('path');
const { test, expect, desktop } = require('./fixtures');

// Every Shell.register('id' ...) in js/, minus dialogs that end the session.
function appIds() {
  const ids = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.js$/.test(e.name)) {
      const re = /Shell\.register\('([\w-]+)'/g;
      let m;
      const src = fs.readFileSync(p, 'utf8');
      while ((m = re.exec(src))) ids.push(m[1]);
    }
  });
  walk(path.join(__dirname, '..', 'js'));
  return ids.filter((id) => id !== 'shutdown' && id !== 'run');
}

test('desktop loads cleanly', async ({ page }) => {
  await desktop(page);
  await expect(page.locator('#desktop')).toBeVisible();
  expect(page.errors).toEqual([]);
});

test.describe('launch each app', () => {
  for (const id of appIds()) {
    test(id, async ({ page }) => {
      await desktop(page);
      await page.evaluate((i) => { Shell.launch(i); }, id);
      // AOL and its CD show a splash first, so wait for the window.
      await expect.poll(() => page.evaluate(() => WM.windows.length)).toBeGreaterThan(0);
      await page.waitForTimeout(150);
      expect(page.errors).toEqual([]);
    });
  }
});

test('notepad saves to C: and reopens', async ({ page }) => {
  await desktop(page);
  await page.evaluate(() => Shell.launch('notepad'));
  await page.locator('.notepad-text').fill('hello from 1998');
  await page.keyboard.press('Control+s');
  const dlg = page.locator('.window.dialog');
  await expect(dlg).toBeVisible();
  await dlg.locator('input[type=text]').last().fill('C:\\My Documents\\smoke.txt');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => FS.exists('C:\\My Documents\\smoke.txt'))).toBe(true);
  expect(await page.evaluate(() => FS.read('C:\\My Documents\\smoke.txt'))).toBe('hello from 1998');
  await page.evaluate(() => WM.closeAll());
  await page.evaluate(() => Shell.launch('notepad', 'C:\\My Documents\\smoke.txt'));
  await expect(page.locator('.notepad-text')).toHaveValue('hello from 1998');
  expect(page.errors).toEqual([]);
});

test('corrupt C: drive is repaired', async ({ page }) => {
  // (Init scripts run in every frame, so guard against opaque ones.)
  await page.addInitScript(() => { try { localStorage.setItem('w98.cdrive.v1', '{not json'); } catch (e) { /* not our frame */ } });
  await desktop(page);
  expect(await page.evaluate(() => FS.repaired)).toBe(true);
  expect(await page.evaluate(() => FS.isDir('C:\\My Documents'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('w98.cdrive.v1.corrupt'))).toBe('{not json');
  await expect(page.locator('.window.msgbox, .window.dialog').first()).toBeVisible();
  expect(page.errors).toEqual([]);
});

test('loads at 320px wide', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await desktop(page);
  await expect(page.locator('#desktop')).toBeVisible();
  expect(page.errors).toEqual([]);
});

test('FreeCell game 1 deals the classic first row', async ({ page }) => {
  await desktop(page);
  const row = await page.evaluate(() => {
    const win = Shell.launch('freecell');
    win.game.newGame(1);
    return win.game.layout().map((col) => col[0]);
  });
  expect(row).toEqual(['JD', '2D', '9H', 'JC', '5D', '7H', '7C', '5H']);
});

test('Calculator does 2+3*4= as 20', async ({ page }) => {
  await desktop(page);
  await page.evaluate(() => Shell.launch('calc'));
  for (const k of ['2', '+', '3', '*', '4', '=']) await page.keyboard.press(k);
  await expect(page.locator('.calc-display').first()).toHaveText(/^\s*20\.?\s*$/);
});

test('WordPad sanitizer strips scripts and handlers', async ({ page }) => {
  await desktop(page);
  await page.evaluate(() => Shell.launch('wordpad'));
  const out = await page.evaluate(() => {
    const r = WordPadSanitize('<p onclick="x()">hi<script>alert(1)</script><img src=x onerror="alert(2)"><b>bold</b></p>');
    return typeof r === 'string' ? r : r.innerHTML;
  });
  expect(out).not.toMatch(/<script/i);
  expect(out).not.toMatch(/onerror|onclick/i);
  expect(out).toContain('bold');
});

test('AOL signs on as Guest and opens the mailbox', async ({ page }) => {
  // No modem sound (and no busy signal) shortens the dial-up to a few seconds.
  await page.addInitScript(() => {
    try { localStorage.setItem('w98.aol', JSON.stringify({ setup: { modemSounds: false, busySignals: false, idleMinutes: 45 } })); } catch (e) { /* not our frame */ }
  });
  await desktop(page);
  await page.evaluate(() => Shell.launch('aol'));
  const signon = page.locator('.aol-signon');
  await expect(signon).toBeVisible({ timeout: 10000 });
  await signon.locator('select').first().selectOption('__guest');
  await signon.getByRole('button', { name: 'SIGN ON' }).click();
  await expect(page.locator('.window.aol .title').first()).toContainText(/America Online - Guest\d+/, { timeout: 25000 });
  // The Read toolbar button opens the Online Mailbox (the welcome window covers it, so dispatch).
  await page.getByText('Read', { exact: true }).first().dispatchEvent('click');
  await expect(page.locator('.aol-mailbox')).toBeVisible();
  expect(page.errors).toEqual([]);
});
