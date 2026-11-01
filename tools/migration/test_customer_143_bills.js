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
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": name,
    "sv": sv, "plat": "false", "tid": tenantId.toString(), "tenant_id": tenantId.toString(),
    "tslug": slug, "nbf": now, "exp": now + (8 * 3600), "iat": now, "iss": "HexaBill.Api", "aud": "HexaBill.Api"
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${unsigned}.${sig}`;
}

async function testCustomer143Bills() {
  const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('[TEST] Navigating to Customer 143 Bills tab...');
  await page.goto('https://frozenhub.hexabill.company/ledger?customerId=143&tab=bills', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  const rows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.replace(/\n+/g, ' | ')));
  console.log(`[TEST] Found ${rows.length} rows in Bills table.`);
  rows.slice(0, 5).forEach((r, idx) => console.log(`  Row ${idx+1}: ${r}`));

  const text = await page.evaluate(() => document.body.innerText);
  console.log('[TEST] Contains 6989?', text.includes('6989'));
  console.log('[TEST] Contains 2898?', text.includes('2898'));
  console.log('[TEST] Contains "No invoices" or similar?', text.includes('No invoices') || text.includes('No bills') || text.includes('No sales'));

  await browser.close();
}

testCustomer143Bills().catch(console.error);

