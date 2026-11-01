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

async function run() {
  const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('[TEST] Logging in to https://frozenhub.hexabill.company...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('[TEST] Opening Sales Ledger with All Dates...');
  await page.goto('https://frozenhub.hexabill.company/sales-ledger', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const visibleAllBtn = page.locator('button:has-text("All dates"):visible').first();
  if (await visibleAllBtn.count() > 0) {
    console.log('Clicking visible All dates chip...');
    await visibleAllBtn.click();
    await page.waitForTimeout(6000);
  }

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('   - Has Sales figure (3,825,363.88 or 3825363):', bodyText.includes('3,825,363.88') || bodyText.includes('3825363.88'));
  console.log('   - Has Real Pending figure (70,178.03 or 70178.03):', bodyText.includes('70,178.03') || bodyText.includes('70178.03'));
  console.log('   - Has Total Invoices / Rows:', bodyText.includes('4,932') || bodyText.includes('4932') || bodyText.includes('4,948') || bodyText.includes('4948'));

  // Save screenshot as artifact
  const screenshotPath = 'artifacts/reconciliation/sales_ledger_all_dates_live.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`[TEST] Saved screenshot to ${screenshotPath}`);

  await browser.close();
}

run().catch(console.error);
