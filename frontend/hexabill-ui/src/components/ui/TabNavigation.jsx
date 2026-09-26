import { Fragment } from 'react'

const TabNavigation = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`border-b border-gray-200 ${className}`}>
      <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                flex-shrink-0 py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
                ${
                  isActive
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                }
              `}
            >
              <div className="flex items-center">
                {tab.icon && <tab.icon className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />}
                {tab.label}
                {tab.badge && (
                  <span className={`ml-1.5 sm:ml-2 py-0.5 px-1.5 sm:px-2 rounded-full text-xs ${
                    isActive 
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default TabNavigation

