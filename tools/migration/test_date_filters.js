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
        'Authorization': 'Bearer ' + tokenFh1,
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
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const tests = [
    { label: 'Today (2026-11-01)', path: '/api/reports/summary?fromDate=2026-11-01&toDate=2026-11-01' },
    { label: 'Rolling Week (2026-10-26 to 2026-11-01)', path: '/api/reports/summary?fromDate=2026-10-26&toDate=2026-11-01' },
    { label: 'Calendar Week Sunday (2026-11-01 to 2026-11-01)', path: '/api/reports/summary?fromDate=2026-11-01&toDate=2026-11-01' },
    { label: 'Calendar Month Nov (2026-11-01 to 2026-11-01)', path: '/api/reports/summary?fromDate=2026-11-01&toDate=2026-11-01' },
    { label: 'Last 30 Days (2026-10-03 to 2026-11-01)', path: '/api/reports/summary?fromDate=2026-10-03&toDate=2026-11-01' },
    { label: 'October (2026-10-01 to 2026-10-31)', path: '/api/reports/summary?fromDate=2026-10-01&toDate=2026-10-31' },
    { label: 'All Dates (2024-01-01 to 2026-11-01)', path: '/api/reports/summary?fromDate=2024-01-01&toDate=2026-11-01' },
    { label: 'Operating Sales (Sales Ledger)', path: '/api/reports/sales?page=1&pageSize=5' }
  ];

  for (const t of tests) {
    const res = await apiRequest(t.path);
    const d = res.body?.data;
    if (d && d.salesToday !== undefined) {
      console.log(`[${t.label}] Sales: ${d.salesToday}, Purchases: ${d.purchasesToday}, Expenses: ${d.expensesToday}, Profit: ${d.profitToday}, Pending: ${d.pendingBills} (${d.pendingBillsAmount})`);
    } else if (d && d.items) {
      console.log(`[${t.label}] TotalCount: ${d.totalCount}, Items: ${d.items.length}`);
    } else {
      console.log(`[${t.label}] Status: ${res.status}`, JSON.stringify(res.body || res.raw).slice(0, 200));
    }
  }
}

run();

