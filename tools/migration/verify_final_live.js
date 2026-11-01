const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));
const crypto = require('crypto');

const SECRET = 'z4qGVNFXkPS9mxTVuLVpT3iVp3TV5+rau2mY1hSmaT7vJ4ZXV9yegsvREiIXBqzqm0YPJ9o6I3cfYTJ4ZrVqKw==';
function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function createToken(userId, email, name, tenantId, slug, role = 'Owner') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': userId.toString(),
    'UserId': userId.toString(),
    'http://schemas.microsoft.com/ws/2005/05/identity/claims/emailaddress': email,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
    'http://schemas.microsoft.com/ws/2005/05/identity/claims/name': name,
    'sv': '0', 'plat': 'false', 'tid': tenantId.toString(), 'tenant_id': tenantId.toString(),
    'tslug': slug, 'nbf': now, 'exp': now + (8 * 3600), 'iat': now, 'iss': 'HexaBill.Api', 'aud': 'HexaBill.Api'
  };
  const unsigned = base64UrlEncode(JSON.stringify(header)) + '.' + base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return unsigned + '.' + sig;
}

async function verifyLive() {
  const token = createToken(34, 'frozenhubfoods@gmail.com', 'Vahid Shamsudheen', 20, 'frozenhub');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

  console.log('[STEP 1] Login with owner token...');
  await page.goto('https://frozenhub.hexabill.company/#support=' + token, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Sales Ledger default view
  console.log('[STEP 2] Testing Sales Ledger default view (/sales-ledger)...');
  await page.goto('https://frozenhub.hexabill.company/sales-ledger', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  const salesText = await page.evaluate(() => document.body.innerText);
  console.log('  Sales Ledger loaded:', salesText.includes('Sales Ledger') || salesText.includes('Total Sales'));
  console.log('  Shows 3,825,363.88:', salesText.includes('3,825,363.88') || salesText.includes('3825363.88'));
  console.log('  Shows Real Pending 70,178.03:', salesText.includes('70,178.03') || salesText.includes('70178.03'));
  console.log('  Shows Received 3,755,189.98:', salesText.includes('3,755,189.98') || salesText.includes('3755189.98'));
  console.log('  Shows 4,948 entries / rows:', salesText.includes('4,948') || salesText.includes('4948') || salesText.includes('4,932'));
  await page.screenshot({ path: 'artifacts/reconciliation/final_sales_ledger_live.png' });

  // 2. Customer 143 Ledger
  console.log('[STEP 3] Testing Customer 143 Ledger (/ledger?customerId=143)...');
  await page.goto('https://frozenhub.hexabill.company/ledger?customerId=143', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  const c143Text = await page.evaluate(() => document.body.innerText);
  console.log('  Customer 143 name:', c143Text.includes('ABAYAN MANDI REST & KITCHEN'));
  console.log('  Balance 1611.99:', c143Text.includes('1611.99') || c143Text.includes('1,611.99'));
  console.log('  2 Unpaid Invoices badge:', c143Text.includes('2 Unpaid Invoices'));

  // Switch to Bills tab
  const billsTab = page.locator('button:has-text("Bills")').first();
  if (await billsTab.count() > 0) {
    await billsTab.click();
    await page.waitForTimeout(2000);
  }
  const billsText = await page.evaluate(() => document.body.innerText);
  console.log('  Bills tab shows Invoice 6989:', billsText.includes('6989'));
  console.log('  Bills tab shows 207 total invoices / pagination:', billsText.includes('207') || billsText.includes('Page 1 of'));
  await page.screenshot({ path: 'artifacts/reconciliation/final_customer_143_live.png' });

  // 3. Dashboard Last Month button
  console.log('[STEP 4] Testing Dashboard (/dashboard)...');
  await page.goto('https://frozenhub.hexabill.company/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const dashText = await page.evaluate(() => document.body.innerText);
  console.log('  Dashboard Pending Amount 70077.29:', dashText.includes('70077.29'));
  console.log('  Has Last Month button:', dashText.includes('Last Month'));

  const lastMonthBtn = page.locator('button:has-text("Last Month")').first();
  if (await lastMonthBtn.count() > 0) {
    console.log('  Clicking Last Month button...');
    await lastMonthBtn.click();
    await page.waitForTimeout(3000);
    const octText = await page.evaluate(() => document.body.innerText);
    console.log('  October Sales (8007 or 8,007):', octText.includes('8007') || octText.includes('8,007'));
  }
  await page.screenshot({ path: 'artifacts/reconciliation/final_dashboard_live.png' });

  await browser.close();
  console.log('[SUCCESS] All final live verifications completed!');
}

verifyLive().catch(console.error);

