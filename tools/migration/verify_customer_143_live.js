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
    "http://schemas.microsoft.com/ws/2005/05/identity/claims/name": name,
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
  console.log('=== VERIFYING CUSTOMER 143 (ABAYAN MANDI REST & KITCHEN) ===');
  
  // 1. Customer Details & Balance
  const custRes = await apiGet('/api/customers/143');
  console.log('1. Customer 143 Details:');
  if (custRes.data?.success) {
    const c = custRes.data.data;
    console.log(`   Name: ${c.name}, Balance: ${c.balance} AED, TRN: ${c.trn || 'N/A'}`);
  } else {
    console.log('   Error fetching customer:', custRes.data);
  }

  // 2. Outstanding Invoices
  const outRes = await apiGet('/api/customers/143/outstanding-invoices');
  console.log('2. Outstanding Invoices:');
  if (outRes.data?.success) {
    const items = outRes.data.data || [];
    console.log(`   Count: ${items.length} unpaid invoices`);
    items.forEach(inv => {
      console.log(`   - Invoice #${inv.invoiceNo}: Date=${inv.invoiceDate}, Total=${inv.grandTotal} AED, Balance=${inv.balanceAmount} AED`);
    });
    const totalOut = items.reduce((s, x) => s + Number(x.balanceAmount || 0), 0);
    console.log(`   Total Outstanding Calculated: ${totalOut.toFixed(2)} AED`);
  }

  // 3. Legacy Invoices (All Dates)
  const legRes = await apiGet('/api/legacy/invoices?customerId=143&pageSize=1000');
  console.log('3. Legacy Invoices (All Dates):');
  if (legRes.data?.success) {
    const items = legRes.data.data?.items || [];
    console.log(`   Count: ${items.length} active invoices (Total reported: ${legRes.data.data?.totalCount})`);
  }

  // 4. Legacy Payments
  const payRes = await apiGet('/api/legacy/payments?customerId=143&pageSize=1000');
  console.log('4. Legacy Payments:');
  if (payRes.data?.success) {
    const items = payRes.data.data?.items || [];
    console.log(`   Count: ${items.length} cleared payments (Total reported: ${payRes.data.data?.totalCount})`);
  }

  // 5. Inspect specific invoices 6989 & 2898 items
  const inv6989 = await apiGet('/api/legacy/invoices/6989');
  console.log('5. Invoice 6989 items:');
  if (inv6989.data?.success) {
    const items = inv6989.data.data?.items || [];
    console.log(`   Invoice 6989: ${items.length} items`);
    items.forEach(i => console.log(`   - ${i.productName}: Qty=${i.quantity}, Price=${i.unitPrice}, Total=${i.total}`));
  }

  const inv2898 = await apiGet('/api/legacy/invoices/2898');
  console.log('6. Invoice 2898 items:');
  if (inv2898.data?.success) {
    const items = inv2898.data.data?.items || [];
    console.log(`   Invoice 2898: ${items.length} items`);
    items.forEach(i => console.log(`   - ${i.productName}: Qty=${i.quantity}, Price=${i.unitPrice}, Total=${i.total}`));
  }
}

run().catch(console.error);

