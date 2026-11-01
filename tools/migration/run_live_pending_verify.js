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

const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");

function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'hexabill.onrender.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      servername: 'hexabill.onrender.com',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'X-HexaBill-Original-Host': 'frozenhub.hexabill.company',
        'X-HexaBill-Edge-Secret': EDGE_SECRET
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('[API] Testing /api/reports/summary?refresh=true on commit 89a2d1d9...');
  const res = await apiGet('/api/reports/summary?refresh=true');
  console.log('Status:', res.status);
  const d = res.body?.data || res.body;
  console.log('SUMMARY METRICS LIVE ON PRODUCTION:');
  console.log('  PendingBills (count):', d.pendingBills);
  console.log('  PendingBillsAmount:', d.pendingBillsAmount);
  console.log('  OverdueAmountTotal:', d.overdueAmountTotal);
  console.log('  OverdueCustomersCount:', d.overdueCustomersCount);
  console.log('  PendingInvoices list length:', d.pendingInvoices?.length);
  if (d.pendingInvoices?.length > 0) {
    console.log('  Sample pending invoices in summary:');
    d.pendingInvoices.forEach(inv => console.log('   -', inv.invoiceNo, inv.invoiceDate?.slice(0,10), inv.customerName, 'Total:', inv.grandTotal, 'Paid:', inv.paidAmount, inv.paymentStatus));
  }

  // Browser verification
  console.log('\n[BROWSER] Launching Playwright browser verification...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('[BROWSER] Authenticating FrozenHub owner session...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Dashboard Custom Range 01-01-2025 to 01-11-2026
  console.log('[BROWSER] Navigating to Dashboard Custom Range...');
  await page.goto('https://frozenhub.hexabill.company/dashboard?period=custom&from=2025-01-01&to=2026-11-01', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const dashCustomPath = 'artifacts/reconciliation/dashboard_custom_pending_fixed.png';
  await page.screenshot({ path: dashCustomPath, fullPage: true });
  console.log(`[BROWSER] Saved screenshot to ${dashCustomPath}`);

  // 2. Dashboard Default / Today
  console.log('[BROWSER] Navigating to Dashboard default...');
  await page.goto('https://frozenhub.hexabill.company/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const dashPath = 'artifacts/reconciliation/dashboard_pending_fixed_live.png';
  await page.screenshot({ path: dashPath, fullPage: true });
  console.log(`[BROWSER] Saved screenshot to ${dashPath}`);

  await browser.close();
  console.log('[ALL VERIFICATIONS COMPLETE]');
}

main().catch(console.error);

