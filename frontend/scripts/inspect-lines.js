import fs from 'fs';
import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const imgPath = 'C:\\Users\\dhare\\.gemini\\antigravity\\brain\\7e6f0ddb-2d6b-4841-a421-294180c510fd\\.user_uploaded\\media_1793713611984_67f864f8.jpg';

async function inspectImage() {
  const data = fs.readFileSync(imgPath).toString('base64');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const info = await page.evaluate(async (b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Sample vertical line around x = 50..150 at y = 300
        const sampleY = 300;
        const scan = [];
        for (let x = 40; x < 200; x++) {
          const pixel = ctx.getImageData(x, sampleY, 1, 1).data;
          scan.push({ x, r: pixel[0], g: pixel[1], b: pixel[2] });
        }
        resolve({ width: img.width, height: img.height, scan });
      };
      img.src = 'data:image/jpeg;base64,' + b64;
    });
  }, data);

  await browser.close();
  console.log('Image dimensions:', info.width, info.height);
  const diffs = info.scan.filter((p, i) => {
    if (i === 0) return false;
    const prev = info.scan[i - 1];
    return Math.abs(p.r - prev.r) > 10 || Math.abs(p.g - prev.g) > 10;
  });
  console.log('Detected edges at:', diffs);
}

inspectImage().catch(console.error);

