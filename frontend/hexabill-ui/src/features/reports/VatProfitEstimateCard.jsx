import { formatCurrency } from '../../utils/currency'

// Profit-based VAT: 5% of (sales margin - expenses). Shown for tenants set to ProfitBased.
export default function VatProfitEstimateCard({ report }) {
  if (String(report?.vatCalculationBasis ?? report?.VatCalculationBasis ?? 'SalesBased') !== 'ProfitBased') return null
  const value = (key) => report?.[key[0].toLowerCase() + key.slice(1)] ?? report?.[key]
  const sales = Number(value('ProfitSales') ?? 0)
  const cogs = Number(value('ProfitCogs') ?? 0)
  const expenses = Number(value('ProfitExpenses') ?? 0)
  const netProfit = Number(value('ProfitAmount') ?? 0)
  const grossProfit = sales - cogs
  const estimate = value('ProfitVatEstimate')
  const available = estimate != null && Number.isFinite(Number(estimate))
  const daily = value('ProfitDaily') || []

  return (
    <section aria-label="Profit-based VAT" className="mt-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs font-medium text-neutral-500">1. Gross profit from sales</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-neutral-900">{formatCurrency(grossProfit)}</p>
          <p className="text-xs text-neutral-500">Sales {formatCurrency(sales)} - product cost {formatCurrency(cogs)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs font-medium text-neutral-500">2. Less: total expenses</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-neutral-900">{formatCurrency(expenses)}</p>
          <p className="text-xs text-neutral-500">Full amounts, no VAT split</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs font-medium text-neutral-500">3. Net profit (after expenses)</p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${netProfit < 0 ? 'text-error-fg' : 'text-neutral-900'}`}>{formatCurrency(netProfit)}</p>
          <p className="text-xs text-neutral-500">Gross profit - expenses</p>
        </div>
        <div className="rounded-xl border-2 border-primary-500 bg-primary-50 p-3">
          <p className="text-xs font-semibold text-primary-800">4. 5% VAT on net profit</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-primary-700">{available ? formatCurrency(Number(estimate)) : 'Refresh to load estimate'}</p>
          <p className="text-xs text-primary-800">Net profit x 5%. Zero when profit is zero or negative.</p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white overflow-x-auto">
        <h3 className="px-3 pt-3 text-sm font-semibold text-neutral-900">Daily profit and 5% VAT (selected period)</h3>
        <table className="mt-2 min-w-full text-xs sm:text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-right font-semibold">Total sales</th>
              <th className="px-3 py-2 text-right font-semibold">Cost of goods</th>
              <th className="px-3 py-2 text-right font-semibold">Gross profit</th>
              <th className="px-3 py-2 text-right font-semibold">Expenses</th>
              <th className="px-3 py-2 text-right font-semibold">Net profit</th>
              <th className="px-3 py-2 text-right font-semibold">5% VAT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {daily.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-neutral-500">No sales or expenses in this period.</td></tr>
            )}
            {daily.map((d) => {
              const date = d.date ?? d.Date
              const net = Number(d.netProfit ?? d.NetProfit ?? 0)
              return (
                <tr key={String(date)}>
                  <td className="px-3 py-2 whitespace-nowrap">{date ? new Date(date).toLocaleDateString('en-GB') : '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(d.sales ?? d.Sales ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(d.cogs ?? d.Cogs ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(d.grossProfit ?? d.GrossProfit ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(d.expenses ?? d.Expenses ?? 0)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${net < 0 ? 'text-error-fg' : ''}`}>{formatCurrency(net)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary-700">{formatCurrency(d.vat ?? d.Vat ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="px-3 pb-3 pt-1 text-xs text-neutral-500">The 5% total above is worked out on the whole period, so negative days offset positive days. Daily figures are shown for checking.</p>
      </div>
    </section>
  )
}
