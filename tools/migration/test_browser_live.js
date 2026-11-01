const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));

const SECRET = require("./require-env")("HEXABILL_JWT_SECRET");
const ARTIFACT_DIR = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
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
    "sv": sv,
    "plat": "false",
    "tid": tenantId.toString(),
    "tenant_id": tenantId.toString(),
    "tslug": slug,
    "nbf": now,
    "exp": now + (8 * 3600),
    "iat": now,
    "iss": "HexaBill.Api",
    "aud": "HexaBill.Api"
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac('sha256', Buffer.from(SECRET, 'utf8'))
    .update(unsignedToken)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signature}`;
}

async function run() {
  const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen Shamsudheen Ainikkal Mamu", 20, "frozenhub", "Owner", "0");
  console.log('[AUTH] Generated Live Owner Token for Tenant 20 (SV: 0).');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[BROWSER CONSOLE ERROR]:', msg.text());
    }
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.error(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });

  console.log('[NAV] Navigating to https://frozenhub.hexabill.company/#support=TOKEN ...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('[NAV] Opening /dashboard?period=month ...');
  await page.goto('https://frozenhub.hexabill.company/dashboard?period=month', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const dashScreenshot = path.join(ARTIFACT_DIR, 'live_browser_dashboard_month.png');
  await page.screenshot({ path: dashScreenshot, fullPage: true });
  console.log(`[SCREENSHOT] Saved dashboard screenshot to ${dashScreenshot}`);

  // Check text content of KPIs
  const bodyText = await page.innerText('body');
  const hasEncounteredProblem = bodyText.includes('This page encountered a problem');
  console.log(`[DASHBOARD STATUS] Encountered problem crash: ${hasEncounteredProblem}`);

  const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
  const kpiIdx = lines.findIndex(l => l === 'Period Sales' || l === 'Sales Today' || l === 'Net sales');
  if (kpiIdx >= 0) {
    console.log('[DASHBOARD LINES NEAR KPIS]:');
    console.log(lines.slice(Math.max(0, kpiIdx - 2), kpiIdx + 20).join(' | '));
  } else {
    console.log('[DASHBOARD FIRST 15 LINES]:');
    console.log(lines.slice(0, 15).join(' | '));
  }

  console.log('[NAV] Opening /billing-history ...');
  await page.goto('https://frozenhub.hexabill.company/billing-history', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const billingScreenshot = path.join(ARTIFACT_DIR, 'live_browser_billing_history.png');
  await page.screenshot({ path: billingScreenshot, fullPage: true });
  console.log(`[SCREENSHOT] Saved billing history screenshot to ${billingScreenshot}`);

  console.log('[NAV] Opening /ledger ...');
  await page.goto('https://frozenhub.hexabill.company/ledger', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const ledgerScreenshot = path.join(ARTIFACT_DIR, 'live_browser_customer_ledger.png');
  await page.screenshot({ path: ledgerScreenshot, fullPage: true });
  console.log(`[SCREENSHOT] Saved ledger screenshot to ${ledgerScreenshot}`);

  await browser.close();
  console.log('[TEST] Completed live browser testing.');
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
