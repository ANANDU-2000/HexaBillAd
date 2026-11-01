const https = require('https');
const crypto = require('crypto');

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
    "tslug": slug, "nbf": now, "exp": now + (8 * 3600), "iat": now, "iss": "HexaBill.Api", "aud": "HexaBill.Api"
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${unsigned}.${sig}`;
}

const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");

function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'hexabill.onrender.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-HexaBill-Original-Host': 'frozenhub.hexabill.company',
        'X-HexaBill-Edge-Secret': EDGE_SECRET
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
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
  console.log('--- 1. /api/reports/summary?fromDate=2026-11-01&toDate=2026-11-01 ---');
  const sum1 = await apiGet('/api/reports/summary?fromDate=2026-11-01&toDate=2026-11-01');
  console.log('Summary 2026-11-01 (Today):', sum1.data);

  console.log('\n--- 2. /api/reports/summary?fromDate=2026-10-01&toDate=2026-10-31 ---');
  const sum2 = await apiGet('/api/reports/summary?fromDate=2026-10-01&toDate=2026-10-31');
  console.log('Summary Oct 2026:', sum2.data);

  console.log('\n--- 3. /api/reports/sales-ledger ---');
  const sl = await apiGet('/api/reports/sales-ledger');
  console.log('Sales Ledger status:', sl.status);
  if (sl.data) {
    console.log('Sales Ledger summary:', {
      totalSales: sl.data.data?.totalSales,
      totalRealPending: sl.data.data?.totalRealPending,
      totalRealGotPayment: sl.data.data?.totalRealGotPayment,
      entryCount: sl.data.data?.entries?.length
    });
    if (sl.data.data?.entries?.length > 0) {
      console.log('First 3 entries:', sl.data.data.entries.slice(0, 3));
      console.log('Last 3 entries:', sl.data.data.entries.slice(-3));
    }
  }

  console.log('\n--- 4. /api/reports/setup-status ---');
  const setup = await apiGet('/api/reports/setup-status');
  console.log('Setup Status:', setup.data);

  console.log('\n--- 5. /api/customers?limit=10 ---');
  const custs = await apiGet('/api/customers?page=1&pageSize=10');
  console.log('Customers count:', custs.data?.data?.length, 'total:', custs.data?.total);
  if (custs.data?.data?.length > 0) {
    console.log('Sample customer:', custs.data.data[0]);
  }
}

run().catch(console.error);
