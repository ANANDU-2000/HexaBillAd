const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/hexabill-ui/src/features/customers/CustomerDetailPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Ensure import
if (!content.includes('import LegacyInvoiceDetailModal')) {
  content = content.replace(
    "import { navigationUrl } from '../../utils/shopLocation'",
    "import { navigationUrl } from '../../utils/shopLocation'\nimport LegacyInvoiceDetailModal from '../../components/LegacyInvoiceDetailModal'"
  );
}

// Ensure state
if (!content.includes('selectedLegacyInvoiceId')) {
  content = content.replace(
    "const [legacyLoading, setLegacyLoading] = useState(false)",
    "const [legacyLoading, setLegacyLoading] = useState(false)\n  const [selectedLegacyInvoiceId, setSelectedLegacyInvoiceId] = useState(null)"
  );
}

// Update table header if needed
if (!content.includes('<th className="px-3 py-2 text-center">Action</th>')) {
  content = content.replace(
    '<th className="px-3 py-2 text-center">Status</th>',
    '<th className="px-3 py-2 text-center">Status</th>\n                  <th className="px-3 py-2 text-center">Action</th>'
  );
}

// Update table row action button
const rowTarget = `<td className="px-3 py-2 text-center">
                      <span className={\`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium \${
                        inv.outstandingCalculated <= 0.005 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }\`}>
                        {inv.outstandingCalculated <= 0.005 ? 'Paid' : 'Pending'}
                      </span>
                    </td>`;

const rowAltTarget = rowTarget.replace(/\n/g, '\r\n');

const rowReplacement = `<td className="px-3 py-2 text-center">
                      <span className={\`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium \${
                        inv.outstandingCalculated <= 0.005 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }\`}>
                        {inv.outstandingCalculated <= 0.005 ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedLegacyInvoiceId(inv.id)}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition"
                      >
                        View
                      </button>
                    </td>`;

if (content.includes(rowTarget)) {
  content = content.replace(rowTarget, rowReplacement);
} else if (content.includes(rowAltTarget)) {
  content = content.replace(rowAltTarget, rowReplacement.replace(/\n/g, '\r\n'));
}

// Add modal before closing div
const modalInjection = `      {selectedLegacyInvoiceId && (
        <LegacyInvoiceDetailModal
          invoiceId={selectedLegacyInvoiceId}
          isOpen={!!selectedLegacyInvoiceId}
          onClose={() => setSelectedLegacyInvoiceId(null)}
        />
      )}
    </div>
  )
}`;

const modalTarget = `    </div>\n  )\n}`;
const modalAltTarget = `    </div>\r\n  )\r\n}`;

if (!content.includes('LegacyInvoiceDetailModal\n          invoiceId') && !content.includes('LegacyInvoiceDetailModal\r\n          invoiceId')) {
  if (content.includes(modalTarget)) {
    content = content.replace(modalTarget, modalInjection);
  } else if (content.includes(modalAltTarget)) {
    content = content.replace(modalAltTarget, modalInjection.replace(/\n/g, '\r\n'));
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('CustomerDetailPage updated successfully!');
