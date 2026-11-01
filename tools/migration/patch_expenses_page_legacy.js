const fs = require('fs');
const path = require('path');

const filePath = path.resolve('frontend/hexabill-ui/src/features/expenses/ExpensesPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Import legacyAPI
const importTarget = `import { expensesAPI, reportsAPI } from '../../services/index'`;
const importReplacement = `import { expensesAPI, reportsAPI, legacyAPI } from '../../services/index'`;
if (!content.includes(importTarget)) {
    console.error('Import target not found in ExpensesPage.jsx');
    process.exit(1);
}
content = content.replace(importTarget, importReplacement);

// 2. Add isFrozenHub1 and activeTab state
const stateTarget = `  const [totalPages, setTotalPages] = useState(1)`;
const stateReplacement = `  const [totalPages, setTotalPages] = useState(1)
  const isFrozenHub1 = user?.tenantId === 20 || (typeof window !== 'undefined' && window.location.hostname.includes('frozenhub'))
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'operating')`;
content = content.replace(stateTarget, stateReplacement);

// 3. Switch between operating and legacy in fetchExpenses
const fetchTarget = `      const response = await expensesAPI.getExpenses(params)`;
const fetchReplacement = `      let response
      if (isFrozenHub1 && activeTab === 'legacy') {
        response = await legacyAPI.getExpenses({
          page: currentPage,
          pageSize: 25,
          search: debouncedSearch || undefined,
          fromDate: dateRange.from,
          toDate: dateRange.to
        })
      } else {
        response = await expensesAPI.getExpenses(params)
      }`;
content = content.replace(fetchTarget, fetchReplacement);

// 4. Update dependencies of fetchExpenses to include activeTab
const depTarget = `  }, [currentPage, dateRange.from, dateRange.to, selectedBranchId, selectedCategory, debouncedSearch, groupBy, filterNoVatOnly])`;
const depReplacement = `  }, [currentPage, dateRange.from, dateRange.to, selectedBranchId, selectedCategory, debouncedSearch, groupBy, filterNoVatOnly, activeTab])`;
content = content.replace(depTarget, depReplacement);

// 5. Add tabs in header
const headerTarget = `          <div>
            <h1 className="hidden text-xl font-semibold text-neutral-900 md:block">Expenses</h1>`;
const headerReplacement = `          <div>
            <div className="flex items-center gap-3">
              <h1 className="hidden text-xl font-semibold text-neutral-900 md:block">Expenses</h1>
              {isFrozenHub1 && (
                <div className="flex items-center gap-2 border-b border-neutral-200">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('operating'); setCurrentPage(1); }}
                    className={\`pb-1 text-xs sm:text-sm font-semibold border-b-2 transition-colors \${
                      activeTab === 'operating' ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-700'
                    }\`}
                  >
                    Operating
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('legacy'); setCurrentPage(1); }}
                    className={\`pb-1 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1 \${
                      activeTab === 'legacy' ? 'border-amber-600 text-amber-800' : 'border-transparent text-neutral-500 hover:text-neutral-700'
                    }\`}
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                    Historical (Starplus · 242)
                  </button>
                </div>
              )}
            </div>`;
content = content.replace(headerTarget, headerReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('ExpensesPage.jsx successfully patched with legacy Starplus tab!');

