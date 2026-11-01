const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));
const crypto = require('crypto');

const SECRET = require("./require-env")("HEXABILL_JWT_SECRET");
function base64UrlEncode(str) { return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function createToken(userId, email, name, tenantId, slug, role = 'Owner') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': userId.toString(),
    'UserId': userId.toString(),
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': email,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': name,
    'sv': '0', 'plat': 'false', 'tid': tenantId.toString(), 'tenant_id': tenantId.toString(),
    'tslug': slug, 'nbf': now, 'exp': now + 28800, 'iat': now, 'iss': 'HexaBill.Api', 'aud': 'HexaBill.Api'
  };
  const unsigned = base64UrlEncode(JSON.stringify(header)) + '.' + base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return unsigned + '.' + sig;
}

async function testOutstanding() {
  const token = createToken(34, 'frozenhubfoods@gmail.com', 'Vahid Shamsudheen', 20, 'frozenhub');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://frozenhub.hexabill.company/#support=' + token, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  console.log('Navigating to /reports?tab=outstanding...');
  await page.goto('https://frozenhub.hexabill.company/reports?tab=outstanding', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  const text = await page.innerText('body');
  console.log('Contains Pending Bills title:', text.includes('Pending Bills'));

  const rows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.replace(/\n+/g, ' | ')));
  console.log('Found table rows:', rows.length);
  rows.slice(0, 10).forEach((r, idx) => console.log('Row ' + (idx + 1) + ': ' + r));

  await page.screenshot({ path: 'artifacts/reconciliation/test_outstanding_page.png', fullPage: true });
  await browser.close();
}
testOutstanding().catch(console.error);

