const fs = require('fs');
const file = 'frontend/hexabill-ui/src/features/purchases/PurchasesPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
if (!content.includes('LegacyPurchaseDetailModal')) {
  content = content.replace(
    "import ProductPicker from './ProductPicker'",
    "import ProductPicker from './ProductPicker'\nimport { legacyAPI } from '../../services/index'\nimport LegacyPurchaseDetailModal from '../../components/LegacyPurchaseDetailModal'"
  );
}

// 2. Add activeTab and modal states
if (!content.includes('selectedLegacyPurchaseId')) {
  content = content.replace(
    "const [totalPages, setTotalPages] = useState(1)",
    `const [totalPages, setTotalPages] = useState(1)
  const isFrozenHub1 = authUser?.tenantId === 20 || (typeof window !== 'undefined' && window.location.hostname.includes('frozenhub'))
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'operating')
  const [selectedLegacyPurchaseId, setSelectedLegacyPurchaseId] = useState(null)
  const [showLegacyModal, setShowLegacyModal] = useState(false)`
  );
}

// 3. Update loadPurchases to support activeTab === 'legacy'
const oldLoadPurchasesRegex = /const loadPurchases = async \(\) => {[\s\S]*?const response = await purchasesAPI\.getPurchases\(params\)[\s\S]*?if \(response\.success\) {[\s\S]*?setPurchases\(response\.data\.items\)[\s\S]*?setTotalPages\(response\.data\.totalPages\)[\s\S]*?setListError\(false\)[\s\S]*?} else {[\s\S]*?setListError\(true\)[\s\S]*?}/;

const newLoadPurchases = `const loadPurchases = async () => {
    try {
      setLoading(true)
      const params = { page: currentPage, pageSize: 15 }

      // Apply date filters based on period
      const dateRange = getDateRangeFromPeriod(filterPeriod)
      if (dateRange.startDate) params.startDate = dateRange.startDate
      if (dateRange.endDate) params.endDate = dateRange.endDate

      // Custom date range
      if (filterPeriod === 'custom') {
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
      }

      // Apply supplier filter
      if (supplierSearch) params.supplierName = supplierSearch

      // Apply category filter
      if (categoryFilter) params.category = categoryFilter

      // Apply status filter (paid, partial, unpaid, overdue)
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter

      if (activeTab === 'legacy') {
        const response = await legacyAPI.getPurchases(params)
        if (response?.success && response?.data) {
          setPurchases(response.data.items || [])
          setTotalPages(response.data.totalPages || 1)
          setListError(false)
        } else {
          setListError(true)
        }
      } else {
        const response = await purchasesAPI.getPurchases(params)
        if (response.success) {
          setPurchases(response.data.items)
          setTotalPages(response.data.totalPages)
          setListError(false)
        } else {
          setListError(true)
        }
      }`;

if (oldLoadPurchasesRegex.test(content)) {
  content = content.replace(oldLoadPurchasesRegex, newLoadPurchases);
} else {
  console.log('loadPurchases regex did not match exactly, checking alternative');
}

// 4. Trigger reload on activeTab change
if (!content.includes('activeTab') || !content.includes('loadPurchases(); // tab changed')) {
  content = content.replace(
    'useEffect(() => {\n    loadPurchases()\n  }, [currentPage, filterPeriod, startDate, endDate, supplierSearch, categoryFilter, statusFilter])',
    `useEffect(() => {\n    loadPurchases()\n  }, [currentPage, activeTab, filterPeriod, startDate, endDate, supplierSearch, categoryFilter, statusFilter])`
  );
}

// 5. Add tabs UI in header
const headerTarget = '<h1 className="text-xl font-semibold text-neutral-900">Purchases</h1>';
const headerReplacement = `<h1 className="text-xl font-semibold text-neutral-900">Purchases</h1>
          {isFrozenHub1 && (
            <div className="flex items-center gap-3 border-b border-neutral-200 mt-1 sm:mt-0">
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
                Historical (Starplus · 1,563)
              </button>
            </div>
          )}`;

if (content.includes(headerTarget) && !content.includes('Historical (Starplus · 1,563)')) {
  content = content.replace(headerTarget, headerReplacement);
}

// 6. Add LegacyPurchaseDetailModal before the last closing tags
if (!content.includes('<LegacyPurchaseDetailModal')) {
  const modalTarget = '</Modal>\n    </div>\n  )\n}';
  const modalReplacement = `</Modal>
      {showLegacyModal && selectedLegacyPurchaseId && (
        <LegacyPurchaseDetailModal
          purchaseId={selectedLegacyPurchaseId}
          isOpen={showLegacyModal}
          onClose={() => {
            setShowLegacyModal(false)
            setSelectedLegacyPurchaseId(null)
          }}
        />
      )}
    </div>
  )
}`;
  if (content.includes(modalTarget)) {
    content = content.replace(modalTarget, modalReplacement);
  } else {
    // fallback
    const lastDiv = content.lastIndexOf('</div>\n  )\n}');
    if (lastDiv !== -1) {
      content = content.slice(0, lastDiv) + `
      {showLegacyModal && selectedLegacyPurchaseId && (
        <LegacyPurchaseDetailModal
          purchaseId={selectedLegacyPurchaseId}
          isOpen={showLegacyModal}
          onClose={() => {
            setShowLegacyModal(false)
            setSelectedLegacyPurchaseId(null)
          }}
        />
      )}
    </div>
  )
}`;
    }
  }
}

// 7. Add view action for legacy row
const legacyActionTarget = '<OverflowMenu label={`More actions for ${purchase.invoiceNo}`} items={purchaseMenuItems(purchase)} />';
const legacyActionReplacement = `{activeTab === 'legacy' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLegacyPurchaseId(purchase.id)
                                    setShowLegacyModal(true)
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200"
                                >
                                  <Eye className="h-3.5 w-3.5" /> View
                                </button>
                              ) : (
                                <OverflowMenu label={\`More actions for \${purchase.invoiceNo}\`} items={purchaseMenuItems(purchase)} />
                              )}`;

if (content.includes(legacyActionTarget)) {
  content = content.replace(legacyActionTarget, legacyActionReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated PurchasesPage.jsx');

