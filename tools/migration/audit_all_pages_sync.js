const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

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
    "tslug": slug, "nbf": now, "exp": now + 28800, "iat": now, "iss": "HexaBill.Api", "aud": "HexaBill.Api"
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const sig = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(unsigned).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${unsigned}.${sig}`;
}

const token = createToken(34, "frozenhubfoods@gmail.com", "Vahid Shamsudheen", 20, "frozenhub", "Owner", "0");

function apiGet(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'hexabill.onrender.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      servername: 'hexabill.onrender.com',
      headers: {
        'Authorization': `Bearer ${token}`,
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
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    req.end();
  });
}

async function audit() {
  console.log('===============================================================');
  console.log('HEXABILL ERP — END-TO-END DATA SYNC & PAGE INTEGRITY AUDIT');
  console.log('Tenant 20 (FrozenHub 1) — Continuous Business Continuity');
  console.log('===============================================================\n');

  const report = {};

  // 1. Dashboard Custom Range (All time: 2024-01-01 to 2026-11-01)
  console.log('[1/12] Checking /api/reports/summary (All-time Custom)...');
  const dashCustom = await apiGet('/api/reports/summary?fromDate=2024-01-01&toDate=2026-11-01&refresh=true');
  const dCust = dashCustom.body?.data || dashCustom.body;
  report.dashboardCustom = {
    status: dashCustom.status,
    salesToday: dCust?.salesToday,
    purchasesToday: dCust?.purchasesToday,
    expensesToday: dCust?.expensesToday,
    profitToday: dCust?.profitToday,
    cashCollectionsTotal: dCust?.cashCollectionsTotal,
    pendingBills: dCust?.pendingBills,
    pendingBillsAmount: dCust?.pendingBillsAmount,
    overdueAmountTotal: dCust?.overdueAmountTotal,
    overdueCustomersCount: dCust?.overdueCustomersCount,
    pendingInvoicesCount: dCust?.pendingInvoices?.length
  };
  console.log('Dashboard Custom Results:', report.dashboardCustom);

  // 2. Sales Ledger Comprehensive
  console.log('\n[2/12] Checking /api/reports/sales-ledger (All dates)...');
  const salesLedger = await apiGet('/api/reports/sales-ledger');
  const sLed = salesLedger.body?.data || salesLedger.body;
  report.salesLedger = {
    status: salesLedger.status,
    totalEntries: sLed?.entries?.length || sLed?.totalCount,
    totalSales: sLed?.totalSales,
    totalReceived: sLed?.totalReceived,
    totalPending: sLed?.totalPending,
    totalExpenses: sLed?.totalExpenses
  };
  console.log('Sales Ledger Results:', report.salesLedger);

  // 3. Billing History & Sales API
  console.log('\n[3/12] Checking /api/sales and /api/legacy/invoices/unified...');
  const salesApi = await apiGet('/api/sales?page=1&pageSize=50');
  const unifiedInvoices = await apiGet('/api/legacy/invoices/unified?page=1&pageSize=50');
  report.billingHistory = {
    operatingCount: salesApi.body?.data?.totalCount ?? salesApi.body?.totalCount,
    unifiedCount: unifiedInvoices.body?.data?.totalCount ?? unifiedInvoices.body?.totalCount
  };
  console.log('Billing History Results:', report.billingHistory);

  // 4. Pending Bills API
  console.log('\n[4/12] Checking /api/reports/pending...');
  const pendingApi = await apiGet('/api/reports/pending?pageSize=100');
  const pData = pendingApi.body?.data || pendingApi.body;
  const pItems = pData?.items || [];
  let pSum = 0;
  pItems.forEach(i => pSum += (i.balanceAmount || 0));
  report.pendingBills = {
    status: pendingApi.status,
    totalCount: pData?.totalCount,
    returnedItems: pItems.length,
    calculatedTotal: pSum.toFixed(2)
  };
  console.log('Pending Bills Results:', report.pendingBills);

  // 5. Customer Ledger & Customers List
  console.log('\n[5/12] Checking /api/customers and sample customer ledgers...');
  const custApi = await apiGet('/api/customers?page=1&pageSize=100');
  const custList = custApi.body?.data?.items || custApi.body?.items || [];
  report.customers = {
    status: custApi.status,
    totalCustomers: custApi.body?.data?.totalCount ?? custApi.body?.totalCount,
    sampleCustomers: []
  };
  // Test sample key customers: 143 (Abayan), 136 (Chawarma Aalmashi), 137 (Dar Al Mandi Mumaiz)
  for (const cId of [143, 136, 137]) {
    const cLed = await apiGet(`/api/customers/${cId}/ledger`);
    const cSummary = await apiGet(`/api/customers/${cId}`);
    report.customers.sampleCustomers.push({
      customerId: cId,
      name: cSummary.body?.data?.name || cSummary.body?.name,
      ledgerInvoices: cLed.body?.data?.invoices?.length || cLed.body?.invoices?.length,
      currentBalance: cSummary.body?.data?.currentBalance || cSummary.body?.currentBalance,
      openingBalance: cSummary.body?.data?.openingBalance || cSummary.body?.openingBalance
    });
  }
  console.log('Customers Results:', report.customers);

  // 6. Payments API
  console.log('\n[6/12] Checking /api/payments...');
  const payApi = await apiGet('/api/payments?page=1&pageSize=50');
  report.payments = {
    status: payApi.status,
    totalCount: payApi.body?.data?.totalCount ?? payApi.body?.totalCount
  };
  console.log('Payments API Results:', report.payments);

  // 7. Purchases API & Legacy Purchases
  console.log('\n[7/12] Checking /api/purchases and /api/legacy/purchases...');
  const purchApi = await apiGet('/api/purchases?page=1&pageSize=50');
  const legPurchApi = await apiGet('/api/legacy/purchases?page=1&pageSize=50');
  report.purchases = {
    operatingCount: purchApi.body?.data?.totalCount ?? purchApi.body?.totalCount,
    legacyCount: legPurchApi.body?.data?.totalCount ?? legPurchApi.body?.totalCount
  };
  console.log('Purchases Results:', report.purchases);

  // 8. Suppliers API
  console.log('\n[8/12] Checking /api/suppliers...');
  const suppApi = await apiGet('/api/suppliers');
  report.suppliers = {
    status: suppApi.status,
    count: suppApi.body?.data?.length || suppApi.body?.length
  };
  console.log('Suppliers Results:', report.suppliers);

  // 9. Expenses API & Legacy Expenses
  console.log('\n[9/12] Checking /api/expenses and /api/legacy/expenses...');
  const expApi = await apiGet('/api/expenses?page=1&pageSize=50');
  const legExpApi = await apiGet('/api/legacy/expenses?page=1&pageSize=50');
  report.expenses = {
    operatingCount: expApi.body?.data?.totalCount ?? expApi.body?.totalCount,
    legacyCount: legExpApi.body?.data?.totalCount ?? legExpApi.body?.totalCount
  };
  console.log('Expenses Results:', report.expenses);

  // 10. Reports Tabs APIs
  console.log('\n[10/12] Checking Reports Tabs APIs (sales, products, aging, worksheet)...');
  const rSales = await apiGet('/api/reports/sales?from=2025-01-01&to=2026-11-01&page=1&pageSize=10');
  const rAging = await apiGet('/api/reports/aging?asOfDate=2026-11-01');
  const rWorksheet = await apiGet('/api/reports/worksheet?fromDate=2025-01-01&toDate=2026-11-01');
  report.reportsTabs = {
    salesReportCount: rSales.body?.data?.totalCount ?? rSales.body?.totalCount,
    agingStatus: rAging.status,
    agingTotal: rAging.body?.data?.totalReceivables ?? rAging.body?.totalReceivables,
    worksheetStatus: rWorksheet.status,
    worksheetData: rWorksheet.body?.data || rWorksheet.body
  };
  console.log('Reports Tabs Results:', report.reportsTabs);

  // 11. Daily Close & VAT Return
  console.log('\n[11/12] Checking Daily Close & VAT Return APIs...');
  const dailyClose = await apiGet('/api/daily-close/today');
  const vatReturn = await apiGet('/api/reports/vat-return');
  report.dailyCloseAndVat = {
    dailyCloseStatus: dailyClose.status,
    vatReturnStatus: vatReturn.status,
    vatReturnBox13a: vatReturn.body?.data?.box13a || vatReturn.body?.box13a,
    vatReturnBox13b: vatReturn.body?.data?.box13b || vatReturn.body?.box13b
  };
  console.log('Daily Close & VAT Results:', report.dailyCloseAndVat);

  fs.writeFileSync('artifacts/reconciliation/full_system_audit.json', JSON.stringify(report, null, 2));
  console.log('\n[AUDIT COMPLETE] Persisted to artifacts/reconciliation/full_system_audit.json');
}

audit().catch(console.error);

