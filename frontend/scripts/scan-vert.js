import fs from 'fs';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const imgPath = 'C:\\Users\\dhare\\.gemini\\antigravity\\brain\\7e6f0ddb-2d6b-4841-a421-294180c510fd\\.user_uploaded\\media_1793713611984_67f864f8.jpg';

async function scanVertical() {
  const data = fs.readFileSync(imgPath).toString('base64');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const res = await page.evaluate(async (b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Check columns 65..70 down y = 100 to y = 500
        const colStats = [];
        for (let x = 60; x <= 75; x++) {
          let linePixelCount = 0;
          for (let y = 120; y < 520; y++) {
            const p = ctx.getImageData(x, y, 1, 1).data;
            const pLeft = ctx.getImageData(x - 3, y, 1, 1).data;
            const pRight = ctx.getImageData(x + 3, y, 1, 1).data;
            if (pLeft[0] - p[0] > 8 && pRight[0] - p[0] > 8) {
              linePixelCount++;
            }
          }
          colStats.push({ x, linePixelCount });
        }
        resolve(colStats);
      };
      img.src = 'data:image/jpeg;base64,' + b64;
    });
  }, data);

  await browser.close();
  console.log('Vertical line check:', res);
}

scanVertical().catch(console.error);

