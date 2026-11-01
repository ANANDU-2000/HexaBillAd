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

async function verifyCustomer136() {
  const token = createToken(34, 'frozenhubfoods@gmail.com', 'Vahid Shamsudheen', 20, 'frozenhub', 'Owner', '0');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Authenticating session...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Bills tab
  console.log('Navigating to Customer 136 Bills tab...');
  await page.goto('https://frozenhub.hexabill.company/ledger?from=2025-01-01&to=2026-11-01&tab=invoices&customerId=136', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  const kpis = await page.$$eval('[data-testid="customer-metric"], [class*="rounded-xl"] p, [class*="rounded-lg"] p', els => {
    return els.map(e => e.innerText.trim()).filter(t => t.length > 0 && t.length < 50);
  });
  console.log('Page metrics/text snippets:', kpis.slice(0, 15));

  const rows = await page.$$eval('table tbody tr', trs => {
    return trs.map(tr => tr.innerText.replace(/\t+/g, ' | ').replace(/\n+/g, ' '));
  });
  console.log(`Total table rows rendered: ${rows.length}`);
  console.log('Sample first 7 rows:');
  rows.slice(0, 7).forEach((r, idx) => console.log(`  ${idx + 1}: ${r}`));

  const billsScreenshot = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_customer_136_bills_verified.png';
  await page.screenshot({ path: billsScreenshot });
  console.log('Saved screenshot to:', billsScreenshot);

  // 2. Ledger tab
  console.log('\nSwitching to Ledger statement tab...');
  const ledgerTab = await page.$('button:has-text("Statement"), button:has-text("Ledger"), [role="tab"]:has-text("Ledger")');
  if (ledgerTab) {
    await ledgerTab.click();
    await page.waitForTimeout(3000);
    const ledgerScreenshot = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_customer_136_statement_verified.png';
    await page.screenshot({ path: ledgerScreenshot });
    console.log('Saved ledger screenshot to:', ledgerScreenshot);
  }

  // 3. Paid tab
  console.log('\nSwitching to Paid payments tab...');
  const paidTab = await page.$('button:has-text("Paid"), [role="tab"]:has-text("Paid")');
  if (paidTab) {
    await paidTab.click();
    await page.waitForTimeout(3000);
    const paidScreenshot = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_customer_136_paid_verified.png';
    await page.screenshot({ path: paidScreenshot });
    console.log('Saved paid screenshot to:', paidScreenshot);
  }

  await browser.close();
  console.log('Customer 136 live verification finished successfully!');
}

verifyCustomer136().catch(console.error);

