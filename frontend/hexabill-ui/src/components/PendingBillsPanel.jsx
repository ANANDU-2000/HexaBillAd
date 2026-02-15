import { useState, useMemo } from 'react'
import { Search, Filter, Eye, DollarSign, Calendar } from 'lucide-react'
import { formatCurrency } from '../utils/currency'

const PendingBillsPanel = ({ bills, searchTerm, onSearchChange, filter, onFilterChange, onBillClick }) => {
  const filteredBills = useMemo(() => {
    let filtered = bills || []
    
    if (filter === 'overdue') {
      filtered = filtered.filter(b => b.daysOverdue > 0)
    } else if (filter === 'due-soon') {
      filtered = filtered.filter(b => b.daysOverdue === 0 && b.dueDate && new Date(b.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(b => 
        b.invoiceNo?.toLowerCase().includes(term) ||
        b.customerName?.toLowerCase().includes(term)
      )
    }
    
    return filtered.slice(0, 20) // Limit to 20 for pagination
  }, [bills, searchTerm, filter])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Pending Bills</h3>
        
        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoice or customer..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
          >
            <option value="all">All Pending</option>
            <option value="overdue">Overdue</option>
            <option value="due-soon">Due Soon</option>
          </select>
        </div>
      </div>

      {/* Bills List */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '70vh' }}>
        {filteredBills.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No pending bills found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => onBillClick(bill)}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <p className="font-medium text-gray-900">{bill.invoiceNo}</p>
                    <p className="text-sm text-gray-600">{bill.customerName || 'Cash Customer'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(bill.balanceAmount)}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {bill.paymentStatus && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          bill.paymentStatus.toLowerCase() === 'paid' ? 'bg-green-100 text-green-800' :
                          bill.paymentStatus.toLowerCase() === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {bill.paymentStatus}
                        </span>
                      )}
                      {bill.daysOverdue > 0 && (
                        <p className="text-xs text-red-600">{bill.daysOverdue} days overdue</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-xs text-gray-500 mt-2">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>{new Date(bill.invoiceDate).toLocaleDateString()}</span>
                  {bill.dueDate && (
                    <>
                      <span className="mx-2">•</span>
                      <span>Due: {new Date(bill.dueDate).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default PendingBillsPanel

