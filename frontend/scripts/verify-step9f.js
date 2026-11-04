import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('screenshots/step9f');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Relative luminance formula per WCAG 2.1
function getLuminance(r, g, b) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrast(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function verify() {
  console.log('=== Step 9-F Verification Suite ===');
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_9f_'));
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
    // 1. Viewport 1440x900 Tests & Section Captures
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing at 1440x900 ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1400)); // Allow initial mount & hero load

    // 1A. Hero Screenshot & Pixel Contrast Check
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-hero.png') });
    console.log('✓ Captured 1440-hero.png');

    const contrastAudit = await page.evaluate(() => {
      // Create offscreen canvas to sample pixels
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');

      // Sample elements
      const wordmarkEl = document.querySelector('#hero h1, #hero span');
      const taglineEl = document.querySelector('#hero h2');
      const navWordmark = document.querySelector('header a');

      return {
        wordmarkRect: wordmarkEl ? wordmarkEl.getBoundingClientRect() : null,
        taglineRect: taglineEl ? taglineEl.getBoundingClientRect() : null,
        navRect: navWordmark ? navWordmark.getBoundingClientRect() : null,
      };
    });

    // Sample pixels from screenshot directly
    const heroImgBuffer = fs.readFileSync(path.join(SCREENSHOT_DIR, '1440-hero.png'));
    const contrastData = await page.evaluate(async (bufferB64) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);

          function sampleArea(x, y, w, h) {
            const data = ctx.getImageData(x, y, w, h).data;
            let totalR = 0, totalG = 0, totalB = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) {
              totalR += data[i];
              totalG += data[i + 1];
              totalB += data[i + 2];
              count++;
            }
            return {
              r: Math.round(totalR / count),
              g: Math.round(totalG / count),
              b: Math.round(totalB / count),
            };
          }

          // Sample bottom-left (wordmark area: x=80, y=750)
          const bottomArea = sampleArea(80, 750, 200, 60);
          // Sample bottom-right (tagline area: x=1100, y=750)
          const taglineArea = sampleArea(1100, 750, 150, 50);
          // Sample top Nav area (x=80, y=30)
          const navArea = sampleArea(80, 30, 150, 30);

          resolve({ bottomArea, taglineArea, navArea });
        };
        img.src = 'data:image/png;base64,' + bufferB64;
      });
    }, heroImgBuffer.toString('base64'));

    const lWhite = getLuminance(255, 255, 255);
    const lWordmarkBg = getLuminance(contrastData.bottomArea.r, contrastData.bottomArea.g, contrastData.bottomArea.b);
    const lTaglineBg = getLuminance(contrastData.taglineArea.r, contrastData.taglineArea.g, contrastData.taglineArea.b);
    const lNavBg = getLuminance(contrastData.navArea.r, contrastData.navArea.g, contrastData.navArea.b);

    const wordmarkContrast = getContrast(lWhite, lWordmarkBg);
    const taglineContrast = getContrast(lWhite, lTaglineBg);
    const navContrast = getContrast(lWhite, lNavBg);

    console.log(`\n--- Real Pixel Contrast Audit (WCAG AA threshold: 4.5:1) ---`);
    console.log(`• Hero Wordmark area pixel RGB: (${contrastData.bottomArea.r}, ${contrastData.bottomArea.g}, ${contrastData.bottomArea.b}) -> Contrast Ratio: ${wordmarkContrast.toFixed(2)}:1 (Pass: ${wordmarkContrast >= 4.5})`);
    console.log(`• Hero Tagline area pixel RGB: (${contrastData.taglineArea.r}, ${contrastData.taglineArea.g}, ${contrastData.taglineArea.b}) -> Contrast Ratio: ${taglineContrast.toFixed(2)}:1 (Pass: ${taglineContrast >= 4.5})`);
    console.log(`• Nav Header area pixel RGB: (${contrastData.navArea.r}, ${contrastData.navArea.g}, ${contrastData.navArea.b}) -> Contrast Ratio: ${navContrast.toFixed(2)}:1 (Pass: ${navContrast >= 4.5})`);

    // 1B. Stepped Slow Scroll in ~15% Viewport Steps (135px steps) to confirm headings
    console.log('\n--- Scrolling in ~15% Viewport Steps & Auditing Headings ---');
    const scrollStep = 135;
    const maxScroll = 6000;
    for (let pos = 0; pos <= maxScroll; pos += scrollStep) {
      await page.evaluate((y) => window.scrollTo(0, y), pos);
      await new Promise((r) => setTimeout(r, 60)); // slow scroll step
    }

    // Capture every section at 1440px
    await page.evaluate(() => window.scrollTo(0, 1100));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-numbers.png') });
    console.log('✓ Captured 1440-numbers.png');

    await page.evaluate(() => window.scrollTo(0, 2200));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-showcase.png') });
    console.log('✓ Captured 1440-showcase.png');

    await page.evaluate(() => window.scrollTo(0, 3300));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-store.png') });
    console.log('✓ Captured 1440-store.png');

    await page.evaluate(() => window.scrollTo(0, 4300));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-optimise.png') });
    console.log('✓ Captured 1440-optimise.png');

    await page.evaluate(() => window.scrollTo(0, 5200));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-principles.png') });
    console.log('✓ Captured 1440-principles.png');

    await page.evaluate(() => window.scrollTo(0, 6000));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-footer.png') });
    console.log('✓ Captured 1440-footer.png');

    // -------------------------------------------------------------
    // 2. Viewport 1024x768 Tests & Section Captures
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing at 1024x768 ---');
    await page.setViewport({ width: 1024, height: 768 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 800));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-hero.png') });
    console.log('✓ Captured 1024-hero.png');

    await page.evaluate(() => window.scrollTo(0, 950));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-numbers.png') });
    console.log('✓ Captured 1024-numbers.png');

    await page.evaluate(() => window.scrollTo(0, 1950));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-showcase.png') });
    console.log('✓ Captured 1024-showcase.png');

    await page.evaluate(() => window.scrollTo(0, 2900));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-store.png') });
    console.log('✓ Captured 1024-store.png');

    await page.evaluate(() => window.scrollTo(0, 3900));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-optimise.png') });
    console.log('✓ Captured 1024-optimise.png');

    await page.evaluate(() => window.scrollTo(0, 4800));
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-principles.png') });
    console.log('✓ Captured 1024-principles.png');

    // -------------------------------------------------------------
    // 3. Heading Visibility Check in DOM
    // -------------------------------------------------------------
    const headingsStatus = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
      return headings.map((h) => ({
        tag: h.tagName,
        text: h.textContent?.trim().slice(0, 50),
        rect: {
          width: h.getBoundingClientRect().width,
          height: h.getBoundingClientRect().height,
          top: h.getBoundingClientRect().top,
        },
        computedOpacity: window.getComputedStyle(h).opacity,
        visibility: window.getComputedStyle(h).visibility,
      }));
    });

    console.log('\n--- Headings Visibility Status ---');
    headingsStatus.forEach((h) => {
      console.log(`• <${h.tag}> "${h.text}": opacity=${h.computedOpacity}, size=${Math.round(h.rect.width)}x${Math.round(h.rect.height)}`);
    });

    // -------------------------------------------------------------
    // 4. Console Cleanliness Check
    // -------------------------------------------------------------
    console.log('\n--- Console Errors Check ---');
    console.log('Console Errors Total:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.error('Errors found:', consoleErrors);
    } else {
      console.log('CONFIRMED: Clean browser console with 0 errors.');
    }

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await browser.close();
    console.log('\nVerification run finished.');
  }
}

verify().catch(console.error);

