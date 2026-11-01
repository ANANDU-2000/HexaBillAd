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

// User 40 is Owner of Tenant 23 (FrozenHub 2) with SessionVersion "1"
const tokenFh2 = createToken(40, 'frozenhub2@hexabill.company', 'FrozenHub Owner 2', 23, 'frozenhub2', 'Owner', '1');

function apiGet(endpoint, token, host = 'frozenhub2.hexabill.company') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'hexabill.onrender.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'X-HexaBill-Original-Host': host,
        'X-HexaBill-Edge-Secret': EDGE_SECRET
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runIsolationTests() {
  console.log('Testing Tenant 23 (FrozenHub 2) Isolation against Tenant 20 data...');

  // Test 1: Direct access to Tenant 20 Customer 136
  const custRes = await apiGet('/api/customers/136', tokenFh2);
  console.log('Test 1: GET /api/customers/136 as Tenant 23 -> Status:', custRes.status);
  const t1Pass = custRes.status === 404 || custRes.status === 403;
  console.log(`  Result: ${t1Pass ? 'PASS (Access Denied / Not Found)' : 'FAIL (Data Leaked!)'}`);

  // Test 2: Direct access to Tenant 20 Customer 136 Statement PDF
  const stmtRes = await apiGet('/api/customers/136/statement?fromDate=2025-01-01&toDate=2026-11-01', tokenFh2);
  console.log('Test 2: GET /api/customers/136/statement as Tenant 23 -> Status:', stmtRes.status);
  const t2Pass = stmtRes.status === 404 || stmtRes.status === 403;
  console.log(`  Result: ${t2Pass ? 'PASS (Access Denied / Not Found)' : 'FAIL (PDF Leaked!)'}`);

  // Test 3: Legacy Invoices query as Tenant 23
  const legInvRes = await apiGet('/api/legacy/invoices', tokenFh2);
  console.log('Test 3: GET /api/legacy/invoices as Tenant 23 -> Status:', legInvRes.status);
  const legItems = legInvRes.body?.data?.items || legInvRes.body?.items || [];
  const t3Pass = legInvRes.status === 200 && legItems.length === 0;
  console.log(`  Items returned: ${legItems.length} -> ${t3Pass ? 'PASS (0 historical invoices for Tenant 23)' : 'FAIL (Invoices leaked!)'}`);

  // Test 4: Legacy Opening Receivables as Tenant 23
  const legArRes = await apiGet('/api/legacy/opening-receivables', tokenFh2);
  console.log('Test 4: GET /api/legacy/opening-receivables as Tenant 23 -> Status:', legArRes.status);
  const arItems = legArRes.body?.data || legArRes.body || [];
  const t4Pass = (Array.isArray(arItems) && arItems.length === 0) || legArRes.status === 404;
  console.log(`  AR records returned: ${Array.isArray(arItems) ? arItems.length : 0} -> ${t4Pass ? 'PASS (0 AR records for Tenant 23)' : 'FAIL (AR leaked!)'}`);

  // Test 5: Dashboard Reports Summary as Tenant 23
  const dashRes = await apiGet('/api/reports/summary', tokenFh2);
  console.log('Test 5: GET /api/reports/summary as Tenant 23 -> Status:', dashRes.status);
  const pendingAmt = dashRes.body?.data?.pendingBillsAmount ?? dashRes.body?.PendingBillsAmount ?? 0;
  const t5Pass = dashRes.status === 200 && pendingAmt === 0;
  console.log(`  Pending Amount for Tenant 23: AED ${pendingAmt} -> ${t5Pass ? 'PASS (Zero Tenant 20 pending amount leaked)' : 'FAIL (Amount leaked!)'}`);

  const allPass = t1Pass && t2Pass && t3Pass && t4Pass && t5Pass;
  console.log(`\nOVERALL TENANT ISOLATION STATUS: ${allPass ? 'PASS (100% Secure)' : 'FAIL'}`);
}

runIsolationTests().catch(console.error);
