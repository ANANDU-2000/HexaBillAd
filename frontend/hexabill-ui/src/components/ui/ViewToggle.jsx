import { LayoutGrid, List } from 'lucide-react'

const ViewToggle = ({ view, onChange }) => {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`
          inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-l-lg
          ${
            view === 'grid'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          }
        `}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="ml-2 hidden sm:inline">Grid</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`
          inline-flex items-center px-3 py-2 border-l border-gray-300 text-sm font-medium rounded-r-lg
          ${
            view === 'list'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          }
        `}
      >
        <List className="h-4 w-4" />
        <span className="ml-2 hidden sm:inline">List</span>
      </button>
    </div>
  )
}

export default ViewToggle

