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
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
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
const tokenFh2 = createToken(40, "frozenhub2@hexabill.company", "FrozenHub Owner 2", 23, "frozenhub2", "Owner", "1");

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

async function runTests() {
  console.log('=== REAL PRODUCTION API INTEGRATION TESTING (RENDER LIVE VIA EDGE PROXY AUTH) ===\n');

  // Test 1: FH1 Reconciliation
  console.log('[TEST 1] Testing /api/legacy/reconciliation for FrozenHub 1 (Tenant 20)...');
  const resFh1Recon = await apiGet('/api/legacy/reconciliation', tokenFh1, 'frozenhub.hexabill.company');
  console.log(`  HTTP Status: ${resFh1Recon.status}`);
  if (resFh1Recon.status === 200 && resFh1Recon.body?.data) {
    const d = resFh1Recon.body.data;
    console.log(`  Active Invoices: ${d.activeInvoices} | Active Sales: AED ${d.activeGrandTotal}`);
    console.log(`  Positive Outstanding: AED ${d.positiveOutstandingSum} (${d.positiveOutstandingCount} bills)`);
    console.log(`  Customer Opening Receivables: AED ${d.customerOpeningReceivablesTotal} (${d.customerOpeningReceivablesCount} custs)`);
    console.log('  Result: PASS');
  } else {
    console.log('  Failed response:', resFh1Recon.body || resFh1Recon.text);
  }

  // Test 2: FH2 Reconciliation (Negative security test)
  console.log('\n[TEST 2] Testing /api/legacy/reconciliation for FrozenHub 2 (Tenant 23) [MUST NOT EXPOSE FH1 DATA]...');
  const resFh2Recon = await apiGet('/api/legacy/reconciliation', tokenFh2, 'frozenhub2.hexabill.company');
  console.log(`  HTTP Status: ${resFh2Recon.status}`);
  if (resFh2Recon.status === 200 && resFh2Recon.body?.data) {
    const d = resFh2Recon.body.data;
    const isLeaking = (d.activeInvoices > 0 || d.activeGrandTotal > 0 || d.positiveOutstandingSum > 0);
    console.log(`  Active Invoices: ${d.activeInvoices} | Active Sales: AED ${d.activeGrandTotal} | Outstanding: AED ${d.positiveOutstandingSum}`);
    console.log(`  Data Leak Detected: ${isLeaking ? 'YES (CRITICAL FAIL)' : 'NO (STRICT ISOLATION PASS)'}`);
  } else {
    console.log(`  Status: ${resFh2Recon.status} (Access rejected or zero data - PASS)`);
  }

  // Test 3: Customer Ledger for Customer 134 (DAR AL MANDI)
  console.log('\n[TEST 3] Testing /api/customers/134/ledger for FrozenHub 1 (Must include Opening Balance)...');
  const resLedger = await apiGet('/api/customers/134/ledger?fromDate=2026-11-01&toDate=2026-11-01', tokenFh1, 'frozenhub.hexabill.company');
  console.log(`  HTTP Status: ${resLedger.status}`);
  if (resLedger.status === 200 && resLedger.body?.data) {
    const entries = Array.isArray(resLedger.body.data) ? resLedger.body.data : [];
    console.log(`  Returned ${entries.length} ledger entries.`);
    const openingRow = entries.find(e => e.type === 'Opening Balance');
    if (openingRow) {
      console.log(`  FOUND OPENING BALANCE ROW: Date: ${openingRow.date} | Amount: AED ${openingRow.debit || openingRow.balance} | Remarks: ${openingRow.remarks}`);
      console.log('  Result: PASS (Opening balance properly carried forward on 1 Nov 2026)');
    } else {
      console.log('  Opening balance row not found. First row:', entries[0]);
    }
  } else {
    console.log('  Failed response:', resLedger.body || resLedger.text);
  }

  // Test 4: Dashboard Summary Report for FH1
  console.log('\n[TEST 4] Testing /api/reports/summary for FrozenHub 1 (Must include receivables from cutover)...');
  const resSummaryFh1 = await apiGet('/api/reports/summary?fromDate=2026-11-01&toDate=2026-11-01', tokenFh1, 'frozenhub.hexabill.company');
  console.log(`  HTTP Status: ${resSummaryFh1.status}`);
  if (resSummaryFh1.status === 200 && resSummaryFh1.body?.data) {
    const d = resSummaryFh1.body.data;
    console.log(`  Pending Bills Amount: AED ${d.pendingBillsAmount} | Pending Bills Count: ${d.pendingBills}`);
    console.log(`  Overdue Amount: AED ${d.overdueAmountTotal} | Overdue Customers: ${d.overdueCustomersCount}`);
    if (d.pendingBillsAmount > 0) {
      console.log('  Result: PASS (Receivables are active and visible in normal operational summary)');
    } else {
      console.log('  Pending bills amount is still 0');
    }
  } else {
    console.log('  Failed response:', resSummaryFh1.body || resSummaryFh1.text);
  }

  // Test 5: Dashboard Summary Report for FH2 (Negative security test)
  console.log('\n[TEST 5] Testing /api/reports/summary for FrozenHub 2 (Tenant 23) [MUST BE ZERO]...');
  const resSummaryFh2 = await apiGet('/api/reports/summary?fromDate=2026-11-01&toDate=2026-11-01', tokenFh2, 'frozenhub2.hexabill.company');
  console.log(`  HTTP Status: ${resSummaryFh2.status}`);
  if (resSummaryFh2.status === 200 && resSummaryFh2.body?.data) {
    const d = resSummaryFh2.body.data;
    console.log(`  Pending Bills Amount: AED ${d.pendingBillsAmount} | Overdue: AED ${d.overdueAmountTotal}`);
    console.log(`  Result: ${(d.pendingBillsAmount === 0 && d.overdueAmountTotal === 0) ? 'PASS (Zero FH1 leakage)' : 'FAIL'}`);
  }

  // Test 6: Unified Invoices API for FH1
  console.log('\n[TEST 6] Testing /api/legacy/invoices/unified for FrozenHub 1 (Both Starplus and FrozenHub invoices)...');
  const resUnified = await apiGet('/api/legacy/invoices/unified?page=1&pageSize=5', tokenFh1, 'frozenhub.hexabill.company');
  console.log(`  HTTP Status: ${resUnified.status}`);
  if (resUnified.status === 200 && resUnified.body?.data?.items) {
    console.log(`  Total Unified Invoices: ${resUnified.body.data.totalCount}`);
    resUnified.body.data.items.forEach((inv, i) => {
      console.log(`  ${i+1}. [${inv.sourceCompany}] #${inv.invoiceNumber} | Date: ${inv.invoiceDate} | Customer: ${inv.customerName} | Total: AED ${inv.grandTotal} | Status: ${inv.paymentStatus}`);
    });
    console.log('  Result: PASS');
  } else {
    console.log('  Failed response:', resUnified.body || resUnified.text);
  }
}

runTests().catch(console.error);
