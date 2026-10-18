import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Eye, RefreshCw, Plus, Pencil, Trash2, Filter } from 'lucide-react'
import { suppliersAPI } from '../../services/index'
import { formatCurrency } from '../../utils/currency'
import { moneyTone, moneyWord } from '../../utils/moneyTone'
import { fixSupplierForm } from '../../utils/supplierFields'
import { saveOutcomeIsUncertain } from '../../utils/apiError'
import { useAuth } from '../../hooks/useAuth'
import { isAdminOrOwner } from '../../utils/roles'
import Modal from '../../components/Modal'
import OverflowMenu from '../../components/ui/OverflowMenu'
import toast from 'react-hot-toast'
import { mobilePageShellClass } from '../../components/tallyFormClasses'
import { ListSkeleton } from '../../components/mobile/index'
import { readSuppliersStateFromParams, syncSuppliersSearchParams } from '../../utils/suppliersUrl'

const PAGE_SIZE = 25
const fieldClass = 'w-full h-11 sm:h-9 px-3 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'
const btnPrimary = 'inline-flex items-center justify-center gap-1.5 min-h-[44px] h-11 px-3 text-sm font-semibold bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-60'
const btnOutline = 'inline-flex items-center justify-center min-h-[44px] h-11 px-3 text-sm font-medium border border-neutral-300 rounded-md text-neutral-800 bg-white hover:bg-neutral-50'
const iconBtn = 'inline-flex items-center justify-center min-h-[44px] min-w-[44px] h-11 w-11 rounded-md text-neutral-700 hover:bg-neutral-100'

const emptyForm = { name: '', phone: '', email: '', address: '', creditLimit: '', paymentTerms: '' }

function safeMessage(err, fallback) {
  if (err?._handledByInterceptor) return null
  const status = err?.response?.status
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'Supplier was not found.'
  if (status === 409) return 'A supplier with this name already exists.'
  if (status === 429) return 'Too many requests. Wait a moment and try again.'
  if (status >= 500) return fallback
  const msg = err?.response?.data?.message
  if (typeof msg === 'string' && msg && !/exception|sql|stack|tenant|npgsql|inner/i.test(msg)) return msg
  return fallback
}

const SuppliersPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = isAdminOrOwner(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '')
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get('overdue') === '1')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showDeactivated, setShowDeactivated] = useState(() => searchParams.get('inactive') === '1')
  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1))
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [editForm, setEditForm] = useState({ ...emptyForm, isActive: true })
  const [editFormIsDeactivated, setEditFormIsDeactivated] = useState(false)
  const [editFormLoadFailed, setEditFormLoadFailed] = useState(false)
  // While the saved details load, the fields are disabled: typing before the load would be overwritten by it.
  const [editLoading, setEditLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const skipPageReset = useRef(true)

  // Reload when "Include deactivated" changes: the server decides which suppliers come back.
  useEffect(() => {
    loadSuppliers()
  }, [showDeactivated])

  const shouldOpenCreateFromUrl = searchParams.get('create') === '1'
  const prefillNameFromUrl = searchParams.get('prefill') || ''
  useEffect(() => {
    if (!shouldOpenCreateFromUrl) return
    setShowCreateModal(true)
    const prefill = (prefillNameFromUrl || '').trim()
    if (prefill) setCreateForm((prev) => ({ ...prev, name: prefill }))
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.delete('create')
      p.delete('prefill')
      return p
    }, { replace: true })
  }, [shouldOpenCreateFromUrl, prefillNameFromUrl, setSearchParams])

  const editFromUrl = searchParams.get('edit')
  useEffect(() => {
    if (!editFromUrl || loading || suppliers.length === 0) return
    const s = suppliers.find(sup => (sup.supplierName || '').toLowerCase() === editFromUrl.toLowerCase())
    if (s && canManage) {
      openEditModal(s)
      setSearchParams(prev => {
        const p = new URLSearchParams(prev)
        p.delete('edit')
        return p
      }, { replace: true })
    }
  }, [editFromUrl, loading, suppliers, canManage])

  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false
      return
    }
    setPage(1)
  }, [searchTerm, overdueOnly, showDeactivated])

  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      syncSuppliersSearchParams(next, {
        searchTerm,
        overdueOnly,
        showDeactivated,
        page
      })
      return next
    }, { replace: true })
  }, [searchTerm, overdueOnly, showDeactivated, page, setSearchParams])

  useEffect(() => {
    const parsed = readSuppliersStateFromParams(searchParams)
    skipPageReset.current = true
    setSearchTerm((s) => (s === parsed.searchTerm ? s : parsed.searchTerm))
    setOverdueOnly((o) => (o === parsed.overdueOnly ? o : parsed.overdueOnly))
    setShowDeactivated((v) => (v === parsed.showDeactivated ? v : parsed.showDeactivated))
    setPage((p) => (p === parsed.page ? p : parsed.page))
  }, [searchParams])

  const filteredSuppliers = useMemo(() => {
    let list = suppliers
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      list = list.filter(s => (s.supplierName || '').toLowerCase().includes(term) || (s.phone || '').includes(term))
    }
    if (overdueOnly) list = list.filter(s => (s.overdue || 0) > 0)
    if (!showDeactivated) list = list.filter(s => s.isActive !== false)
    return list
  }, [suppliers, searchTerm, overdueOnly, showDeactivated])

  const pageCount = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE) || 1)
  const safePage = Math.min(page, pageCount)
  const pageRows = filteredSuppliers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const pendingTotal = filteredSuppliers.reduce((sum, s) => sum + (s.netPayable || 0), 0)
  const withBalance = filteredSuppliers.filter(s => (s.netPayable || 0) > 0).length
  const filtersOn = Boolean(searchTerm.trim() || overdueOnly || showDeactivated)
  const activeFilterCount = [overdueOnly, showDeactivated].filter(Boolean).length

  const listQuery = () => {
    const p = new URLSearchParams()
    if (searchTerm.trim()) p.set('q', searchTerm.trim())
    if (overdueOnly) p.set('overdue', '1')
    if (showDeactivated) p.set('inactive', '1')
    if (safePage > 1) p.set('page', String(safePage))
    return p.toString()
  }

  const openSupplier = (s) => {
    navigate(`/suppliers/${encodeURIComponent(s.supplierName)}`, { state: { listQuery: listQuery() } })
  }

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      setLoadError('')
      const response = await suppliersAPI.getAllSuppliersSummary({ includeInactive: showDeactivated })
      if (response?.success && Array.isArray(response?.data)) setSuppliers(response.data)
      else {
        setSuppliers([])
        setLoadError('Could not load suppliers.')
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error)
      setSuppliers([])
      setLoadError('Could not load suppliers.')
      const msg = safeMessage(error, 'Could not load suppliers.')
      if (msg) toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '-'

  const openEditModal = async (s) => {
    setEditingSupplier(s)
    setShowEditModal(true)
    setEditFormIsDeactivated(false)
    setEditFormLoadFailed(false)
    setEditLoading(true)
    try {
      const res = await suppliersAPI.getSupplier(s.supplierName)
      if (res?.success && res?.data) {
        const d = res.data
        setEditFormIsDeactivated(d.isActive === false)
        setEditForm({
          name: d.name || '',
          phone: d.phone || '',
          email: d.email || '',
          address: d.address || '',
          creditLimit: d.creditLimit != null ? String(d.creditLimit) : '',
          paymentTerms: d.paymentTerms || '',
          isActive: d.isActive !== false
        })
      } else {
        setEditFormLoadFailed(true)
        setEditForm({
          name: s.supplierName || '',
          phone: s.phone || '',
          email: '',
          address: '',
          creditLimit: s.creditLimit != null ? String(s.creditLimit) : '',
          paymentTerms: '',
          isActive: s.isActive !== false
        })
      }
    } catch (err) {
      console.error(err)
      setEditFormLoadFailed(true)
      const msg = safeMessage(err, 'Could not load supplier details')
      if (msg) toast.error(err?.response?.status === 404 ? 'Supplier not in directory. Create the supplier to edit.' : msg)
      setEditForm({
        name: s.supplierName || '',
        phone: s.phone || '',
        email: '',
        address: '',
        creditLimit: s.creditLimit != null ? String(s.creditLimit) : '',
        paymentTerms: '',
        isActive: s.isActive !== false
      })
    } finally {
      setEditLoading(false)
    }
  }

  const returnToDetail = (name) => {
    const q = new URLSearchParams(searchParams)
    q.delete('edit')
    q.delete('fromDetail')
    navigate(`/suppliers/${encodeURIComponent(name)}`, { replace: true, state: { listQuery: q.toString() } })
  }

  const closeEdit = () => {
    if (updating) return
    const fromDetail = searchParams.get('fromDetail') === '1'
    const name = editingSupplier?.supplierName
    setShowEditModal(false)
    setEditingSupplier(null)
    setEditFormIsDeactivated(false)
    setEditFormLoadFailed(false)
    if (fromDetail && name) returnToDetail(name)
  }

  const handleUpdateSupplier = async (e) => {
    e.preventDefault()
    if (!editingSupplier || updating) return
    const fixed = fixSupplierForm(editForm)
    if (fixed.error) {
      toast.error(fixed.error)
      return
    }
    const name = fixed.values.name
    const fromDetail = searchParams.get('fromDetail') === '1'
    try {
      setUpdating(true)
      const res = await suppliersAPI.updateSupplier(editingSupplier.supplierName, {
        ...fixed.values,
        isActive: editForm.isActive
      })
      if (fixed.notes.length) toast(`We fixed: ${fixed.notes.join(' ')}`, { duration: 9000 })
      if (res?.success) {
        toast.success('Supplier updated successfully')
        window.dispatchEvent(new CustomEvent('dataUpdated'))
        setShowEditModal(false)
        setEditingSupplier(null)
        const savedName = res?.data?.name || name
        if (fromDetail) returnToDetail(savedName)
        else loadSuppliers()
      } else {
        const msg = res?.message
        toast.error(typeof msg === 'string' && !/exception|sql|stack/i.test(msg) ? msg : 'Could not update supplier')
      }
    } catch (err) {
      console.error(err)
      const msg = safeMessage(err, 'Could not update supplier')
      if (msg) toast.error(msg)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteSupplier = async () => {
    if (!deleteConfirm || deleting) return
    const { supplierName } = deleteConfirm
    try {
      setDeleting(true)
      await suppliersAPI.deleteSupplier(supplierName)
      toast.success('Supplier deactivated. Purchases and payments stay on the books.')
      window.dispatchEvent(new CustomEvent('dataUpdated'))
      setDeleteConfirm(null)
      loadSuppliers()
    } catch (err) {
      console.error(err)
      const msg = safeMessage(err, 'Could not deactivate supplier')
      if (msg) toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateSupplier = async (e) => {
    e.preventDefault()
    if (creating) return
    const fixed = fixSupplierForm(createForm)
    if (fixed.error) {
      toast.error(fixed.error)
      return
    }
    const name = fixed.values.name
    const finishCreated = () => {
      toast.success('Supplier created successfully')
      if (fixed.notes.length) toast(`We fixed: ${fixed.notes.join(' ')}`, { duration: 9000 })
      window.dispatchEvent(new CustomEvent('dataUpdated'))
      setShowCreateModal(false)
      setCreateForm(emptyForm)
      loadSuppliers()
      let returnPath = null
      try { returnPath = sessionStorage.getItem('hexabill.afterSupplierCreate') } catch (_) { /* ignore */ }
      if (returnPath) {
        try { sessionStorage.removeItem('hexabill.afterSupplierCreate') } catch (_) { /* ignore */ }
        navigate(returnPath)
      }
    }
    try {
      setCreating(true)
      const res = await suppliersAPI.createSupplier(fixed.values)
      if (res?.success) {
        finishCreated()
      } else {
        const msg = res?.message
        toast.error(typeof msg === 'string' && !/exception|sql|stack/i.test(msg) ? msg : 'Could not create supplier')
      }
    } catch (err) {
      console.error(err)
      // The server may have saved the supplier even though the answer failed. A duplicate name is answered with 409,
      // so a lost answer or 5xx plus a matching name means it was saved.
      if (saveOutcomeIsUncertain(err)) {
        try {
          const list = await suppliersAPI.getAllSuppliersSummary({ includeInactive: true })
          const rows = Array.isArray(list?.data) ? list.data : []
          if (rows.some(r => String(r.supplierName || '').trim().toLowerCase() === name.toLowerCase())) {
            finishCreated()
            return
          }
        } catch (_) { /* fall through to the message below */ }
      }
      const msg = safeMessage(err, 'Could not create supplier. Nothing was saved, please try again.')
      if (msg) toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setOverdueOnly(false)
    setShowDeactivated(false)
  }

  const supplierFields = (form, setForm, idPrefix) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 sm:max-w-md">
        <label className="block text-sm font-medium text-neutral-800 mb-1" htmlFor={`${idPrefix}-name`}>Name <span className="text-error">*</span></label>
        <input id={`${idPrefix}-name`} type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gulf Frozen Foods" className={fieldClass} />
      </div>
      <div className="sm:max-w-xs">
        <label className="block text-sm font-medium text-neutral-800 mb-1" htmlFor={`${idPrefix}-phone`}>Phone</label>
        <input id={`${idPrefix}-phone`} type="text" inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. +971 50 123 4567" className={fieldClass} />
      </div>
      <div className="sm:max-w-md">
        <label className="block text-sm font-medium text-neutral-800 mb-1" htmlFor={`${idPrefix}-email`}>Email</label>
        <input id={`${idPrefix}-email`} type="text" inputMode="email" autoCapitalize="none" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. sales@supplier.com" className={fieldClass} />
      </div>
      <div className="sm:max-w-[10rem]">
        <label className="block text-sm font-medium text-neutral-800 mb-1" htmlFor={`${idPrefix}-credit`}>Credit limit</label>
        <input id={`${idPrefix}-credit`} type="number" inputMode="decimal" step="any" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} placeholder="e.g. 5000 (empty = no limit)" className={fieldClass} />
      </div>
      <div className="sm:max-w-xs">
        <label className="block text-sm font-medium text-neutral-800 mb-1" htmlFor={`${idPrefix}-terms`}>Payment terms</label>
        <input id={`${idPrefix}-terms`} type="text" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="Net 30" className={fieldClass} />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-neutral-800 mb-1" htmlFor={`${idPrefix}-address`}>Address</label>
        <textarea id={`${idPrefix}-address`} rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. Al Quoz, Dubai" className={`${fieldClass} h-auto py-2`} />
      </div>
    </div>
  )

  return (
    <div className={`w-full px-3 sm:px-4 py-3 pb-24 lg:pb-4 ${mobilePageShellClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900">Suppliers</h1>
          <p className="hidden text-xs text-neutral-500 md:block">Find a supplier and open its ledger.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={loadSuppliers} disabled={loading} className={iconBtn} title="Refresh" aria-label="Refresh suppliers">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={() => setShowCreateModal(true)} className={btnPrimary} aria-label="Add Supplier">
            <Plus className="h-4 w-4" /> Add Supplier
          </button>
        </div>
      </div>
      {/* Phones: helper text sits full width on its own line, so it does not wrap beside the buttons (SU-05). */}
      <p className="mb-3 mt-1 text-xs text-neutral-500 md:hidden">Find a supplier and open its ledger.</p>

      {/* Phones: search and one Filters button share a row; the checkboxes open below it (SU-06).
          From md: everything sits on one row. */}
      <div className="mb-3 flex items-center gap-2 md:flex-wrap md:gap-x-4">
        <div className="relative min-w-0 flex-1 md:w-80 md:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search suppliers"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`${fieldClass} pl-8`}
            aria-label="Search suppliers"
          />
        </div>
        {/* Icon-only trigger, 44px: the search keeps the row. The count sits on the icon and in the name. */}
        <button
          type="button"
          onClick={() => setFiltersOpen(v => !v)}
          aria-expanded={filtersOpen}
          aria-controls="supplier-filters"
          aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
          className="btn btn-secondary relative h-11 w-11 shrink-0 px-0 md:hidden"
        >
          <Filter className="h-4 w-4" aria-hidden />
          {activeFilterCount > 0 && (
            <span aria-hidden className="absolute -right-1 -top-1 flex min-w-[1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-micro font-semibold text-white">{activeFilterCount}</span>
          )}
        </button>
        <div
          id="supplier-filters"
          className={`${filtersOpen ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-x-4 gap-y-1 md:flex md:w-auto`}
        >
          <label className="inline-flex items-center gap-2 h-11 sm:h-9 text-sm text-neutral-700">
            <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} className="rounded border-neutral-300" />
            Overdue
          </label>
          <label className="inline-flex items-center gap-2 h-11 sm:h-9 text-sm text-neutral-700">
            <input type="checkbox" checked={showDeactivated} onChange={e => setShowDeactivated(e.target.checked)} className="rounded border-neutral-300" />
            Include deactivated
          </label>
          {filtersOn && (
            <button type="button" onClick={clearFilters} className="text-sm text-primary-700 underline h-9">Clear</button>
          )}
        </div>
      </div>

      {!loading && !loadError && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3 text-sm">
          <div>
            <p className="text-xs text-neutral-500">Pending</p>
            <p className={`tabular-nums font-semibold ${moneyTone('due', pendingTotal)}`}>{formatCurrency(pendingTotal)}{moneyWord('due', pendingTotal) && <span className="ml-1 text-xs font-normal">{moneyWord('due', pendingTotal)}</span>}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">With balance</p>
            <p className="tabular-nums font-semibold text-neutral-900">{withBalance}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Suppliers</p>
            <p className="tabular-nums font-semibold text-neutral-900">{filteredSuppliers.length}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-3" aria-busy="true" aria-label="Loading suppliers">
            <ListSkeleton count={6} />
          </div>
        ) : loadError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-neutral-700 mb-3">{loadError}</p>
            <button type="button" onClick={loadSuppliers} className={btnOutline}>Try again</button>
          </div>
        ) : (
          <>
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500">
                  <tr>
                    <th className="text-left font-medium px-2 py-2">Supplier</th>
                    <th className="text-left font-medium px-2 py-2">Phone</th>
                    <th className="text-right font-medium px-2 py-2">Purchases</th>
                    <th className="text-right font-medium px-2 py-2">Paid</th>
                    <th className="text-right font-medium px-2 py-2">Outstanding</th>
                    <th className="text-right font-medium px-2 py-2">Overdue</th>
                    <th className="text-left font-medium px-2 py-2">Last purchase</th>
                    <th className="text-right font-medium px-2 py-2">Invoices</th>
                    <th className="text-left font-medium px-2 py-2">Last payment</th>
                    <th className="text-right font-medium px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-sm text-neutral-600">
                        <p className="mb-3">{suppliers.length === 0 ? 'No suppliers found.' : 'No suppliers found.'}</p>
                        {suppliers.length === 0 ? (
                          <button type="button" onClick={() => setShowCreateModal(true)} className={btnPrimary}>Add Supplier</button>
                        ) : (
                          <button type="button" onClick={clearFilters} className="text-sm text-primary-700 underline">Clear</button>
                        )}
                      </td>
                    </tr>
                  ) : pageRows.map((s) => (
                    <tr
                      key={s.id ?? s.supplierName}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open ${s.supplierName}`}
                      onClick={() => openSupplier(s)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openSupplier(s)
                        }
                      }}
                      className="border-t border-neutral-100 hover:bg-neutral-50 cursor-pointer focus:bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary-500"
                    >
                      <td className="px-2 h-10 font-medium text-neutral-900">
                        <span className="inline-flex items-center gap-2">
                          {s.supplierName}
                          {s.isActive === false && <span className="px-1.5 py-0.5 text-micro font-medium rounded bg-warning-bg text-amber-800 border border-warning-border">Deactivated</span>}
                        </span>
                      </td>
                      <td className="px-2 h-10 text-neutral-600">{s.phone || '—'}</td>
                      <td className="px-2 h-10 text-right tabular-nums">{formatCurrency(s.totalPurchases || 0)}</td>
                      <td className={`px-2 h-10 text-right tabular-nums ${moneyTone('paid', s.totalPaid)}`}>{formatCurrency(s.totalPaid || 0)}</td>
                      <td className={`px-2 h-10 text-right tabular-nums font-medium ${moneyTone('due', s.netPayable)}`}>{formatCurrency(s.netPayable || 0)}{moneyWord('due', s.netPayable) && <span className="ml-1 text-xs font-normal">{moneyWord('due', s.netPayable)}</span>}</td>
                      <td className={`px-2 h-10 text-right tabular-nums ${moneyTone('overdue', s.overdue)}`}>{formatCurrency(s.overdue || 0)}</td>
                      <td className="px-2 h-10 text-neutral-700">{formatDate(s.lastPurchaseDate)}</td>
                      <td className="px-2 h-10 text-right tabular-nums">{s.invoiceCount ?? '—'}</td>
                      <td className="px-2 h-10 text-neutral-700">{formatDate(s.lastPaymentDate)}</td>
                      <td className="px-2 h-10 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openSupplier(s)} className="inline-flex items-center justify-center h-9 w-9 rounded-md text-neutral-700 hover:bg-neutral-100" title="Open" aria-label={`Open ${s.supplierName}`}>
                          <Eye className="h-4 w-4" />
                        </button>
                        {canManage && s.id != null && (
                          <span className="ml-1 inline-flex align-middle" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            <OverflowMenu
                              label={`More actions for ${s.supplierName}`}
                              items={[
                                { label: 'Edit supplier', icon: Pencil, onClick: () => openEditModal(s) },
                                { label: 'Deactivate supplier', icon: Trash2, danger: true, separatorBefore: true, onClick: () => setDeleteConfirm(s) },
                              ]}
                            />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="xl:hidden divide-y divide-neutral-100">
              {pageRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-neutral-600">
                  <p className="mb-3">No suppliers found.</p>
                  {suppliers.length === 0 ? (
                    <button type="button" onClick={() => setShowCreateModal(true)} className={btnPrimary}>Add Supplier</button>
                  ) : (
                    <button type="button" onClick={clearFilters} className="text-sm text-primary-700 underline">Clear</button>
                  )}
                </div>
              ) : pageRows.map((s) => (
                <div
                  key={s.id ?? s.supplierName}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${s.supplierName}`}
                  onClick={() => openSupplier(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openSupplier(s)
                    }
                  }}
                  className="p-3 cursor-pointer focus:outline-none focus:bg-neutral-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-neutral-900">{s.supplierName}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.isActive === false && <span className="text-micro text-amber-800">Deactivated</span>}
                      {canManage && s.id != null && (
                        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <OverflowMenu
                            label={`More actions for ${s.supplierName}`}
                            items={[
                              { label: 'Edit supplier', icon: Pencil, onClick: () => openEditModal(s) },
                              { label: 'Deactivate supplier', icon: Trash2, danger: true, separatorBefore: true, onClick: () => setDeleteConfirm(s) },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <p className="text-neutral-500">Outstanding</p>
                      <p className={`tabular-nums font-medium ${moneyTone('due', s.netPayable)}`}>{formatCurrency(s.netPayable || 0)}{moneyWord('due', s.netPayable) && <span className="ml-1 text-xs font-normal">{moneyWord('due', s.netPayable)}</span>}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Purchases</p>
                      <p className="tabular-nums font-medium text-neutral-900">{formatCurrency(s.totalPurchases || 0)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Invoices</p>
                      <p className="tabular-nums font-medium text-neutral-900">{s.invoiceCount ?? '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredSuppliers.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-neutral-200 text-sm">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className={btnOutline}>Previous</button>
                <span className="text-neutral-600">Page {safePage} of {pageCount}</span>
                <button type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} className={btnOutline}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => !creating && setShowCreateModal(false)} title="Add Supplier" size="md">
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          {supplierFields(createForm, setCreateForm, 'create')}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => !creating && setShowCreateModal(false)} className={btnOutline}>Cancel</button>
            <button type="submit" disabled={creating} className={btnPrimary}>{creating ? 'Creating...' : 'Create Supplier'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={closeEdit} title="Edit Supplier" size="md">
        {editingSupplier && (
          <form onSubmit={handleUpdateSupplier} className="space-y-4">
            {editFormIsDeactivated && <p className="text-xs text-amber-800">This supplier is deactivated.</p>}
            {editLoading && <p className="text-xs text-neutral-500" role="status">Loading supplier details…</p>}
            {editFormLoadFailed && (
              <p className="text-sm text-neutral-800 bg-white border border-neutral-200 border-l-4 border-l-warning rounded-sm px-3 py-2">
                Supplier details could not be loaded. You can view what is shown, but changes cannot be saved.
              </p>
            )}
            <fieldset disabled={editLoading} className="min-w-0 space-y-4 border-0 p-0">
              {supplierFields(editForm, setEditForm, 'edit')}
              <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
                <input id="edit-isActive" type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded border-neutral-300" />
                Active
              </label>
            </fieldset>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeEdit} className={btnOutline}>Cancel</button>
              <button type="submit" disabled={updating || editFormLoadFailed || editLoading} className={btnPrimary}>{updating ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!deleteConfirm} onClose={() => !deleting && setDeleteConfirm(null)} title="Deactivate supplier?" size="sm">
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700">
              Purchases and payments for <strong>{deleteConfirm.supplierName}</strong> stay on the books. The supplier is hidden until Include deactivated is on.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => !deleting && setDeleteConfirm(null)} className={btnOutline}>Cancel</button>
              <button type="button" onClick={handleDeleteSupplier} disabled={deleting} className="inline-flex items-center justify-center h-11 sm:h-9 px-3 text-sm font-semibold bg-error text-white rounded-md hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SuppliersPage
