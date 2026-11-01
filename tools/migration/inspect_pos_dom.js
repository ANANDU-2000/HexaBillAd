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

async function checkPos() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://frozenhub.hexabill.company/#support=' + token, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.goto('https://frozenhub.hexabill.company/pos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Look for invoice number elements
  const texts = await page.$$eval('*', els => {
    return els
      .filter(el => el.innerText && (el.innerText.includes('7013') || el.innerText.includes('Invoice') || el.innerText.includes('Bill #')))
      .slice(0, 10)
      .map(el => el.innerText.trim());
  });
  console.log('POS texts containing Invoice/7013:', texts);

  await browser.close();
}

checkPos().catch(console.error);

