const crypto = require('crypto');
const https = require('https');

const SECRET = require("./require-env")("HEXABILL_JWT_SECRET");
const EDGE_SECRET = require("./require-env")("HEXABILL_EDGE_PROXY_SECRET");

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
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
    "sv": sv,
    "plat": "false",
    "tid": tenantId.toString(),
    "tenant_id": tenantId.toString(),
    "tslug": slug,
    "nbf": now,
    "exp": now + (8 * 3600),
    "iat": now,
    "iss": "HexaBill.Api",
    "aud": "HexaBill.Api"
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac('sha256', Buffer.from(SECRET, 'utf8'))
    .update(unsignedToken)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signature}`;
}

const tokenFh1 = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");

function apiGet(endpoint, token, originalHost) {
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
        'X-HexaBill-Original-Host': originalHost,
        'X-HexaBill-Edge-Secret': EDGE_SECRET
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Testing /api/legacy/purchases on live Render...');
  const resP = await apiGet('/api/legacy/purchases?pageSize=3', tokenFh1, 'frozenhub.hexabill.company');
  console.log('Purchases status:', resP.status);
  if (resP.status === 200) {
    console.log('Purchases count:', resP.body?.data?.totalCount);
    console.log('Sample purchase:', resP.body?.data?.items?.[0]);
  } else {
    console.log('Response body:', resP.body || resP.text);
  }

  console.log('\nTesting /api/legacy/suppliers on live Render...');
  const resS = await apiGet('/api/legacy/suppliers', tokenFh1, 'frozenhub.hexabill.company');
  console.log('Suppliers status:', resS.status);
  if (resS.status === 200) {
    console.log('Suppliers count:', resS.body?.data?.length);
    console.log('Top supplier:', resS.body?.data?.[0]);
  } else {
    console.log('Response body:', resS.body || resS.text);
  }

  console.log('\nTesting /api/legacy/expenses on live Render...');
  const resE = await apiGet('/api/legacy/expenses?pageSize=3', tokenFh1, 'frozenhub.hexabill.company');
  console.log('Expenses status:', resE.status);
  if (resE.status === 200) {
    console.log('Expenses count:', resE.body?.data?.totalCount);
    console.log('Sample expense:', resE.body?.data?.items?.[0]);
  } else {
    console.log('Response body:', resE.body || resE.text);
  }
}

main().catch(console.error);

