const https = require('https');
const crypto = require('crypto');
const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));

const SECRET = require("./require-env")("HEXABILL_JWT_SECRET");
const EDGE_SECRET = require("./require-env")("HEXABILL_EDGE_PROXY_SECRET");

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
    "tslug": slug, "nbf": now, "exp": now + 28800, "iat": now, "iss": "HexaBill.Api", "aud": "HexaBill.Api"
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${unsigned}.${sig}`;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");

  console.log('[SETUP] Logging in...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const pagesToTest = [
    { name: 'Dashboard', url: 'https://frozenhub.hexabill.company/dashboard' },
    { name: 'Dashboard Custom', url: 'https://frozenhub.hexabill.company/dashboard?period=custom&from=2025-01-01&to=2026-11-01' },
    { name: 'Billing History', url: 'https://frozenhub.hexabill.company/billing-history' },
    { name: 'Sales Ledger', url: 'https://frozenhub.hexabill.company/sales-ledger' },
    { name: 'Customer 143 Ledger', url: 'https://frozenhub.hexabill.company/ledger?customerId=143' },
    { name: 'Reports Summary', url: 'https://frozenhub.hexabill.company/reports' },
    { name: 'Reports Sales Tab', url: 'https://frozenhub.hexabill.company/reports?tab=sales' },
    { name: 'Reports Outstanding Tab', url: 'https://frozenhub.hexabill.company/reports?tab=outstanding' },
    { name: 'Suppliers', url: 'https://frozenhub.hexabill.company/suppliers' },
    { name: 'Purchases', url: 'https://frozenhub.hexabill.company/purchases' },
    { name: 'Payments', url: 'https://frozenhub.hexabill.company/payments' },
    { name: 'Expenses', url: 'https://frozenhub.hexabill.company/expenses' }
  ];

  for (const p of pagesToTest) {
    try {
      console.log(`\n[TEST] Visiting: ${p.name} (${p.url})`);
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);

      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500).replace(/\n+/g, ' '));
      console.log(`  Title: ${title}`);
      console.log(`  Snippet: ${bodyText.substring(0, 180)}...`);

      const safeFileName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await page.screenshot({ path: `artifacts/reconciliation/page_${safeFileName}.png`, fullPage: false });
      console.log(`  Screenshot saved: artifacts/reconciliation/page_${safeFileName}.png`);
    } catch (err) {
      console.error(`  Error testing ${p.name}:`, err.message);
    }
  }

  await browser.close();
  console.log('\n[DONE] All pages tested.');
})();
