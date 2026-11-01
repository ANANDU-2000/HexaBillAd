const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));
const crypto = require('crypto');

const SECRET = require("./require-env")("HEXABILL_JWT_SECRET");

function b64(s) { return Buffer.from(s).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }

const now = Math.floor(Date.now() / 1000);
const payload = {
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "34",
  "UserId": "34",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "frozenhubfoods@gmail.com",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "Owner",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "Vahid Shamsudheen",
  "sv": "0", "plat": "false", "tid": "20", "tenant_id": "20", "tslug": "frozenhub",
  "nbf": now, "exp": now + 28800, "iat": now, "iss": "HexaBill.Api", "aud": "HexaBill.Api"
};
const unsigned = b64(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' + b64(JSON.stringify(payload));
const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const token = unsigned + '.' + sig;

async function testOutstandingReportCrash() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err.message, err.stack);
    errors.push(err);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[CONSOLE ERROR]', msg.text());
    }
  });

  await page.goto('https://frozenhub.hexabill.company/#support=' + token, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('[BROWSER] Navigating to /reports/outstanding...');
  await page.goto('https://frozenhub.hexabill.company/reports/outstanding', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const errorBoundaryText = await page.$eval('h1, h2, h3, p', el => el ? el.innerText : '').catch(() => '');
  console.log('[BROWSER] Body snippet:', errorBoundaryText);

  const hasCrash = await page.$('text="This page encountered a problem"');
  console.log('[BROWSER] Encountered crash boundary:', !!hasCrash);

  await page.screenshot({ path: 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/reports_outstanding_live_test.png' });
  await browser.close();
}

testOutstandingReportCrash().catch(console.error);

