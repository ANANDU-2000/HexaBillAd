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

function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'hexabill.onrender.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      servername: 'hexabill.onrender.com',
      headers: {
        'Authorization': `Bearer ${tokenFh1}`,
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
  const payRes = await apiGet('/api/payments?pageSize=100');
  console.log('Payments status:', payRes.status);
  const items = payRes.body?.data?.items || [];
  console.log('Total payments returned:', items.length);
  items.forEach(p => {
    console.log(`Payment ID: ${p.id} | SaleId: ${p.saleId} | InvoiceNo: ${p.invoiceNo} | Amount: AED ${p.amount} | Date: ${p.paymentDate}`);
  });
}

main().catch(console.error);

