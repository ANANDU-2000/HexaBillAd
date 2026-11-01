const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/hexabill-ui/src/features/customers/CustomerDetailPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = '      </div>\n    </div>\n  )\n}';
const altTarget = '      </div>\r\n    </div>\r\n  )\r\n}';

const injection = `      </div>

      {/* Historical Starplus Legacy Archive (If Customer Has Migrated Bills) */}
      {legacyInvoices.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-neutral-900">
                Starplus Legacy Archive ({legacyInvoices.length} historical bills)
              </h2>
            </div>
            <Link
              to={\`/legacy/invoices?search=\${encodeURIComponent(customer?.name || '')}\`}
              className="text-xs font-medium text-primary-700 hover:underline"
            >
              View in full archive &rarr;
            </Link>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <strong>Historical Reference Only:</strong> These invoices were issued by Starplus Foodstuff Trading prior to cutover.
            Approved opening balance was transferred to FrozenHub 1 without reissuing historical tax invoices.
          </div>

          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="min-w-full divide-y divide-neutral-200 text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold">
                <tr>
                  <th className="px-3 py-2 text-left">Inv #</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Historical Paid</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {legacyInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 font-medium text-neutral-900">#{inv.legacyInvoiceNumber}</td>
                    <td className="px-3 py-2 text-neutral-600">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right font-medium text-neutral-900">{formatCurrency(inv.grandTotal)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-medium">{formatCurrency(inv.paidAmount)}</td>
                    <td className={\`px-3 py-2 text-right font-bold \${inv.outstandingCalculated > 0.005 ? 'text-rose-600' : 'text-neutral-400'}\`}>
                      {inv.outstandingCalculated > 0.005 ? formatCurrency(inv.outstandingCalculated) : 'AED 0.00'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={\`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium \${
                        inv.outstandingCalculated <= 0.005 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }\`}>
                        {inv.outstandingCalculated <= 0.005 ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}`;

if (content.includes(target)) {
  content = content.replace(target, injection);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESS with LF');
} else if (content.includes(altTarget)) {
  content = content.replace(altTarget, injection.replace(/\n/g, '\r\n'));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESS with CRLF');
} else {
  console.log('Target not found in file');
}

