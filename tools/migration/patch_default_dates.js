const fs = require('fs');

// 1. Patch SalesLedgerPage.jsx
const salesFile = 'frontend/hexabill-ui/src/features/sales/SalesLedgerPage.jsx';
let salesContent = fs.readFileSync(salesFile, 'utf8');
if (salesContent.includes('return getDefaultDateRange()')) {
  salesContent = salesContent.replace('return getDefaultDateRange()', "return { from: '', to: '' }");
  fs.writeFileSync(salesFile, salesContent, 'utf8');
  console.log('[PASS] Updated SalesLedgerPage.jsx default dateRange to all dates');
} else {
  console.log('[WARN] Target not found in SalesLedgerPage.jsx');
}

// 2. Patch CustomerLedgerPage.jsx
const custFile = 'frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx';
let custContent = fs.readFileSync(custFile, 'utf8');
const custTarget = `    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      from: localDateString(monthStart),
      to: localDateString(now)
    }`;

const custTargetLf = custTarget.replace(/\r?\n/g, '\n');
const custContentLf = custContent.replace(/\r?\n/g, '\n');

if (custContentLf.includes(custTargetLf)) {
  const repl = `    return {
      from: '',
      to: ''
    }`;
  custContent = custContentLf.replace(custTargetLf, repl);
  fs.writeFileSync(custFile, custContent, 'utf8');
  console.log('[PASS] Updated CustomerLedgerPage.jsx default dateRange to all dates');
} else {
  console.log('[WARN] Target not found in CustomerLedgerPage.jsx');
}

// 3. Patch DashboardTally.jsx for Last Month button
const dashFile = 'frontend/hexabill-ui/src/features/dashboard/DashboardTally.jsx';
let dashContent = fs.readFileSync(dashFile, 'utf8');
if (dashContent.includes("case 'month': {") && !dashContent.includes("case 'lastMonth': {")) {
  const target = `            case 'month': {
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                return { from: localDateString(monthStart), to: todayStr }
            }`;
  const repl = `            case 'month': {
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                return { from: localDateString(monthStart), to: todayStr }
            }
            case 'lastMonth': {
                const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
                const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
                return { from: localDateString(lastMonthStart), to: localDateString(lastMonthEnd) }
            }`;
  const targetLf = target.replace(/\r?\n/g, '\n');
  const dashContentLf = dashContent.replace(/\r?\n/g, '\n');
  if (dashContentLf.includes(targetLf)) {
    dashContent = dashContentLf.replace(targetLf, repl);

    // Also add button
    const btnTarget = `<button type="button" onClick={() => applyPeriod('month')} className={periodChip(dateRange === 'month')} aria-pressed={dateRange === 'month'}>Month</button>`;
    const btnRepl = `<button type="button" onClick={() => applyPeriod('month')} className={periodChip(dateRange === 'month')} aria-pressed={dateRange === 'month'}>Month</button>
                        <button type="button" onClick={() => applyPeriod('lastMonth')} className={periodChip(dateRange === 'lastMonth')} aria-pressed={dateRange === 'lastMonth'}>Last Month</button>`;
    dashContent = dashContent.replace(btnTarget, btnRepl);
    fs.writeFileSync(dashFile, dashContent, 'utf8');
    console.log('[PASS] Updated DashboardTally.jsx with lastMonth period support');
  }
}

