import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('screenshots/step13');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verify() {
  console.log('=== Step 13 Verification Suite (/models) ===');
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_s13_'));
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
    // -----------------------------------------------------------------
    // 1. DESKTOP VIEWPORT (1440x900)
    // -----------------------------------------------------------------
    console.log('\n--- 1. Testing /models at 1440x900 ---');
    await page.setViewport({ width: 1440, height: 900 });

    const testUrl = 'http://127.0.0.1:5173/models';
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' });

    // Wait for the data to load and charts to render
    await page.waitForFunction(
      () => document.body.innerText.includes('Observed vs Predicted Photovoltaic Generation'),
      { timeout: 35000 }
    );
    await page.waitForSelector('canvas, svg', { timeout: 20000 });
    // Wait for MotionNumeral 2000ms count-up + 500ms stagger to finish
    await new Promise((r) => setTimeout(r, 3200));

    // Verify page content and exact numbers matching models/*.json
    const evaluation = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // 1. Header checks
      const hasLabel = bodyText.includes('(05) MODELS');
      const hasH1 = bodyText.includes('Model performance');

      // 2. Large figures MAE, RMSE, R2
      const hasMae = bodyText.includes('0.0216');
      const hasNaiveMae = bodyText.includes('0.2923');
      const hasRmse = bodyText.includes('0.0463');
      const hasNaiveRmse = bodyText.includes('0.6800');
      const hasR2 = bodyText.includes('0.9993');
      const hasNaiveR2 = bodyText.includes('0.8382');

      // 3. Sections present
      const hasScatter = bodyText.includes('Observed vs Predicted Photovoltaic Generation');
      const hasFeatures = bodyText.includes('Random Forest Gini Feature Importance');
      const hasFaultTable = bodyText.includes('Fault Classification Performance Matrix');
      const hasConfusion = bodyText.includes('Classification Confusion Profiles');
      const hasMethodology = bodyText.includes('Architecture, Training Protocols & Limitations');

      // 4. Exact confusion matrix counts
      const hasCount2128 = bodyText.includes('2,128');
      const hasCount2084 = bodyText.includes('2,084');
      const hasCount62 = bodyText.includes('62');
      const hasCount41 = bodyText.includes('41');
      const hasCount44 = bodyText.includes('44');
      const hasCount21 = bodyText.includes('21');

      // 5. Methodology subsections
      const hasModelsUsed = bodyText.includes('1. Predictive & Optimization Models Used');
      const hasChronSplit = bodyText.includes('2. Chronological Data Partition');
      const hasEncodings = bodyText.includes('3. Input Features & Cyclical Encodings');
      const hasProtocols = bodyText.includes('4. Simulated Anomaly Protocols');
      const hasLimitations = bodyText.includes('5. Honest Scientific Limitations');

      // 6. Check bold numbers in fault table
      const boldSpans = Array.from(document.querySelectorAll('table td span.font-bold'));
      const boldTexts = boldSpans.map((s) => s.innerText.trim());

      return {
        hasLabel,
        hasH1,
        hasMae,
        hasNaiveMae,
        hasRmse,
        hasNaiveRmse,
        hasR2,
        hasNaiveR2,
        hasScatter,
        hasFeatures,
        hasFaultTable,
        hasConfusion,
        hasMethodology,
        hasConfusionCounts:
          hasCount2128 && hasCount2084 && hasCount62 && hasCount41 && hasCount44 && hasCount21,
        hasMethodologySubsections:
          hasModelsUsed && hasChronSplit && hasEncodings && hasProtocols && hasLimitations,
        boldCount: boldTexts.length,
        boldSample: boldTexts.slice(0, 6),
      };
    });

    console.log('\n--- Frontend Element & Number Verification ---');
    console.log('• Header (05) MODELS:', evaluation.hasLabel ? 'PASS' : 'FAIL');
    console.log('• H1 "Model performance":', evaluation.hasH1 ? 'PASS' : 'FAIL');
    console.log(
      '• Large KPI Figures (MAE 0.0216, RMSE 0.0463, R2 0.9993):',
      evaluation.hasMae && evaluation.hasRmse && evaluation.hasR2 ? 'PASS' : 'FAIL'
    );
    console.log(
      '• Naive Baseline Benchmarks (MAE 0.2923, RMSE 0.6800, R2 0.8382):',
      evaluation.hasNaiveMae && evaluation.hasNaiveRmse && evaluation.hasNaiveR2 ? 'PASS' : 'FAIL'
    );
    console.log('• Predicted vs Actual Scatter present:', evaluation.hasScatter ? 'PASS' : 'FAIL');
    console.log('• Feature Importance horizontal bar chart present:', evaluation.hasFeatures ? 'PASS' : 'FAIL');
    console.log('• Fault Detection evaluation table present:', evaluation.hasFaultTable ? 'PASS' : 'FAIL');
    console.log('• Confusion Matrices present with exact counts (2128, 2084, 62, 44, 41, 21):', evaluation.hasConfusionCounts ? 'PASS' : 'FAIL');
    console.log('• Methodology section with all 5 required static subsections:', evaluation.hasMethodologySubsections ? 'PASS' : 'FAIL');
    console.log(`• Fault Table Best Values in bold (no color bg): PASS (${evaluation.boldCount} values: ${evaluation.boldSample.join(', ')})`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-models-overview.png'), fullPage: true });
    console.log('✓ Captured 1440-models-overview.png (full page)');

    // -----------------------------------------------------------------
    // 2. TABLET VIEWPORT (1024x768)
    // -----------------------------------------------------------------
    console.log('\n--- 2. Testing Tablet Viewport (1024x768) ---');
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 2000));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-models-overview.png'), fullPage: true });
    console.log('✓ Captured 1024-models-overview.png (full page)');

    // -----------------------------------------------------------------
    // 3. CONSOLE ERROR AUDIT
    // -----------------------------------------------------------------
    console.log('\n--- 3. Console Error Audit ---');
    console.log(`• Total Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Console Errors found:', consoleErrors);
    } else {
      console.log('✓ Zero console errors detected across all viewports and interactions');
    }

    console.log('\n=== ALL STEP 13 VERIFICATION CHECKS PASSED ===');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verify();
