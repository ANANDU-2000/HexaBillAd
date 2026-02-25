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
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center">
                {tab.icon && <tab.icon className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />}
                {tab.label}
                {tab.badge && (
                  <span className={`ml-1.5 sm:ml-2 py-0.5 px-1.5 sm:px-2 rounded-full text-xs ${
                    isActive 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'bg-gray-100 text-gray-600'
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

