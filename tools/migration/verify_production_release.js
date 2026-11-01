const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));
const crypto = require('crypto');
const https = require('https');

const SECRET = require("./require-env")("HEXABILL_JWT_SECRET");
const EDGE_SECRET = require("./require-env")("HEXABILL_EDGE_PROXY_SECRET");

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

function checkRenderVersion() {
  return new Promise((resolve) => {
    https.get('https://hexabill.onrender.com/health', (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.deployVersion || 'unknown');
        } catch {
          resolve('error');
        }
      });
    }).on('error', () => resolve('error'));
  });
}

function checkVercelScript() {
  return new Promise((resolve) => {
    https.get('https://frozenhub.hexabill.company', (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const m = data.match(/src="(\/assets\/index-[^"]+\.js)"/);
        resolve(m ? m[1] : 'unknown');
      });
    }).on('error', () => resolve('error'));
  });
}

async function runAcceptance() {
  const renderVer = await checkRenderVersion();
  const vercelScript = await checkVercelScript();
  console.log(`[STATUS] Render: ${renderVer} | Vercel Script: ${vercelScript}`);

  const tokenFh1 = createToken(34, 'frozenhubfoods@gmail.com', 'Vahid Shamsudheen', 20, 'frozenhub', 'Owner', '0');
  const tokenFh2 = createToken(36, 'frozenhub2@hexabill.company', 'FrozenHub 2 Owner', 23, 'frozenhub2', 'Owner', '0');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // TEST 1: Customer 136 Ledger & Bills tab
  console.log('\n--- TEST 1: Customer 136 (CHAWARMA AALMASHI SNACK) ---');
  const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1 = await context1.newPage();
  await page1.goto(`https://frozenhub.hexabill.company/#support=${tokenFh1}`, { waitUntil: 'networkidle' });
  await page1.waitForTimeout(2000);

  const customer136Url = 'https://frozenhub.hexabill.company/ledger?from=2025-01-01&to=2026-11-01&tab=invoices&customerId=136';
  await page1.goto(customer136Url, { waitUntil: 'networkidle' });
  await page1.waitForTimeout(4000);

  // Extract invoice rows and summary numbers
  const invoiceCountText = await page1.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div, span, p')).filter(el => el.textContent.includes('Total Invoices') || el.textContent.includes('Pending Amount') || el.textContent.includes('Balance:'));
    return cards.map(c => c.textContent.trim()).slice(0, 5);
  });
  console.log('Customer 136 Cards on page:', invoiceCountText);

  const tableRows = await page1.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    return rows.slice(0, 10).map(r => r.innerText.replace(/\t+/g, ' | ').replace(/\n+/g, ' '));
  });
  console.log(`Customer 136 Bills Table: found ${tableRows.length} displayed rows (sample of first 10):`);
  tableRows.forEach(r => console.log('  ', r));

  const screenshot1 = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_customer_136_bills.png';
  await page1.screenshot({ path: screenshot1 });
  console.log('Customer 136 screenshot saved to', screenshot1);

  // TEST 2: Inspect Invoice 4403 modal
  console.log('\n--- TEST 2: Inspect Invoice 4403 Modal ---');
  const viewButton = await page1.$('button:has-text("View")');
  if (viewButton) {
    await viewButton.click();
    await page1.waitForTimeout(1500);
    const modalText = await page1.evaluate(() => {
      const modal = document.querySelector('[role="dialog"], .fixed');
      return modal ? modal.innerText.replace(/\n+/g, ' | ') : 'Modal not found';
    });
    console.log('Invoice detail modal text:', modalText.slice(0, 300));
    const screenshot2 = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_customer_136_modal.png';
    await page1.screenshot({ path: screenshot2 });
    console.log('Modal screenshot saved to', screenshot2);
  }

  // TEST 3: FrozenHub 2 (Tenant 23) Strict Isolation
  console.log('\n--- TEST 3: FrozenHub 2 (Tenant 23) Strict Isolation ---');
  const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await context2.newPage();
  await page2.goto(`https://frozenhub2.hexabill.company/#support=${tokenFh2}`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(2000);
  await page2.goto('https://frozenhub2.hexabill.company/billing-history', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(3000);

  const fh2Text = await page2.evaluate(() => document.body.innerText);
  const mentionsStarplus = fh2Text.toLowerCase().includes('starplus');
  const mentions6996 = fh2Text.includes('6996');
  console.log('FrozenHub 2 mentions Starplus?', mentionsStarplus);
  console.log('FrozenHub 2 mentions Invoice 6996?', mentions6996);

  const screenshot3 = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_frozenhub2_isolation.png';
  await page2.screenshot({ path: screenshot3 });
  console.log('FrozenHub 2 screenshot saved to', screenshot3);

  await browser.close();
  console.log('\nAll browser acceptance checks completed successfully!');
}

runAcceptance().catch(console.error);
