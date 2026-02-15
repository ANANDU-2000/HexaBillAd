import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MapPin, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import toast from 'react-hot-toast'
import { routesAPI } from '../../services'
import Modal from '../../components/Modal'
import { Input } from '../../components/Form'
import { isAdminOrOwner } from '../../utils/roles'

const EXPENSE_CATEGORIES = ['Fuel', 'Staff', 'Delivery', 'Misc']

const RouteDetailPage = () => {
  const { id } = useParams()
  const [route, setRoute] = useState(null)
  const [summary, setSummary] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('Misc')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [expenseDescription, setExpenseDescription] = useState('')

  const canManage = isAdminOrOwner(JSON.parse(localStorage.getItem('user') || '{}'))

  const loadRoute = async () => {
    if (!id) return
    try {
      const res = await routesAPI.getRoute(id)
      if (res?.success && res?.data) setRoute(res.data)
      else setRoute(null)
    } catch {
      setRoute(null)
    }
  }

  const loadSummary = async () => {
    if (!id) return
    try {
      const res = await routesAPI.getRouteSummary(id, fromDate, toDate)
      if (res?.success && res?.data) setSummary(res.data)
      else setSummary(null)
    } catch {
      setSummary(null)
    }
  }

  const loadExpenses = async () => {
    if (!id) return
    try {
      const res = await routesAPI.getRouteExpenses(id, fromDate, toDate)
      if (res?.success && res?.data) setExpenses(res.data)
      else setExpenses([])
    } catch {
      setExpenses([])
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadRoute(), loadSummary(), loadExpenses()]).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    loadSummary()
    loadExpenses()
  }, [id, fromDate, toDate])

  const handleAddExpense = async (e) => {
    e?.preventDefault()
    const amount = parseFloat(expenseAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    try {
      setSaving(true)
      const res = await routesAPI.createRouteExpense(id, {
        category: expenseCategory,
        amount: amount,
        expenseDate: expenseDate,
        description: expenseDescription?.trim() || undefined
      })
      if (res?.success) {
        toast.success('Expense added')
        setShowExpenseModal(false)
        setExpenseAmount('')
        setExpenseDescription('')
        setExpenseDate(new Date().toISOString().split('T')[0])
        loadExpenses()
        loadSummary()
      } else {
        toast.error(res?.message || 'Failed to add expense')
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to add expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      const res = await routesAPI.deleteRouteExpense(id, expenseId)
      if (res?.success) {
        toast.success('Expense deleted')
        loadExpenses()
        loadSummary()
      } else {
        toast.error(res?.message || 'Failed to delete')
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to delete')
    }
  }

  if (loading && !route) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!route) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Route not found.</p>
        <Link to="/branches?tab=routes" className="text-primary-600 hover:underline mt-2 inline-block">Back to Routes</Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/branches?tab=routes" className="inline-flex items-center gap-1 text-primary-600 hover:underline mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Routes
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary-50">
          <MapPin className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{route.name}</h1>
          <p className="text-sm text-neutral-500">{route.branchName ?? '—'}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 text-sm"
        />
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <p className="text-sm text-neutral-500">Total Sales</p>
            <p className="text-lg font-semibold text-neutral-900">{formatCurrency(summary.totalSales)}</p>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <p className="text-sm text-neutral-500">Total Expenses</p>
            <p className="text-lg font-semibold text-neutral-900">{formatCurrency(summary.totalExpenses)}</p>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <p className="text-sm text-neutral-500">Profit</p>
            <p className={`text-lg font-semibold ${summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(summary.profit)}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-neutral-800">Route expenses</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowExpenseModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add expense
          </button>
        )}
      </div>
      {expenses.length === 0 ? (
        <p className="text-neutral-500 text-sm">No expenses in this date range.</p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-200">
              <div>
                <span className="font-medium">{e.category}</span>
                <span className="text-neutral-600 ml-2">{formatCurrency(e.amount)}</span>
                {e.description && <p className="text-sm text-neutral-500">{e.description}</p>}
                <p className="text-xs text-neutral-400">{e.expenseDate?.split('T')[0]}</p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleDeleteExpense(e.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  aria-label="Delete expense"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showExpenseModal && (
        <Modal
          isOpen={true}
          title="Add route expense"
          onClose={() => !saving && setShowExpenseModal(false)}
        >
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-neutral-700">Category</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="block w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl shadow-sm text-neutral-900 sm:text-sm"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              required
              placeholder="0.00"
            />
            <Input
              label="Date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
            <Input
              label="Description (optional)"
              value={expenseDescription}
              onChange={(e) => setExpenseDescription(e.target.value)}
              placeholder="Notes"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowExpenseModal(false)} className="px-4 py-2 border border-neutral-300 rounded-lg">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default RouteDetailPage

