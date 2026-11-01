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

const tokenFh1 = createToken(34, 'frozenhubfoods@gmail.com', 'Vahid Shamsudheen', 20, 'frozenhub', 'Owner', '0');

function apiRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'hexabill.onrender.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenFh1}`,
        'Content-Type': 'application/json',
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
        } catch(e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function checkReports() {
  console.log('--- Testing /api/reports/summary for November (month: 2026-11-01 to 2026-11-30) ---');
  const resNov = await apiRequest('/api/reports/summary?fromDate=2026-11-01&toDate=2026-11-30');
  console.log('Nov summary:', resNov.body?.data ? {
    salesToday: resNov.body.data.salesToday,
    netSalesToday: resNov.body.data.netSalesToday,
    cashCollectionsTotal: resNov.body.data.cashCollectionsTotal,
    pendingBills: resNov.body.data.pendingBills,
    pendingBillsAmount: resNov.body.data.pendingBillsAmount,
    overdueAmountTotal: resNov.body.data.overdueAmountTotal
  } : resNov.body);

  console.log('\n--- Testing /api/reports/summary for October (2026-10-01 to 2026-10-31) ---');
  const resOct = await apiRequest('/api/reports/summary?fromDate=2026-10-01&toDate=2026-10-31');
  console.log('Oct summary:', resOct.body?.data ? {
    salesToday: resOct.body.data.salesToday,
    netSalesToday: resOct.body.data.netSalesToday,
    cashCollectionsTotal: resOct.body.data.cashCollectionsTotal,
    pendingBills: resOct.body.data.pendingBills,
    pendingBillsAmount: resOct.body.data.pendingBillsAmount,
    overdueAmountTotal: resOct.body.data.overdueAmountTotal
  } : resOct.body);

  console.log('\n--- Testing /api/reports/pending-bills ---');
  const resPending = await apiRequest('/api/reports/pending-bills');
  console.log('Pending bills count:', resPending.body?.data?.length, 'Total pending AED:', resPending.body?.data?.reduce((s, b) => s + (b.pendingAmount || b.balance || 0), 0));
}

checkReports().catch(console.error);

