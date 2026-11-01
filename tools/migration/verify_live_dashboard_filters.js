const path = require('path');
const { chromium } = require(path.resolve('frontend/hexabill-ui/node_modules/playwright'));
const crypto = require('crypto');

const SECRET = require("./require-env")("HEXABILL_JWT_SECRET");
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

async function run() {
  const token = createToken(34, 'frozenhubfoods@gmail.com', 'Vahid Shamsudheen', 20, 'frozenhub', 'Owner', '0');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in to live system via #support token...');
  await page.goto(`https://frozenhub.hexabill.company/#support=${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Test 1: Week (Rolling 7 days)
  console.log('\n--- 1. Testing Dashboard: Period = Week ---');
  await page.goto('https://frozenhub.hexabill.company/dashboard?period=week', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const weekKpis = await page.$$eval('[aria-label="KPI summary"] > *, [aria-label="Period summary"] > *', cards => cards.map(c => c.innerText.replace(/\n+/g, ' | ')));
  console.log('Week KPIs:', weekKpis);
  const ssWeek = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_dashboard_week_verified.png';
  await page.screenshot({ path: ssWeek });

  // Test 2: Last 30 Days
  console.log('\n--- 2. Testing Dashboard: Period = Last 30 Days ---');
  await page.goto('https://frozenhub.hexabill.company/dashboard?period=last30', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const m30Kpis = await page.$$eval('[aria-label="KPI summary"] > *, [aria-label="Period summary"] > *', cards => cards.map(c => c.innerText.replace(/\n+/g, ' | ')));
  console.log('30 Days KPIs:', m30Kpis);
  const ssM30 = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_dashboard_30days_verified.png';
  await page.screenshot({ path: ssM30 });

  // Test 3: All Time
  console.log('\n--- 3. Testing Dashboard: Period = All Time ---');
  await page.goto('https://frozenhub.hexabill.company/dashboard?period=allTime', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const allKpis = await page.$$eval('[aria-label="KPI summary"] > *, [aria-label="Period summary"] > *', cards => cards.map(c => c.innerText.replace(/\n+/g, ' | ')));
  console.log('All Time KPIs:', allKpis);
  const ssAll = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_dashboard_alltime_verified.png';
  await page.screenshot({ path: ssAll });

  // Test 4: Reports Summary
  console.log('\n--- 4. Testing Reports: Tab = Summary ---');
  await page.goto('https://frozenhub.hexabill.company/reports?tab=summary', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const ssReports = 'C:/Users/anand/.gemini/antigravity/brain/4a4fe5a8-450b-44ef-a20b-98406a94f6cf/live_reports_summary_verified.png';
  await page.screenshot({ path: ssReports });

  console.log('\nAll browser live tests complete!');
  await browser.close();
}

run().catch(console.error);

