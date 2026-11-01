const https = require('https');
const crypto = require('crypto');
const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));

const TARGET_COMMIT = '89a2d1d9';
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

function checkHealth() {
  return new Promise((resolve) => {
    https.get('https://hexabill.onrender.com/health', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

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
  console.log(`[DEPLOY] Polling Render for commit ${TARGET_COMMIT}...`);
  let deployed = false;
  for (let i = 0; i < 40; i++) {
    const h = await checkHealth();
    const ver = h?.deployVersion || '';
    console.log(`[POLL ${i + 1}] Render deployVersion: ${ver}`);
    if (ver.startsWith(TARGET_COMMIT)) {
      deployed = true;
      console.log(`[DEPLOY] Commit ${TARGET_COMMIT} is LIVE on Render!`);
      break;
    }
    await new Promise(r => setTimeout(r, 10000));
  }

  if (!deployed) {
    console.log('[WARN] Render deployment timed out or took longer than 400s.');
  }

  console.log('\n[API] Testing /api/reports/summary (skipCache=true)...');
  const res = await apiGet('/api/reports/summary?refresh=true');
  console.log('Status:', res.status);
  const d = res.body?.data || res.body;
  console.log('Summary metrics:');
  console.log('  PendingBills (count):', d.pendingBills);
  console.log('  PendingBillsAmount:', d.pendingBillsAmount);
  console.log('  OverdueAmountTotal:', d.overdueAmountTotal);
  console.log('  OverdueCustomersCount:', d.overdueCustomersCount);
  console.log('  PendingInvoices list length:', d.pendingInvoices?.length);
  if (d.pendingInvoices?.length > 0) {
    console.log('  Sample pending invoices:');
    d.pendingInvoices.slice(0, 5).forEach(inv => console.log('   -', inv.invoiceNo, inv.customerName, inv.grandTotal, inv.paymentStatus));
  }

  // Browser verification
  console.log('\n[BROWSER] Launching Playwright browser verification...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('[BROWSER] Authenticating FrozenHub owner session...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Dashboard Today / Default
  console.log('[BROWSER] Navigating to Dashboard...');
  await page.goto('https://frozenhub.hexabill.company/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const dashPath = 'artifacts/reconciliation/dashboard_pending_fixed_live.png';
  await page.screenshot({ path: dashPath, fullPage: true });
  console.log(`[BROWSER] Saved screenshot to ${dashPath}`);

  // 2. Outstanding Bills
  console.log('[BROWSER] Navigating to /reports?tab=outstanding...');
  await page.goto('https://frozenhub.hexabill.company/reports?tab=outstanding', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const outPath = 'artifacts/reconciliation/reports_outstanding_fixed_live.png';
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`[BROWSER] Saved screenshot to ${outPath}`);

  await browser.close();
  console.log('[ALL DONE]');
}

main().catch(console.error);
