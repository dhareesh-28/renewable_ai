import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function debug() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('request', req => {
    if (req.url().includes('/api/')) console.log('API REQ:', req.url());
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) console.log('API RES:', res.status(), res.url());
  });

  await page.goto('http://127.0.0.1:5173/energy?start=2026-05-20+00%3A00%3A00&end=2026-05-26+23%3A00%3A00&strategy=optimised_lp');
  await new Promise(r => setTimeout(r, 6000));

  const text = await page.evaluate(() => document.body.innerText);
  console.log('Includes Multi-Carrier:', text.includes('Multi-Carrier Energy Balance'));
  await browser.close();
}

debug();
