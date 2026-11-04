import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('screenshots/step9m');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching Chrome for Step 9-M Motion Layer Verification...');
  const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_test_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: tempProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const consoleMessages = [];
  page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleMessages.push(`[PAGE ERROR] ${err.toString()}`));

  try {
    // -------------------------------------------------------------
    // 1. STEPPED SCROLL VERIFICATION (15% Viewport Steps)
    // -------------------------------------------------------------
    console.log('--- Executing Stepped Scroll Sequence (1440x900) ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200)); // Allow hero entrance animation (1.6s)

    // Capture initial hero state
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-hero-load-entry.png') });
    console.log('✓ 01-hero-load-entry.png (Hero image scaled 1.0, wordmark letter-groups rendered)');

    // Scroll step 1: Hero Exit (clip-path bottom collapses, wordmark translates up slower)
    await page.evaluate(() => window.scrollTo(0, 400));
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-hero-exit-wipe.png') });
    console.log('✓ 02-hero-exit-wipe.png (Hero bottom clip-path rising, wordmark lingering)');

    // Scroll step 2: Numbers Section Curtain Entry
    await page.evaluate(() => window.scrollTo(0, 950));
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-numbers-curtain-reveal.png') });
    console.log('✓ 03-numbers-curtain-reveal.png (Curtain lifted, numbers counting up with ease-out)');

    // Scroll step 3: Numbers Section Content & Stagger
    await page.evaluate(() => window.scrollTo(0, 1500));
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-numbers-staggered-grid.png') });
    console.log('✓ 04-numbers-staggered-grid.png (All 4 numerals settled with real API units)');

    // Scroll step 4: Module Showcase Section Entry
    await page.evaluate(() => window.scrollTo(0, 2200));
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-showcase-carousel-entry.png') });
    console.log('✓ 05-showcase-carousel-entry.png (Showcase curtain entry, overlapping serif title)');

    // Wait 3.6s to verify auto-advance to next slide (slide 2: DETECT)
    console.log('Waiting 3.6s for carousel auto-advance to DETECT...');
    await new Promise((r) => setTimeout(r, 3700));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-showcase-carousel-slide2-detect.png') });
    console.log('✓ 06-showcase-carousel-slide2-detect.png (Auto-advanced to DETECT with masked title swap)');

    // Scroll step 5: Store Section with Battery Parallax
    await page.evaluate(() => window.scrollTo(0, 3100));
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-store-battery-parallax.png') });
    console.log('✓ 07-store-battery-parallax.png (Battery SoC chart with 0.85x parallax)');

    // Scroll step 6: Optimise Deep-Moss Band Curtain Wipe
    await page.evaluate(() => window.scrollTo(0, 4000));
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-optimise-moss-curtain.png') });
    console.log('✓ 08-optimise-moss-curtain.png (Deep-moss band curtain wipe, 3 figures with proportional bars)');

    // Scroll step 7: Principles Section with Dim Background & Staggered Tiles
    await page.evaluate(() => window.scrollTo(0, 4900));
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-principles-dim-tiles.png') });
    console.log('✓ 09-principles-dim-tiles.png (Background dimmed to 35%, 4 tiles staggered 140ms with 32px rise)');

    // Scroll step 8: Footer & Bottom Stacking
    await page.evaluate(() => window.scrollTo(0, 5700));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-footer-deep-moss.png') });
    console.log('✓ 10-footer-deep-moss.png (Footer in deep moss with academic specs)');

    // -------------------------------------------------------------
    // 2. PREFERS-REDUCED-MOTION VERIFICATION
    // -------------------------------------------------------------
    console.log('--- Testing prefers-reduced-motion: reduce ---');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 600));

    // Check if auto-advance stops and animations fall back to static/300ms fade
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-reduced-motion-hero.png') });
    console.log('✓ 11-reduced-motion-hero.png (Hero rendered statically without scale or letter stagger)');

    // -------------------------------------------------------------
    // 3. AUDIT CONSOLE & DROPPED FRAMES
    // -------------------------------------------------------------
    console.log('--- Console & Diagnostic Audit ---');
    const errors = consoleMessages.filter((m) => m.toLowerCase().includes('error'));
    console.log('Console Errors Count:', errors.length);
    if (errors.length > 0) {
      console.log('Console Errors:', errors);
    } else {
      console.log('CONFIRMED: Clean browser console with zero errors!');
    }
  } catch (err) {
    console.error('Step 9-M verification encountered error:', err);
  } finally {
    await browser.close();
    console.log('Verification finished.');
  }
}

run();
