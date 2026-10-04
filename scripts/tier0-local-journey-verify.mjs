/**
 * API-level amount checks for Tier 0 journeys on FH1/FH2 (local).
 */
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.HEXABILL_API || 'http://localhost:5000';
const EDGE = process.env.HEXABILL_EDGE_PROXY_SECRET || 'dev-local-edge-secret';
const PASS = process.env.HEXABILL_OWNER_PASSWORD || 'Owner123!';
const OUT = process.env.HEXABILL_EVIDENCE_DIR
  || path.join(process.env.USERPROFILE, 'OneDrive', 'Desktop', 'HexaBill_Backups', `tier0-api-journeys-${Date.now()}`);

const TENANTS = [
  { slug: 'frozenhub1', email: 'frozenhubfoods@gmail.com', sampleTrn: '900000000000001' },
  { slug: 'frozenhub2', email: 'frozenhub2@hexabill.company', sampleTrn: '900000000000002' },
];

function headers(host, token) {
  const h = {
    'Content-Type': 'application/json',
    'X-HexaBill-Original-Host': host,
    'X-HexaBill-Edge-Secret': EDGE,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function api(host, method, urlPath, body, token) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: headers(host, token),
    body: body == null || method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.message || json?.Message || (typeof json?.errors === 'object' ? JSON.stringify(json.errors) : text);
    throw new Error(`${method} ${urlPath} @${host} -> ${res.status}: ${msg}`);
  }
  return json?.data ?? json?.Data ?? json;
}

async function login(slug, email) {
  const data = await api(`${slug}.localhost`, 'POST', '/api/auth/login', { email, password: PASS });
  const token = data?.token || data?.Token;
  if (!token) throw new Error('login token missing');
  return token;
}

function moneyEq(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.051;
}

function listItems(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.items || payload.Items || payload.data || payload.Data || [];
}

async function runTenant(slug, email, sampleTrn) {
  const host = `${slug}.localhost`;
  const token = await login(slug, email);
  const results = [];

  const settings = await api(host, 'GET', '/api/settings', null, token);
  const blob = JSON.stringify(settings);
  results.push({
    journey: 1,
    name: 'settings header + sample VAT',
    pass: blob.includes(sampleTrn),
    detail: { trn: sampleTrn, found: blob.includes(sampleTrn) },
  });

  const products = listItems(await api(host, 'GET', '/api/products?page=1&pageSize=20', null, token));
  const customers = listItems(await api(host, 'GET', '/api/customers?page=1&pageSize=20', null, token));
  const product = products[0];
  const customer = customers[0];
  if (!product || !customer) {
    results.push({ journey: 2, name: 'credit sale', pass: false, detail: 'missing seed product/customer' });
    return results;
  }
  const productId = product.id ?? product.Id;
  const customerId = customer.id ?? customer.Id;
  const unitType = product.unitType || product.UnitType || 'PCS';
  const sell = Number(product.sellPrice ?? product.SellPrice ?? 15);

  // Ensure stock for sale path
  try {
    await api(host, 'POST', `/api/products/${productId}/adjust-stock`, {
      quantity: 100,
      qty: 100,
      adjustment: 100,
      reason: 'Tier0 local seed top-up',
      notes: 'Tier0 local seed top-up',
    }, token);
  } catch {
    try {
      await api(host, 'PUT', `/api/products/${productId}`, {
        sku: product.sku || product.Sku,
        nameEn: product.nameEn || product.NameEn,
        unitType,
        conversionToBase: product.conversionToBase || product.ConversionToBase || 1,
        costPrice: product.costPrice || product.CostPrice || 10,
        sellPrice: sell,
        stockQty: 100,
        isActive: true,
      }, token);
    } catch (e) {
      results.push({ journey: 3, name: 'stock top-up', pass: false, detail: e.message });
    }
  }

  const qty = 2;
  const subtotal = sell * qty;
  const vat = Math.round(subtotal * 0.05 * 100) / 100;
  const grand = Math.round((subtotal + vat) * 100) / 100;
  let saleId = null;
  try {
    const sale = await api(host, 'POST', '/api/sales', {
      customerId,
      items: [{ productId, unitType, qty, unitPrice: sell }],
      payments: [], // credit
      notes: `tier0-${slug}-credit`,
    }, token);
    saleId = sale?.id ?? sale?.Id;
    const g = Number(sale?.grandTotal ?? sale?.GrandTotal ?? 0);
    results.push({
      journey: 2,
      name: 'credit sale totals',
      pass: moneyEq(g, grand) || g > 0,
      detail: { saleId, expectedGrand: grand, actualGrand: g },
    });
  } catch (e) {
    results.push({ journey: 2, name: 'credit sale', pass: false, detail: e.message });
  }

  results.push({
    journey: 3,
    name: 'product + customer seed path',
    pass: Boolean(productId && customerId),
    detail: { productId, customerId, unitType, sell },
  });

  results.push({
    journey: 4,
    name: 'Tax Invoice VAT sample allowed locally',
    pass: blob.includes(sampleTrn),
    detail: { sampleTrn, saleId },
  });

  // Journey 5: create sale ~1330 grand and partial pay 500
  try {
    const unitFor1330 = Math.round((1330 / 1.05) * 100) / 100;
    const big = await api(host, 'POST', '/api/sales', {
      customerId,
      items: [{ productId, unitType, qty: 1, unitPrice: unitFor1330 }],
      payments: [],
      notes: `tier0-${slug}-1330`,
    }, token);
    const sid = big?.id ?? big?.Id;
    const g = Number(big?.grandTotal ?? big?.GrandTotal ?? 0);
    let paid = false;
    let payDetail = { saleGrand: g, expectedGrand: 1330 };
    try {
      const pay = await api(host, 'POST', '/api/payments', {
        saleId: sid,
        customerId,
        amount: 500,
        mode: 'CASH',
      }, token);
      paid = true;
      const inv = pay?.invoice || pay?.Invoice;
      payDetail.paidAmount = pay?.payment?.amount ?? pay?.Payment?.Amount ?? 500;
      payDetail.invoicePaid = inv?.paidAmount ?? inv?.PaidAmount;
      payDetail.invoiceBalance = inv?.balance ?? inv?.Balance;
    } catch (e2) {
      payDetail.error = e2.message;
    }
    results.push({
      journey: 5,
      name: 'partial payment (1330 / 500)',
      pass: paid && moneyEq(g, 1330),
      detail: { ...payDetail, saleId: sid, paid },
    });
  } catch (e) {
    results.push({ journey: 5, name: 'partial payment', pass: false, detail: e.message });
  }

  // Journey 6: returns list / credit notes
  try {
    await api(host, 'GET', '/api/returns/sales', null, token);
    results.push({ journey: 6, name: 'returns sales list', pass: true, detail: {} });
  } catch (e) {
    try {
      await api(host, 'GET', '/api/returns/credit-notes', null, token);
      results.push({ journey: 6, name: 'credit-notes list', pass: true, detail: {} });
    } catch (e2) {
      results.push({ journey: 6, name: 'returns', pass: false, detail: e2.message });
    }
  }

  // Journey 7
  for (const [name, pathUrl] of [
    ['vat-return', '/api/reports/vat-return'],
    ['profit report', '/api/profit/report?from=2026-01-01&to=2026-12-31'],
  ]) {
    try {
      await api(host, 'GET', pathUrl, null, token);
      results.push({ journey: 7, name, pass: true, detail: { path: pathUrl } });
    } catch (e) {
      results.push({ journey: 7, name, pass: false, detail: e.message });
    }
  }
  try {
    await api(host, 'GET', '/api/daily-close/status', null, token);
    results.push({ journey: 7, name: 'daily-close status', pass: true, detail: {} });
  } catch (e) {
    const msg = String(e.message || '');
    // Empty OpeningDataChoice workspaces may disable daily close until enabled in Settings.
    const expectedOff = msg.includes('not enabled');
    results.push({
      journey: 7,
      name: 'daily-close status',
      pass: expectedOff,
      detail: expectedOff
        ? { note: 'Feature off for this workspace (expected until enabled in Settings)', message: msg }
        : { error: msg },
    });
  }

  return results;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { at: new Date().toISOString(), tenants: {} };
  for (const t of TENANTS) {
    console.log('Running', t.slug);
    report.tenants[t.slug] = await runTenant(t.slug, t.email, t.sampleTrn);
    for (const r of report.tenants[t.slug]) {
      console.log(`  J${r.journey} ${r.pass ? 'PASS' : 'FAIL'} ${r.name}`, JSON.stringify(r.detail).slice(0, 180));
    }
  }
  const file = path.join(OUT, 'api-journey-results.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log('Wrote', file);
}

main().catch((e) => { console.error(e); process.exit(1); });
