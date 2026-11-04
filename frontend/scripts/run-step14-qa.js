import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('screenshots/step14');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 800 },
  { name: '768', width: 768, height: 1024 },
];

async function clickButtonWithText(page, text) {
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const t = await page.evaluate(el => el.innerText, b);
    if (t && t.includes(text)) {
      await b.click();
      return true;
    }
  }
  return false;
}

async function runQA() {
  console.log('=== Step 14 Full Production QA Walkthrough ===');
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_step14_'));
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
    // -------------------------------------------------------------
    // 1. HOME ROUTE ('/')
    // -------------------------------------------------------------
    for (const vp of VIEWPORTS) {
      console.log(`Testing Home page at ${vp.name}px...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1500));

      // Capture Hero
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-home-hero.png`),
      });

      // Scroll to Numbers Section
      const numbersSec = await page.$('#numbers');
      if (numbersSec) {
        await numbersSec.scrollIntoViewIfNeeded();
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${vp.name}-home-numbers.png`),
        });
      }

      // Scroll to Module Showcase
      const showcaseSec = await page.$('#showcase');
      if (showcaseSec) {
        await showcaseSec.scrollIntoViewIfNeeded();
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${vp.name}-home-showcase.png`),
        });
      }

      // Scroll to Optimise Band (Deep Moss)
      const optSec = await page.$('#optimise');
      if (optSec) {
        await optSec.scrollIntoViewIfNeeded();
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${vp.name}-home-optimise-band.png`),
        });
      }

      // Scroll to Principles Section
      const princSec = await page.$('#principles');
      if (princSec) {
        await princSec.scrollIntoViewIfNeeded();
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${vp.name}-home-principles.png`),
        });
      }
    }

    // Exercise Carousel Controls on Home (pause/play button & slide clicking)
    console.log('Exercising Carousel pause/play and slide buttons...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:5173/#showcase', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));
    const pauseBtn = await page.$('button[aria-label*="Pause Carousel Auto-Advance"]');
    if (pauseBtn) {
      await pauseBtn.click();
      await new Promise(r => setTimeout(r, 400));
      console.log('Carousel paused via button click.');
    }
    const slide2Btn = await page.$('button[aria-label="Select module 2"]');
    if (slide2Btn) {
      await slide2Btn.click();
      await new Promise(r => setTimeout(r, 600));
      console.log('Switched to Module 2 via pagination.');
    }

    // -------------------------------------------------------------
    // 2. FORECAST ROUTE ('/forecast')
    // -------------------------------------------------------------
    for (const vp of VIEWPORTS) {
      console.log(`Testing Forecast page at ${vp.name}px...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://127.0.0.1:5173/forecast', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1200));

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-forecast-view.png`),
      });

      // Switch to Faults view
      const faultsClicked = await clickButtonWithText(page, 'Faults');
      if (faultsClicked) {
        await new Promise(r => setTimeout(r, 800));
        if (vp.name === '1440') {
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `1440-forecast-faults-tab.png`),
          });
        }
      }

      // Switch to Outlook view
      const outlookClicked = await clickButtonWithText(page, 'Next 24 hours');
      if (outlookClicked) {
        await new Promise(r => setTimeout(r, 800));
        if (vp.name === '1440') {
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `1440-forecast-outlook-tab.png`),
          });
        }
      }
    }

    // -------------------------------------------------------------
    // 3. ENERGY ROUTE ('/energy')
    // -------------------------------------------------------------
    for (const vp of VIEWPORTS) {
      console.log(`Testing Energy page at ${vp.name}px...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://127.0.0.1:5173/energy', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1500));

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-energy-overview.png`),
      });

      // Scroll down to Sankey & Grid Heatmap
      await page.evaluate(() => window.scrollBy(0, 700));
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-energy-sankey-heatmap.png`),
      });
    }

    // -------------------------------------------------------------
    // 4. COST ROUTE ('/cost')
    // -------------------------------------------------------------
    for (const vp of VIEWPORTS) {
      console.log(`Testing Cost page at ${vp.name}px...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://127.0.0.1:5173/cost', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1500));

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-cost-overview.png`),
      });

      // Scroll down to Arbitrage, Monthly Savings & Deep-Moss Band
      await page.evaluate(() => window.scrollBy(0, 900));
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-cost-arbitrage-band.png`),
      });
    }

    // -------------------------------------------------------------
    // 5. MODELS ROUTE ('/models')
    // -------------------------------------------------------------
    for (const vp of VIEWPORTS) {
      console.log(`Testing Models page at ${vp.name}px...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://127.0.0.1:5173/models', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1500));

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-models-overview.png`),
      });

      // Scroll down to Confusion Matrices & Methodology
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-models-matrices-methodology.png`),
      });
    }

    // -------------------------------------------------------------
    // 6. DESIGN SYSTEM ROUTE ('/_design')
    // -------------------------------------------------------------
    for (const vp of VIEWPORTS) {
      console.log(`Testing Design System page at ${vp.name}px...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://127.0.0.1:5173/_design', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1200));

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-design-system.png`),
      });
    }

    // -------------------------------------------------------------
    // 7. NOT FOUND 404 ROUTE ('/unknown-route')
    // -------------------------------------------------------------
    for (const vp of VIEWPORTS) {
      console.log(`Testing 404 page at ${vp.name}px...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://127.0.0.1:5173/unknown-solar-coordinate', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 800));

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}-404-not-found.png`),
      });
    }

    // -------------------------------------------------------------
    // 8. MENU OVERLAY & SIDESHEET (Responsive 1024 / 768)
    // -------------------------------------------------------------
    console.log('Testing Menu Overlay at 768px (checking mobile horizon toggle)...');
    await page.setViewport({ width: 768, height: 1024 });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));

    // Open Menu Overlay
    const menuBtn = await page.$('button[aria-label="Open Menu"]');
    if (menuBtn) {
      await menuBtn.click();
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `768-menu-overlay-with-toggle.png`),
      });
      console.log('Captured 768px menu overlay with mobile window toggle.');

      // Close Menu
      const closeMenuBtn = await page.$('button[aria-label="Close Menu"]');
      if (closeMenuBtn) await closeMenuBtn.click();
      await new Promise(r => setTimeout(r, 400));
    }

    // Open SideSheet at 1440px
    console.log('Testing SideSheet at 1440px...');
    await page.setViewport({ width: 1440, height: 900 });
    const runScenarioBtnClicked = await clickButtonWithText(page, 'Run scenario');
    if (runScenarioBtnClicked) {
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `1440-sidesheet-open.png`),
      });
      console.log('Captured 1440px SideSheet open.');
    }

    console.log(`\nQA Walkthrough completed successfully.`);
    console.log(`Total console errors captured: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    }
  } catch (err) {
    console.error('QA script error:', err);
  } finally {
    await browser.close();
  }
}

runQA();
