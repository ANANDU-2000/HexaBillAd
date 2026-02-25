import { Search, Filter, X } from 'lucide-react'
import { useState } from 'react'

const FilterPanel = ({ 
  searchPlaceholder = 'Search...',
  onSearchChange,
  filters = [],
  activeFilters = {},
  onFilterChange
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    onSearchChange(value)
  }

  const clearFilter = (filterKey) => {
    onFilterChange({ ...activeFilters, [filterKey]: '' })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filters */}
        {filters.map((filter) => (
          <div key={filter.key} className="min-w-[150px]">
            <select
              value={activeFilters[filter.key] || ''}
              onChange={(e) => onFilterChange({ ...activeFilters, [filter.key]: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Clear Filters */}
        {Object.values(activeFilters).some(v => v !== '') && (
          <button
            onClick={() => onFilterChange({})}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export default FilterPanel

