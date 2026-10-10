import { formatCurrency } from '../../utils/currency'

export default function VatProfitEstimateCard({ report }) {
  if (String(report?.vatCalculationBasis ?? report?.VatCalculationBasis ?? 'SalesBased') !== 'ProfitBased') return null
  const value = (key) => report?.[key[0].toLowerCase() + key.slice(1)] ?? report?.[key]
  const estimate = value('ProfitVatEstimate')
  const available = estimate != null && Number.isFinite(Number(estimate))

  return (
    <section aria-label="Profit-based VAT estimate" className="mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-950">
      <h3 className="font-semibold">Profit-based VAT estimate · 5%</h3>
      <p className="mt-1 text-xs">Client profit estimate — not for VAT filing. Calculated as 5% of positive operating profit; zero when profit is zero or negative.</p>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex items-baseline justify-between gap-2"><dt>Sales (including VAT)</dt><dd className="tabular-nums">{formatCurrency(value('ProfitSales') ?? 0)}</dd></div>
        <div className="flex items-baseline justify-between gap-2"><dt>Cost of goods</dt><dd className="tabular-nums">{formatCurrency(value('ProfitCogs') ?? 0)}</dd></div>
        <div className="flex items-baseline justify-between gap-2"><dt>Expenses</dt><dd className="tabular-nums">{formatCurrency(value('ProfitExpenses') ?? 0)}</dd></div>
        <div className="flex items-baseline justify-between gap-2 font-medium"><dt>Operating profit estimate</dt><dd className="tabular-nums">{formatCurrency(value('ProfitAmount') ?? 0)}</dd></div>
      </dl>
      <div className="mt-3 border-t border-amber-200 pt-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">5% profit estimate</p>
        <p className="font-semibold tabular-nums">{available ? formatCurrency(Number(estimate)) : 'Refresh to load estimate'}</p>
      </div>
    </section>
  )
}
