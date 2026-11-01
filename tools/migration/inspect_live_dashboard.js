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

async function inspect() {
  const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.goto('https://frozenhub.hexabill.company/dashboard?period=month', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const kpis = await page.$$eval('[aria-label="KPI summary"] > *, [aria-label="Period summary"] > *', cards => {
    return cards.map(c => c.innerText.replace(/\n+/g, ' | '));
  });
  console.log('KPI Cards on live production Dashboard:');
  kpis.forEach((k, idx) => console.log(`  Card ${idx + 1}: ${k}`));

  const alerts = await page.$$eval('[aria-label="Operational status"] > *', cards => {
    return cards.map(c => c.innerText.replace(/\n+/g, ' | '));
  });
  console.log('Operational Status Cards on live production Dashboard:');
  alerts.forEach((a, idx) => console.log(`  Alert ${idx + 1}: ${a}`));

  await browser.close();
}

inspect().catch(console.error);

