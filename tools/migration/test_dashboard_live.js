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

async function testTablet() {
  const token = createToken(34, 'frozenhubfoods@gmail.com', 'Vahid Shamsudheen', 20, 'frozenhub', 'Owner', '0');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 689 } });
  const page = await context.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.toString()));

  await page.goto('https://frozenhub.hexabill.company/#support=' + token, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.goto('https://frozenhub.hexabill.company/dashboard?period=month', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const errorBoundary = await page.$('text="This page encountered a problem"');
  console.log('Error boundary present?', !!errorBoundary);
  if (consoleErrors.length > 0) {
    console.log('Console errors:', consoleErrors);
  }
  const screenshotPath = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_dashboard_1024x689.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to', screenshotPath);
  await browser.close();
}

testTablet().catch(console.error);

