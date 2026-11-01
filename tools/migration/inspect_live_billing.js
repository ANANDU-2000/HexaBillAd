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

async function inspectBilling() {
  const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('[BROWSER] Authenticating FrozenHub owner session...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('[BROWSER] Opening Billing History (Operating tab)...');
  await page.goto('https://frozenhub.hexabill.company/billing-history?tab=operating', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const rows = await page.$$eval('table tbody tr', trs => {
    return trs.map(tr => tr.innerText.replace(/\n+/g, ' | '));
  });

  console.log(`[BROWSER] Found ${rows.length} rows in Billing History table:`);
  rows.forEach((r, idx) => console.log(`  Row ${idx + 1}: ${r}`));

  const screenshotPath = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_browser_resequenced_billing_history.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[BROWSER] Saved screenshot to ${screenshotPath}`);

  // Also check POS page for next invoice number
  console.log('[BROWSER] Navigating to POS...');
  await page.goto('https://frozenhub.hexabill.company/pos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const posScreenshotPath = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_browser_pos_next_invoice.png';
  await page.screenshot({ path: posScreenshotPath, fullPage: true });
  console.log(`[BROWSER] Saved POS screenshot to ${posScreenshotPath}`);

  await browser.close();
  console.log('[BROWSER] Verification completed.');
}

inspectBilling().catch(console.error);
