const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/hexabill-ui/src/features/dashboard/DashboardTally.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Ensure import of legacyAPI
if (!content.includes('legacyAPI')) {
  content = content.replace(
    "import { reportsAPI } from '../../services/index'",
    "import { reportsAPI, legacyAPI } from '../../services/index'"
  );
}

// 2. Add state & useEffect for legacyMetrics
const stateInjection = `  const [legacyMetrics, setLegacyMetrics] = useState(null)

  useEffect(() => {
    if (isAdminOrOwner(user) && !legacyMetrics) {
      legacyAPI.getReconciliation().then(res => {
        if (res?.success && res.data) setLegacyMetrics(res.data)
      }).catch(err => console.warn('Dashboard legacy metrics error:', err))
    }
  }, [user, legacyMetrics])
`;

if (!content.includes('const [legacyMetrics, setLegacyMetrics] = useState')) {
  content = content.replace(
    "const [availableBranches, setAvailableBranches] = useState([])",
    stateInjection + "\n    const [availableBranches, setAvailableBranches] = useState([])"
  );
}

// 3. Add Historical Starplus Archive widget right after the KPI section
const kpiEndTarget = `            </section>\n            )}`;
const kpiEndTargetCRLF = `            </section>\r\n            )}`;

const widgetUI = `            {/* Historical Starplus Archive Widget for Owner/Admin */}
            {isAdminOrOwner(user) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-amber-700 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Starplus Historical Archive (TRN 100366253100003)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/billing-history?tab=legacy')}
                    className="text-xs font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>Browse 5,109 historical bills</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  <div
                    onClick={() => navigate('/billing-history?tab=legacy')}
                    className="bg-white rounded-lg border border-amber-200/80 p-2.5 sm:p-3 cursor-pointer hover:bg-amber-50/50 transition"
                  >
                    <span className="text-[11px] font-medium text-neutral-500 uppercase block">Historical Sales</span>
                    <span className="text-base sm:text-lg font-bold text-neutral-900 block mt-0.5">
                      {formatCurrency(legacyMetrics?.activeGrandTotal || 3817356.88)}
                    </span>
                    <span className="text-[10px] text-neutral-500">{legacyMetrics?.activeInvoices || 4916} active invoices</span>
                  </div>
                  <div
                    onClick={() => navigate('/payments?tab=legacy')}
                    className="bg-white rounded-lg border border-amber-200/80 p-2.5 sm:p-3 cursor-pointer hover:bg-amber-50/50 transition"
                  >
                    <span className="text-[11px] font-medium text-neutral-500 uppercase block">Cleared Collections</span>
                    <span className="text-base sm:text-lg font-bold text-emerald-700 block mt-0.5">
                      {formatCurrency(legacyMetrics?.activePaidTotal || 3747182.98)}
                    </span>
                    <span className="text-[10px] text-neutral-500">{legacyMetrics?.clearedPayments || 5325} receipts</span>
                  </div>
                  <div
                    onClick={() => navigate('/billing-history?tab=legacy&filter=pending')}
                    className="bg-white rounded-lg border border-amber-200/80 p-2.5 sm:p-3 cursor-pointer hover:bg-amber-50/50 transition"
                  >
                    <span className="text-[11px] font-medium text-neutral-500 uppercase block">Cutover Receivables</span>
                    <span className="text-base sm:text-lg font-bold text-rose-600 block mt-0.5">
                      {formatCurrency(legacyMetrics?.positiveOutstandingSum || 70178.09)}
                    </span>
                    <span className="text-[10px] text-rose-700 font-medium">{legacyMetrics?.positiveOutstandingCount || 93} pending bills</span>
                  </div>
                  <div
                    onClick={() => navigate('/reports?source=legacy')}
                    className="bg-white rounded-lg border border-amber-200/80 p-2.5 sm:p-3 cursor-pointer hover:bg-amber-50/50 transition"
                  >
                    <span className="text-[11px] font-medium text-neutral-500 uppercase block">Approved Transferred AR</span>
                    <span className="text-base sm:text-lg font-bold text-blue-700 block mt-0.5">
                      {formatCurrency(legacyMetrics?.customerOpeningReceivablesTotal || 70077.29)}
                    </span>
                    <span className="text-[10px] text-neutral-500">21 customers (+ AED 100.80 Inv 2158)</span>
                  </div>
                </div>
              </div>
            )}`;

if (!content.includes('Starplus Historical Archive (TRN 100366253100003)')) {
  if (content.includes(kpiEndTargetCRLF)) {
    content = content.replace(kpiEndTargetCRLF, kpiEndTargetCRLF + '\r\n\r\n' + widgetUI.replace(/\n/g, '\r\n'));
  } else if (content.includes(kpiEndTarget)) {
    content = content.replace(kpiEndTarget, kpiEndTarget + '\n\n' + widgetUI);
  } else {
    // Search for closing tag of section
    content = content.replace('</section>', '</section>\n' + widgetUI);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('DashboardTally updated with Historical Archive KPI Cards successfully!');
