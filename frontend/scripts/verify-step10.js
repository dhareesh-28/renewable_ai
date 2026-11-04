import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('screenshots/step10');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verify() {
  console.log('=== Step 10 Verification Suite (/forecast) ===');
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_s10_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: tempProfile,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
  });

  try {
    // -----------------------------------------------------------------
    // 1. FAULT DAY TEST (2026-01-14)
    // -----------------------------------------------------------------
    console.log('\n--- 1. Testing Fault Day (2026-01-14) at 1440x900 ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(
      'http://127.0.0.1:5173/forecast?start=2026-01-14+00%3A00%3A00&end=2026-01-14+23%3A00%3A00&view=forecast',
      { waitUntil: 'domcontentloaded' }
    );

    // Wait for the data to load and chart or banner to appear
    await page.waitForFunction(
      () => document.body.innerText.includes('Possible solar generation fault detected'),
      { timeout: 20000 }
    );
    await page.waitForSelector('svg, canvas', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));

    const faultBannerExists = await page.evaluate(() => {
      return document.body.innerText.includes('Possible solar generation fault detected');
    });
    console.log('• Fault day banner visible:', faultBannerExists ? 'PASS (Visible)' : 'FAIL (Missing)');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-forecast-fault-day.png') });
    console.log('✓ Captured 1440-forecast-fault-day.png');

    // -----------------------------------------------------------------
    // 2. NO-FAULT DAY TEST (2026-01-02)
    // -----------------------------------------------------------------
    console.log('\n--- 2. Testing No-Fault Day (2026-01-02) at 1440x900 ---');
    await page.goto(
      'http://127.0.0.1:5173/forecast?start=2026-01-02+00%3A00%3A00&end=2026-01-02+23%3A00%3A00&view=forecast',
      { waitUntil: 'domcontentloaded' }
    );

    // Wait for the chart to load (confirming query finished)
    await page.waitForSelector('svg, canvas', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 800));

    const noFaultBannerExists = await page.evaluate(() => {
      return document.body.innerText.includes('Possible solar generation fault detected');
    });
    console.log('• No-fault day banner hidden:', !noFaultBannerExists ? 'PASS (Correctly Hidden)' : 'FAIL (Unexpectedly shown)');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-forecast-no-fault-day.png') });
    console.log('✓ Captured 1440-forecast-no-fault-day.png');

    // -----------------------------------------------------------------
    // 3. FAULTS VIEW & SIDESHEET (Month of Jan 2026)
    // -----------------------------------------------------------------
    console.log('\n--- 3. Testing Faults View & Diagnostic SideSheet ---');
    await page.goto(
      'http://127.0.0.1:5173/forecast?start=2026-01-01+00%3A00%3A00&end=2026-01-31+23%3A00%3A00&view=faults',
      { waitUntil: 'domcontentloaded' }
    );

    // Wait for DataTable rows to appear
    await page.waitForSelector('tbody tr', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-faults-view.png') });
    console.log('✓ Captured 1440-faults-view.png');

    // Click first row in table to open SideSheet
    console.log('Clicking table row to open SideSheet...');
    await page.evaluate(() => {
      const firstRow = document.querySelector('tbody tr');
      if (firstRow) firstRow.click();
    });

    await page.waitForFunction(
      () => document.body.innerText.includes('Fault Event Diagnostics'),
      { timeout: 10000 }
    );
    await page.waitForSelector('svg, canvas', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const sideSheetVisible = await page.evaluate(() => {
      return document.body.innerText.includes('Fault Event Diagnostics');
    });
    console.log('• SideSheet open verification:', sideSheetVisible ? 'PASS (SideSheet opened)' : 'FAIL');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-faults-sidesheet.png') });
    console.log('✓ Captured 1440-faults-sidesheet.png');

    // Close SideSheet
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 500));

    // -----------------------------------------------------------------
    // 4. NEXT 24 HOURS (OUTLOOK) VIEW
    // -----------------------------------------------------------------
    console.log('\n--- 4. Testing Next 24 Hours (Outlook) View ---');
    await page.goto(
      'http://127.0.0.1:5173/forecast?start=2026-01-14+00%3A00%3A00&end=2026-01-14+23%3A00%3A00&view=outlook',
      { waitUntil: 'domcontentloaded' }
    );

    // Wait for dispatch chart and recommended actions to populate (query to finish)
    await page.waitForFunction(
      () => document.body.innerText.includes('Charge storage'),
      { timeout: 20000 }
    );
    await new Promise((r) => setTimeout(r, 800));

    const actionsCount = await page.evaluate(() => {
      const actions = document.querySelectorAll('h3, h4');
      const text = Array.from(actions).map((a) => a.textContent || '');
      return text.filter((t) => t.toLowerCase().includes('storage') || t.toLowerCase().includes('window') || t.toLowerCase().includes('baseline') || t.toLowerCase().includes('grid')).length;
    });
    console.log('• Dynamic recommended actions rendered count:', actionsCount);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-outlook-view.png') });
    console.log('✓ Captured 1440-outlook-view.png');

    // -----------------------------------------------------------------
    // 5. VIEWPORT 1024x768 CAPTURES
    // -----------------------------------------------------------------
    console.log('\n--- 5. Capturing at 1024x768 ---');
    await page.setViewport({ width: 1024, height: 768 });

    await page.goto(
      'http://127.0.0.1:5173/forecast?start=2026-01-14+00%3A00%3A00&end=2026-01-14+23%3A00%3A00&view=forecast',
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForFunction(
      () => document.body.innerText.includes('Possible solar generation fault detected'),
      { timeout: 20000 }
    );
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-forecast-view.png') });
    console.log('✓ Captured 1024-forecast-view.png');

    await page.goto(
      'http://127.0.0.1:5173/forecast?start=2026-01-01+00%3A00%3A00&end=2026-01-31+23%3A00%3A00&view=faults',
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForSelector('tbody tr', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-faults-view.png') });
    console.log('✓ Captured 1024-faults-view.png');

    await page.goto(
      'http://127.0.0.1:5173/forecast?start=2026-01-14+00%3A00%3A00&end=2026-01-14+23%3A00%3A00&view=outlook',
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForFunction(
      () => document.body.innerText.includes('Charge storage'),
      { timeout: 20000 }
    );
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-outlook-view.png') });
    console.log('✓ Captured 1024-outlook-view.png');

    // -----------------------------------------------------------------
    // 6. CONSOLE CLEANLINESS CHECK
    // -----------------------------------------------------------------
    console.log('\n--- 6. Console Cleanliness Audit ---');
    console.log('Total Console Errors:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.error('Errors:', consoleErrors);
    } else {
      console.log('CONFIRMED: Zero console errors on /forecast!');
    }

  } catch (err) {
    console.error('Step 10 verification error:', err);
  } finally {
    await browser.close();
    console.log('\nStep 10 verification finished.');
  }
}

verify().catch(console.error);