import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { formatCurrency } from '../../utils/currency'

/**
 * The dashboard chart is split out so the 500KB+ recharts bundle is not part of the
 * landing page's first paint. DashboardTally loads it lazily under a skeleton.
 */
export default function SalesTrendChart({ data, formatDisplayDate }) {
  return (
    <ResponsiveContainer width="100%" height={150} minWidth={0}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDisplayDate(d).slice(0, 5)}
          stroke="var(--text-tertiary)"
          fontSize={12}
        />
        <YAxis
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          stroke="var(--text-tertiary)"
          fontSize={12}
        />
        <Tooltip
          formatter={(value) => formatCurrency(value)}
          labelFormatter={(label) => formatDisplayDate(label)}
          contentStyle={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}
        />
        <Bar dataKey="sales" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
