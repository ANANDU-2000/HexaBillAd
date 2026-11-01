const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const SECRET = 'z4qGVNFXkPS9mxTVuLVpT3iVp3TV5+rau2mY1hSmaT7vJ4ZXV9yegsvREiIXBqzqm0YPJ9o6I3cfYTJ4ZrVqKw==';
const EDGE_SECRET = 'spNjekAfZtuAtxhEzfshUKNnIGkhS+Rym2W50jK8oQiMx6ILaDmJ0+sSV0DXAi9Y';

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

function checkPdfEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'hexabill.onrender.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenFh1}`,
        'Accept': 'application/pdf',
        'X-HexaBill-Original-Host': 'frozenhub.hexabill.company',
        'X-HexaBill-Edge-Secret': EDGE_SECRET
      }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const str = buffer.toString('latin1');
        const isPdf = str.startsWith('%PDF-');
        const pageMatches = str.match(/\/Type\s*\/Page[^s]/g) || [];
        resolve({
          status: res.statusCode,
          size: buffer.length,
          isPdf,
          pageCount: pageMatches.length
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const targetCustomers = [
  { id: 134, name: 'DAR AL MANDI RESTAURANT & KITCHEN', opening: 15466.98 },
  { id: 135, name: 'DALLAS RESTAURANT LLC', opening: 12499.62 },
  { id: 136, name: 'CHAWARMA AALMASHI SNACK', opening: 8954.00 },
  { id: 137, name: 'DAR AL MANDI AL MUMAIZ', opening: 8258.90 },
  { id: 138, name: 'DREAMS KITCHEN', opening: 5301.75 },
  { id: 139, name: 'KHAN DARBAR RESTAURANT', opening: 4405.00 },
  { id: 140, name: 'STICK MAGIC RESTAURANT', opening: 4279.00 },
  { id: 141, name: 'TEA ISLAND CAFE', opening: 3376.15 },
  { id: 142, name: 'DAR AL MANDI KHALDIYA', opening: 2950.71 },
  { id: 143, name: 'ABAYAN MANDI REST & KITCHEN', opening: 1611.99 },
  { id: 144, name: 'FRESH SAMAWAR TEA CAFE.', opening: 728.00 },
  { id: 145, name: 'CASH BILL VAHID', opening: 511.00 },
  { id: 146, name: 'CASH BILL HUSSAIN', opening: 420.00 },
  { id: 147, name: 'DALLAS ORIGINAL RESTAURANT', opening: 343.00 },
  { id: 148, name: 'ELITE LEGAL TRANSLATION SOLE-LLC', opening: 324.14 },
  { id: 149, name: 'KASHMIR SPICY RESTAURANT', opening: 301.00 },
  { id: 150, name: 'NELLIKKA RESTAURANT', opening: 144.00 },
  { id: 151, name: 'SHEGER RESTAURANT', opening: 118.00 },
  { id: 152, name: 'TIKKA TOWN RESTAURANT', opening: 83.00 },
  { id: 153, name: 'CRYSTAL FREEZE FOODSTUFF TRADING L.L.C', opening: 1.00 },
  { id: 154, name: 'TEA TREND CAFETERIA', opening: 0.05 },
  // Non-opening receivable customer baseline
  { id: 128, name: 'DILKUSH CAFETERIA L.L.C-S.P.C', opening: 0.00 },
  { id: 130, name: 'GOLDEN PLATE RESTAURANT', opening: 0.00 },
  { id: 131, name: 'ISHAKALI RESTAURANT', opening: 0.00 },
  { id: 132, name: 'GOLDEN EXPRESS RESTAURANT', opening: 0.00 },
  { id: 133, name: 'SASAL NAKEL RESTAURANT', opening: 0.00 }
];

async function runQA() {
  console.log(`Starting Statement & Pending Bills PDF QA for ${targetCustomers.length} representative accounts...`);
  const results = [];

  for (const c of targetCustomers) {
    process.stdout.write(`  Checking Cust ${c.id}: ${c.name.slice(0, 25)}... `);
    const stmtRes = await checkPdfEndpoint(`/api/customers/${c.id}/statement?fromDate=2025-01-01&toDate=2026-11-01`);
    const pendingRes = await checkPdfEndpoint(`/api/customers/${c.id}/pending-bills-pdf`);

    const stmtPass = stmtRes.status === 200 && stmtRes.isPdf && stmtRes.size > 1000;
    const pendingPass = pendingRes.status === 200 && pendingRes.isPdf && pendingRes.size > 1000;
    const allPass = stmtPass && pendingPass;

    console.log(`Stmt: ${stmtRes.status} (${stmtRes.pageCount} pgs, ${stmtRes.size} B) | Pending: ${pendingRes.status} (${pendingRes.pageCount} pgs, ${pendingRes.size} B) -> ${allPass ? 'PASS' : 'FAIL'}`);

    results.push({
      DestinationCustomerId: c.id,
      CustomerName: c.name,
      OpeningReceivableApproved: c.opening.toFixed(2),
      StatementPdfStatus: stmtPass ? 'PASS' : 'FAIL',
      StatementPdfStatusCode: stmtRes.status,
      StatementPdfPageCount: stmtRes.pageCount,
      StatementPdfSizeBytes: stmtRes.size,
      PendingBillsPdfStatus: pendingPass ? 'PASS' : 'FAIL',
      PendingBillsPdfStatusCode: pendingRes.status,
      PendingBillsPdfPageCount: pendingRes.pageCount,
      PendingBillsPdfSizeBytes: pendingRes.size,
      FinalStatus: allPass ? 'PASS' : 'FAIL'
    });
  }

  // Write CSV
  const header = Object.keys(results[0]).join(',');
  const lines = results.map(r => Object.values(r).map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(','));
  const csvContent = [header, ...lines].join('\n');

  const outPath = path.resolve('artifacts/reconciliation/CUSTOMER-STATEMENT-QA.csv');
  fs.writeFileSync(outPath, csvContent, 'utf8');
  console.log(`\nSuccessfully wrote ${results.length} rows to ${outPath}!`);
}

runQA().catch(console.error);

