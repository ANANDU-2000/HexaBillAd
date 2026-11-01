const fs = require('fs');
const file = 'frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = "const [dateRange, setDateRange] = useState(() => {\r\n    const fromParam = searchParams.get('from')\r\n    const toParam = searchParams.get('to')\r\n    if (fromParam && toParam) return { from: fromParam, to: toParam }\r\n    const now = new Date()\r\n    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)\r\n    return {\r\n      from: localDateString(monthStart),\r\n      to: localDateString(now)\r\n    }\r\n  })";

const repl = "const [dateRange, setDateRange] = useState(() => {\r\n    const fromParam = searchParams.get('from')\r\n    const toParam = searchParams.get('to')\r\n    if (fromParam && toParam) return { from: fromParam, to: toParam }\r\n    return { from: '', to: '' }\r\n  })";

if (content.includes(target)) {
  content = content.replace(target, repl);
  fs.writeFileSync(file, content, 'utf8');
  console.log('[PASS] Replaced dateRange default in CustomerLedgerPage.jsx');
} else {
  console.log('[FAIL] Target not found');
}

