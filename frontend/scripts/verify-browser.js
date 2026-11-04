import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  const consoleMessages = [];
  const networkRequests = [];
  page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleMessages.push(`[PAGE ERROR] ${err.toString()}`));
  page.on('request', (req) => networkRequests.push(req.url()));

  try {
    // -------------------------------------------------------------
    // 1. DESKTOP 1440px
    // -------------------------------------------------------------
    console.log('--- Testing 1440px Desktop Viewport ---');
    await page.setViewport({ width: 1440, height: 900 });

    // Home minimal placeholder
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'home-1440px.png'),
    });
    console.log('✓ Captured home-1440px.png');

    // Menu overlay at 1440px
    const menuBtn1440 = await page.$('button[aria-label="Open Menu"]');
    if (menuBtn1440) {
      await menuBtn1440.click();
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'nav-menu-overlay-1440px.png'),
      });
      console.log('✓ Captured nav-menu-overlay-1440px.png');
      const closeMenu1440 = await page.$('button[aria-label="Close Menu"]');
      if (closeMenu1440) await closeMenu1440.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // SideSheet at 1440px
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent.includes('Run scenario'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'sidesheet-1440px.png'),
    });
    console.log('✓ Captured sidesheet-1440px.png');
    // Close sidesheet
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent.includes('Cancel'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Design System at 1440px
    await page.goto('http://127.0.0.1:5173/_design', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'design-1440px-full.png'),
      fullPage: true,
    });
    console.log('✓ Captured design-1440px-full.png');

    // -------------------------------------------------------------
    // 2. TABLET 1024px
    // -------------------------------------------------------------
    console.log('--- Testing 1024px Tablet Viewport ---');
    await page.setViewport({ width: 1024, height: 900 });

    // Home at 1024px
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'home-1024px.png'),
    });
    console.log('✓ Captured home-1024px.png');

    // Menu overlay at 1024px
    const menuBtn1024 = await page.$('button[aria-label="Open Menu"]');
    if (menuBtn1024) {
      await menuBtn1024.click();
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'nav-menu-overlay-1024px.png'),
      });
      console.log('✓ Captured nav-menu-overlay-1024px.png');
      const closeMenu1024 = await page.$('button[aria-label="Close Menu"]');
      if (closeMenu1024) await closeMenu1024.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // SideSheet at 1024px
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent.includes('Run scenario'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'sidesheet-1024px.png'),
    });
    console.log('✓ Captured sidesheet-1024px.png');
    // Close sidesheet
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent.includes('Cancel'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Design System at 1024px
    await page.goto('http://127.0.0.1:5173/_design', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'design-1024px-full.png'),
      fullPage: true,
    });
    console.log('✓ Captured design-1024px-full.png');

    // -------------------------------------------------------------
    // 3. AUDIT NETWORK & CONSOLE
    // -------------------------------------------------------------
    console.log('--- Network & Console Audits ---');
    const externalRequests = networkRequests.filter((url) => {
      return !url.includes('127.0.0.1') && !url.includes('localhost') && !url.startsWith('data:');
    });
    console.log('External CDN Requests Count:', externalRequests.length);
    if (externalRequests.length > 0) {
      console.log('External Requests found:', externalRequests);
    } else {
      console.log('CONFIRMED: Zero external CDN requests. All fonts and assets are 100% self-hosted locally!');
    }

    const errors = consoleMessages.filter((m) => m.toLowerCase().includes('error'));
    console.log('Browser Console Errors Count:', errors.length);
    if (errors.length > 0) {
      console.log('Console Errors:', errors);
    } else {
      console.log('CONFIRMED: Clean browser console with zero errors!');
    }
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await browser.close();
    console.log('Browser verification completed.');
  }
}

run();
