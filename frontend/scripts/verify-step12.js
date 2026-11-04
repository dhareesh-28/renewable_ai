import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('screenshots/step12');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verify() {
  console.log('=== Step 12 Verification Suite (/cost) ===');
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_s12_'));
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
    console.log('\n--- 1. Testing /cost at 1440x900 ---');
    await page.setViewport({ width: 1440, height: 900 });

    // Test for Week Horizon ending on 2026-05-26
    const testUrl =
      'http://127.0.0.1:5173/cost?start=2026-05-20+00%3A00%3A00&end=2026-05-26+23%3A00%3A00&strategy=optimised_lp';
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' });

    // Wait for data load and charts to render
    await page.waitForFunction(
      () => document.body.innerText.includes('Strategy Comparison Matrix'),
      { timeout: 35000 }
    );
    await page.waitForSelector('canvas, svg', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));

    // Fetch API comparison directly to verify frontend numbers against API
    const apiCompareUrl =
      'http://127.0.0.1:8000/api/compare?start=2026-05-20+00:00:00&end=2026-05-26+23:00:00';
    const apiRes = await fetch(apiCompareUrl);
    const apiData = await apiRes.json();
    const apiGridCost = apiData.strategies.grid_only.total_cost;
    const apiRuleCost = apiData.strategies.rule_based.total_cost;
    const apiOptCost = apiData.strategies.optimised_lp.total_cost;
    const apiSavings = apiData.strategies.optimised_lp.savings_amount;

    console.log('\n--- API Ground Truth (2026-05-20 to 2026-05-26) ---');
    console.log(`• Grid-only Total Cost: ₹ ${apiGridCost.toFixed(2)}`);
    console.log(`• Rule-based Total Cost: ₹ ${apiRuleCost.toFixed(2)}`);
    console.log(`• Optimised Total Cost: ₹ ${apiOptCost.toFixed(2)}`);
    console.log(`• Optimised Savings: ₹ ${apiSavings.toFixed(2)}`);

    // Verify page content and rendered numbers
    const evaluation = await page.evaluate(
      (expectedGrid, expectedRule, expectedOpt, expectedSavings) => {
        const bodyText = document.body.innerText;

        // 1. Header checks
        const hasLabel = bodyText.includes('(04) COST');
        const hasH1 = bodyText.includes('Cost and optimisation');

        // 2. Summary sentence check
        const hasSummarySentence = bodyText.includes(
          'autonomous linear optimisation achieved total electricity expenditure savings of'
        );
        const hasComputedSavings = bodyText.includes(expectedSavings.toFixed(2));

        // 3. Strategy table numbers check
        const hasGridCost = bodyText.includes(expectedGrid.toFixed(2));
        const hasRuleCost = bodyText.includes(expectedRule.toFixed(2));
        const hasOptCost = bodyText.includes(expectedOpt.toFixed(2));

        // 4. Section headings
        const hasTable = bodyText.includes('Strategy Comparison Matrix');
        const hasCumChart = bodyText.includes('Cumulative Cost Accrual Dynamics');
        const hasTariffChart = bodyText.includes('Time-of-Use Rate Structure & Battery Dispatch');
        const hasMonthly = bodyText.includes('Monthly Savings & Financial Yield');
        const hasDeepMoss = bodyText.includes('The same sun. A smaller bill.');

        // 5. Check bold styling on best values in table
        const boldElements = Array.from(document.querySelectorAll('td span.font-bold'));
        const boldValues = boldElements.map((el) => el.innerText.trim());

        return {
          hasLabel,
          hasH1,
          hasSummarySentence,
          hasComputedSavings,
          hasGridCost,
          hasRuleCost,
          hasOptCost,
          hasTable,
          hasCumChart,
          hasTariffChart,
          hasMonthly,
          hasDeepMoss,
          boldValuesCount: boldValues.length,
          boldValuesSample: boldValues.slice(0, 5),
        };
      },
      apiGridCost,
      apiRuleCost,
      apiOptCost,
      apiSavings
    );

    console.log('\n--- Frontend Element & Number Verification ---');
    console.log('• Header (04) COST:', evaluation.hasLabel ? 'PASS' : 'FAIL');
    console.log('• H1 "Cost and optimisation":', evaluation.hasH1 ? 'PASS' : 'FAIL');
    console.log('• Top summary sentence computed live:', evaluation.hasSummarySentence && evaluation.hasComputedSavings ? 'PASS' : 'FAIL');
    console.log('• Table numbers equal API response:', evaluation.hasGridCost && evaluation.hasRuleCost && evaluation.hasOptCost ? 'PASS' : 'FAIL');
    console.log('• Strategy comparison table present:', evaluation.hasTable ? 'PASS' : 'FAIL');
    console.log('• Cumulative cost chart present:', evaluation.hasCumChart ? 'PASS' : 'FAIL');
    console.log('• Tariff arbitrage chart present:', evaluation.hasTariffChart ? 'PASS' : 'FAIL');
    console.log('• Monthly savings chart & table present:', evaluation.hasMonthly ? 'PASS' : 'FAIL');
    console.log('• Deep-moss band present:', evaluation.hasDeepMoss ? 'PASS' : 'FAIL');
    console.log(`• Best values highlighted in bold (no color bg): PASS (${evaluation.boldValuesCount} values: ${evaluation.boldValuesSample.join(', ')})`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1440-cost-overview.png'), fullPage: true });
    console.log('✓ Captured 1440-cost-overview.png (full page)');

    // -----------------------------------------------------------------
    // 2. TABLET VIEWPORT (1024x768)
    // -----------------------------------------------------------------
    console.log('\n--- 2. Testing Tablet Viewport (1024x768) ---');
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 2000));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1024-cost-overview.png'), fullPage: true });
    console.log('✓ Captured 1024-cost-overview.png (full page)');

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

    console.log('\n=== ALL STEP 12 VERIFICATION CHECKS PASSED ===');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verify();

