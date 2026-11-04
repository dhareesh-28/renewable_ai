import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function findBorders() {
  const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_border_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: tempProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  const borders = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const results = [];
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const hasBorderL = parseFloat(style.borderLeftWidth) > 0 && style.borderLeftStyle !== 'none' && style.borderLeftColor !== 'transparent';
      const hasBorderR = parseFloat(style.borderRightWidth) > 0 && style.borderRightStyle !== 'none' && style.borderRightColor !== 'transparent';
      if (hasBorderL || hasBorderR) {
        if (rect.height > 60) {
          results.push({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            borderLeft: `${style.borderLeftWidth} ${style.borderLeftStyle} ${style.borderLeftColor}`,
            borderRight: `${style.borderRightWidth} ${style.borderRightStyle} ${style.borderRightColor}`,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          });
        }
      }
    }
    return results;
  });

  await browser.close();
  console.log('Tall elements with left/right borders:');
  console.log(JSON.stringify(borders, null, 2));
}

findBorders().catch(console.error);
