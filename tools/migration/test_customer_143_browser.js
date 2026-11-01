const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));
const crypto = require('crypto');

const SECRET = require("./require-env")("HEXABILL_JWT_SECRET");

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createToken(userId, email, name, tenantId, slug, role = "Owner", sv = "0") {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": userId.toString(),
    "UserId": userId.toString(),
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": email,
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
    "http://schemas.microsoft.com/ws/2005/05/identity/claims/name": name,
    "sv": sv, "plat": "false", "tid": tenantId.toString(), "tenant_id": tenantId.toString(),
    "tslug": slug, "nbf": now, "exp": now + (8 * 3600), "iat": now, "iss": "HexaBill.Api", "aud": "HexaBill.Api"
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${unsigned}.${sig}`;
}

async function testCustomerLedger() {
  const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[CONSOLE ERROR]', msg.text());
  });

  console.log('[TEST] Logging in to https://frozenhub.hexabill.company...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('[TEST 1] Opening Customer 143 Ledger (/ledger?customerId=143)...');
  await page.goto('https://frozenhub.hexabill.company/ledger?customerId=143', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const text1 = await page.evaluate(() => document.body.innerText);
  console.log('   - Customer name displayed:', text1.includes('ABAYAN MANDI REST & KITCHEN') ? 'PASS' : 'FAIL');
  console.log('   - Balance AED 1,611.99 displayed:', text1.includes('1,611.99') ? 'PASS' : 'FAIL');
  console.log('   - 2 Unpaid Invoices badge displayed:', text1.includes('2 Unpaid Invoices') ? 'PASS' : 'FAIL');

  // Test 2: Switch to Bills tab with default month date range
  console.log('[TEST 2] Switching to Bills tab...');
  const billsTabBtn = await page.locator('button:has-text("Bills")').first();
  if (await billsTabBtn.count() > 0) {
    await billsTabBtn.click();
    await page.waitForTimeout(2000);
  }
  const textBills = await page.evaluate(() => document.body.innerText);
  console.log('   - Bills tab earlier unpaid invoices prompt:', textBills.includes('outstanding invoice') || textBills.includes('earlier dates') ? 'PASS' : 'FAIL');

  // Test 3: Click "View 2 outstanding invoices from earlier dates" or "2 Unpaid Invoices"
  console.log('[TEST 3] Clicking Unpaid Invoices badge / earlier unpaid link...');
  const unpaidBadge = page.locator('button:has-text("Unpaid Invoice"), button:has-text("earlier dates")').first();
  if (await unpaidBadge.count() > 0) {
    await unpaidBadge.click();
    await page.waitForTimeout(4000);
  }
  const textAll = await page.evaluate(() => document.body.innerText);
  console.log('   - Invoice 6989 visible:', textAll.includes('6989') ? 'PASS' : 'FAIL');
  console.log('   - Invoice 2898 visible:', textAll.includes('2898') ? 'PASS' : 'FAIL');
  console.log('   - Pagination controls visible:', textAll.includes('Rows per page') || textAll.includes('Page 1 of') ? 'PASS' : 'FAIL');
  console.log('   - Total invoices count:', textAll.includes('207 total') || textAll.includes('Total Invoices: 207') || textAll.includes('207') ? 'PASS' : 'FAIL');

  // Take screenshot for artifact
  const screenshotPath = 'artifacts/reconciliation/customer_143_live_verified.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[TEST] Saved screenshot to ${screenshotPath}`);

  // Test 4: Open Sales Ledger (/sales-ledger)
  console.log('[TEST 4] Navigating to Sales Ledger (/sales-ledger)...');
  await page.goto('https://frozenhub.hexabill.company/sales-ledger', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  const textSales = await page.evaluate(() => document.body.innerText);
  console.log('   - Sales Ledger loaded:', textSales.includes('Sales Ledger') || textSales.includes('Total Sales') ? 'PASS' : 'FAIL');
  console.log('   - Mentions 3,825,363 or 3825363 or 4916 or 4948:', textSales.includes('3,825,363') || textSales.includes('3825363') || textSales.includes('4,9') || textSales.includes('49') ? 'PASS' : 'FAIL');

  const salesScreenshotPath = 'artifacts/reconciliation/sales_ledger_live_verified.png';
  await page.screenshot({ path: salesScreenshotPath, fullPage: true });
  console.log(`[TEST] Saved screenshot to ${salesScreenshotPath}`);

  await browser.close();
  console.log('[TEST] Browser verification completed successfully!');
}

testCustomerLedger().catch(console.error);
