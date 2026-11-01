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
  console.log('--- 1. /api/customers/143 ---');
  const c143 = await apiGet('/api/customers/143');
  console.log('Customer 143:', c143.data);

  console.log('\n--- 2. /api/customers/143/outstanding-invoices ---');
  const out143 = await apiGet('/api/customers/143/outstanding-invoices');
  console.log('Outstanding invoices for 143:', out143.data);

  console.log('\n--- 3. /api/legacy/invoices?customerId=143 ---');
  const leg143 = await apiGet('/api/legacy/invoices?customerId=143&pageSize=10');
  console.log('Legacy invoices for 143:', leg143.data?.data?.totalCount, 'items:', leg143.data?.data?.items?.length);
  if (leg143.data?.data?.items?.length > 0) {
    console.log('Sample item:', leg143.data.data.items[0]);
  }

  console.log('\n--- 4. /api/legacy/invoices?customerId=143&pendingOnly=true ---');
  const legPend143 = await apiGet('/api/legacy/invoices?customerId=143&pendingOnly=true');
  console.log('Legacy pending invoices for 143:', legPend143.data?.data?.items);
}

run().catch(console.error);

