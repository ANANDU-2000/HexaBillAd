import { TrendingUp, TrendingDown } from 'lucide-react'

/**
 * Design lock: bg-white border border-neutral-200, NO shadow.
 * Icon: bg-primary-50 text-primary-600. Text: neutral-600 / neutral-900. Change: success/error.
 */
const StatCard = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'primary',
  format = 'currency',
}) => {
  const formatValue = (val) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency: 'AED',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(val)
    }
    return val
  }

  /* Blue & white only: all icons and text use primary */
  const iconBg = 'bg-primary-50 text-primary-600'

  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4 md:p-6 hover:border-primary-300 transition-colors duration-150 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary-600 mb-1 truncate">{title}</p>
          <p className="text-base sm:text-xl lg:text-2xl font-bold text-primary-800 truncate">
            {formatValue(value)}
          </p>
          {change !== undefined && (
            <div className="flex items-center mt-1 sm:mt-2 gap-1">
              {changeType === 'positive' && (
                <TrendingUp className="h-4 w-4 text-primary-600 flex-shrink-0" />
              )}
              {changeType === 'negative' && (
                <TrendingDown className="h-4 w-4 text-primary-500 flex-shrink-0" />
              )}
              <span
                className={`text-sm font-medium ${
                  changeType === 'positive'
                    ? 'text-primary-600'
                    : changeType === 'negative'
                      ? 'text-primary-500'
                      : 'text-primary-600'
                }`}
              >
                {change !== 0 && (changeType === 'positive' ? '+' : '')}
                {change}% {changeType !== 'neutral' ? (changeType === 'positive' ? '↑' : '↓') : ''}
              </span>
              {changeType !== 'neutral' && (
                <span className="text-xs text-primary-500">vs last period</span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={`p-2 md:p-3 rounded-lg ${iconBg} flex-shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center`}
          >
            <Icon className="w-5 h-5 md:w-6 md:h-6" />
          </div>
        )}
      </div>
    </div>
  )
}

export default StatCard
