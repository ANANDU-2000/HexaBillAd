const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));
const crypto = require('crypto');

const SECRET = require("./require-env")("HEXABILL_JWT_SECRET");
function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function createToken(userId, email, name, tenantId, slug, role = 'Owner', sv = '0') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': userId.toString(),
    'UserId': userId.toString(),
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': email,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': name,
    'sv': sv, 'plat': 'false', 'tid': tenantId.toString(), 'tenant_id': tenantId.toString(),
    'tslug': slug, 'nbf': now, 'exp': now + (8 * 3600), 'iat': now, 'iss': 'HexaBill.Api', 'aud': 'HexaBill.Api'
  };
  const unsigned = base64UrlEncode(JSON.stringify(header)) + '.' + base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return unsigned + '.' + sig;
}

async function testAllCustomersBrowser() {
  const token = createToken(34, 'frozenhubfoods@gmail.com', 'Vahid Shamsudheen', 20, 'frozenhub', 'Owner', '0');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[BROWSER CONSOLE ERROR]:', msg.text());
  });
  page.on('pageerror', err => console.log('[PAGE UNCAUGHT ERROR]:', err.toString()));

  console.log('1. Authenticating...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Test Customer 134 Ledger
  console.log('\n2. Testing Customer 134 (DAR AL MANDI)...');
  await page.goto('https://frozenhub.hexabill.company/ledger?from=2025-01-01&to=2026-11-01&tab=invoices&customerId=134', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const cust134Name = await page.$eval('h1, h2, [aria-label="Customer Name"]', el => el.innerText).catch(() => 'NOT FOUND');
  console.log('Customer 134 header:', cust134Name);

  const cust134Invoices = await page.$$eval('table tbody tr', trs => trs.length).catch(() => 0);
  console.log('Customer 134 Invoices row count in table:', cust134Invoices);

  const cust134Balance = await page.$eval('text=AED', el => el.innerText).catch(() => 'NOT FOUND');
  console.log('Customer 134 Balance on page:', cust134Balance);

  await page.screenshot({ path: 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_customer_134_ledger.png' });

  // Test Customer 135 Ledger
  console.log('\n3. Testing Customer 135 (DALLAS)...');
  await page.goto('https://frozenhub.hexabill.company/ledger?from=2025-01-01&to=2026-11-01&tab=invoices&customerId=135', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const cust135Invoices = await page.$$eval('table tbody tr', trs => trs.length).catch(() => 0);
  console.log('Customer 135 Invoices row count in table:', cust135Invoices);
  await page.screenshot({ path: 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_customer_135_ledger.png' });

  // Test Billing History All Tab
  console.log('\n4. Testing Billing History tab=all...');
  await page.goto('https://frozenhub.hexabill.company/billing-history?tab=all', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const billingAllRows = await page.$$eval('table tbody tr', trs => trs.length).catch(() => 0);
  console.log('Billing History tab=all row count:', billingAllRows);
  const topRowText = await page.$eval('table tbody tr:first-child', el => el.innerText.replace(/\n+/g, ' | ')).catch(() => 'NO ROWS');
  console.log('Billing History top row:', topRowText);
  await page.screenshot({ path: 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_billing_history_all.png' });

  await browser.close();
  console.log('\nAll browser checks complete!');
}

testAllCustomersBrowser().catch(console.error);

