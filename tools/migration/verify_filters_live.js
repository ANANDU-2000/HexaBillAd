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
  console.log('=== VERIFYING LIVE POST-DEPLOYMENT APIS ===');
  
  // 1. Rolling Week (Oct 26 - Nov 1)
  const weekRes = await apiRequest('/api/reports/summary?fromDate=2026-10-26&toDate=2026-11-01');
  const weekData = weekRes.body?.data;
  console.log('\n[1. Rolling Week (7 Days: Oct 26 - Nov 1)]');
  console.log(`Sales: ${weekData?.salesToday} AED (Expected ~81,261.09 AED)`);
  console.log(`Purchases: ${weekData?.purchasesToday} AED (Expected ~74,283.08 AED)`);
  console.log(`Profit: ${weekData?.profitToday} AED (Expected ~7,340.82 AED)`);

  // 2. Rolling 30 Days (Oct 3 - Nov 1)
  const m30Res = await apiRequest('/api/reports/summary?fromDate=2026-10-03&toDate=2026-11-01');
  const m30Data = m30Res.body?.data;
  console.log('\n[2. Rolling 30 Days (Oct 3 - Nov 1)]');
  console.log(`Sales: ${m30Data?.salesToday} AED (Expected ~306,560.70 AED)`);
  console.log(`Purchases: ${m30Data?.purchasesToday} AED (Expected ~273,741.10 AED)`);

  // 3. All Time (2024-01-01 - 2026-11-01)
  const allRes = await apiRequest('/api/reports/summary?fromDate=2024-01-01&toDate=2026-11-01');
  const allData = allRes.body?.data;
  console.log('\n[3. All Dates Full History]');
  console.log(`Sales: ${allData?.salesToday} AED (Expected 3,825,363.88 AED)`);
  console.log(`Purchases: ${allData?.purchasesToday} AED (Expected 3,527,138.48 AED)`);
  console.log(`Expenses: ${allData?.expensesToday} AED (Expected 14,239.00 AED)`);
  console.log(`Net Profit: ${allData?.profitToday} AED (Expected 284,390.46 AED)`);
  console.log(`Pending: ${allData?.pendingBills} bills, Amount: ${allData?.pendingBillsAmount} AED (Expected 87 bills, 70,178.03 AED)`);
  console.log(`Top Customers: ${allData?.topCustomersToday?.length || 0}`);
  if (allData?.topCustomersToday?.length > 0) {
    allData.topCustomersToday.forEach((c, i) => console.log(`   #${i+1}: ${c.customerName} - ${c.totalSales} AED (${c.invoiceCount} bills)`));
  }
  console.log(`Top Products: ${allData?.topProductsToday?.length || 0}`);
  if (allData?.topProductsToday?.length > 0) {
    allData.topProductsToday.forEach((p, i) => console.log(`   #${i+1}: ${p.productName} - ${p.totalSales} AED (${p.totalQty} ${p.unitType})`));
  }

  // 4. Product Sales Report
  const prodRes = await apiRequest('/api/reports/product-sales?fromDate=2024-01-01&toDate=2026-11-01&top=10');
  const prodList = prodRes.body?.data;
  console.log('\n[4. Product Sales Report (/api/reports/product-sales)]');
  console.log(`Products returned: ${prodList?.length || 0}`);
  if (prodList?.length > 0) {
    prodList.slice(0, 5).forEach((p, i) => console.log(`   #${i+1}: ${p.productName} - ${p.totalAmount} AED (${p.totalQty} ${p.unitType})`));
  }

  // 5. Profit & Loss Report
  const pnlRes = await apiRequest('/profit/report?fromDate=2024-01-01&toDate=2026-11-01');
  const pnlData = pnlRes.body?.data;
  console.log('\n[5. Profit & Loss Report (/profit/report)]');
  console.log(`Total Sales: ${pnlData?.totalSales} AED, Total Purchases: ${pnlData?.totalPurchases} AED, Net Profit: ${pnlData?.netProfit} AED`);
}

run();

