import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = path.resolve('public/images');

async function convert(filename, outname) {
  const inPath = path.join(base, filename);
  const outPath = path.join(base, outname);
  if (!fs.existsSync(inPath)) {
    console.error(`Not found: ${inPath}`);
    return;
  }
  const data = fs.readFileSync(inPath);
  const base64 = data.toString('base64');
  const mime = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const dataUri = `data:${mime};base64,${base64}`;

  const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_convert_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: tempProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const webpBase64 = await page.evaluate(async (uri) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const webpUri = canvas.toDataURL('image/webp', 0.88);
        resolve(webpUri.split(',')[1]);
      };
      img.onerror = reject;
      img.src = uri;
    });
  }, dataUri);

  await browser.close();
  fs.writeFileSync(outPath, Buffer.from(webpBase64, 'base64'));
  console.log(`Successfully converted ${filename} -> ${outname} (${fs.statSync(outPath).size} bytes)`);
}

async function main() {
  await convert('hero.jpg', 'hero.webp');
  await convert('principles.jpeg', 'principles.webp');
}

main().catch(console.error);

