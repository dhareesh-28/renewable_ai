import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('screenshots/step14');

async function testRecovery() {
  console.log('=== Testing Backend Error Handling & Live Recovery ===');
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_recovery_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: tempProfile,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Initial healthy load
  console.log('Navigating to http://127.0.0.1:5173/forecast...');
  await page.goto('http://127.0.0.1:5173/forecast', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  console.log('Intercepting backend requests to simulate server outage...');
  // Enable request interception to simulate backend offline
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes(':8000/api/')) {
      req.abort('failed');
    } else {
      req.continue();
    }
  });

  // Navigate to /cost while backend requests fail
  console.log('Navigating to /cost while API is down...');
  await page.goto('http://127.0.0.1:5173/cost', { waitUntil: 'domcontentloaded' });
  // Wait 6.5s for TanStack Query exponential retry backoff to conclude
  await new Promise(r => setTimeout(r, 6500));

  // Verify ErrorState is present
  const errorTitle = await page.$eval('h3', el => el.innerText).catch(() => null);
  console.log('Observed Error State Title:', errorTitle);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'error-state-backend-offline.png'),
  });
  console.log('Captured error-state-backend-offline.png');

  // Disable network failure simulation (simulating backend reboot)
  console.log('Restoring backend connectivity...');
  await page.setRequestInterception(false);

  // Click retry button on the ErrorState
  console.log('Clicking Retry button...');
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.innerText, b);
    if (text && text.includes('Retry')) {
      await b.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 2500));

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'error-state-recovered.png'),
  });
  console.log('Captured error-state-recovered.png without page reload!');

  await browser.close();
}

testRecovery().catch(console.error);
