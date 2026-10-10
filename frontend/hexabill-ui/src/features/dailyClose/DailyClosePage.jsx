import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getReturnLabel } from '../../utils/returnNavigation'
import toast from 'react-hot-toast'
import { dailyCloseAPI, subscriptionAPI } from '../../services'
import { formatCurrency, getCurrencySymbol } from '../../utils/currency'
import { useBranding } from '../../tenant/TenantBrandingContext'
import { localDateString } from '../../utils/dateFormat'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import { useAuth } from '../../hooks/useAuth'
import { useBranchesRoutes } from '../../contexts/BranchesRoutesContext'
import { isAdminOrOwner } from '../../utils/roles'
import { readDailyCloseStateFromParams, syncDailyCloseSearchParams } from '../../utils/dailyCloseUrl'

const FEATURE = 'daily_close'

const DailyClosePage = () => {
  const { user } = useAuth()
  const { currency: tenantCurrency = 'AED' } = useBranding()
  const money = (value) => formatCurrency(value, tenantCurrency)
  const cashUnit = getCurrencySymbol(tenantCurrency)
  const { branches } = useBranchesRoutes()
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = typeof location.state?.returnTo === 'string' ? location.state.returnTo : null
  const [searchParams, setSearchParams] = useSearchParams()
  const canManageClose = isAdminOrOwner(user)
  const [branchId, setBranchId] = useState(() => searchParams.get('branchId') || '')
  const branchParam = branchId ? parseInt(branchId, 10) : null
  const [enabled, setEnabled] = useState(null)
  const [businessDate, setBusinessDate] = useState(
    () => searchParams.get('date') || localDateString(new Date())
  )
  const [openingCash, setOpeningCash] = useState('0')
  const [countedCash, setCountedCash] = useState('')
  const [varianceReason, setVarianceReason] = useState('')
  const [comment, setComment] = useState('')
  const [preview, setPreview] = useState(null)
  const [history, setHistory] = useState([])
  const [dayStatus, setDayStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [movements, setMovements] = useState([])
  const [movementKind, setMovementKind] = useState('OwnerCapitalIn')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNote, setMovementNote] = useState('')

  useEffect(() => {
    subscriptionAPI.checkFeature(FEATURE)
      .then((res) => setEnabled(Boolean(res?.success && res?.data)))
      .catch(() => setEnabled(false))
  }, [])

  useEffect(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      syncDailyCloseSearchParams(params, { businessDate, branchId })
      return params
    }, { replace: true })
  }, [businessDate, branchId, setSearchParams])

  useEffect(() => {
    const parsed = readDailyCloseStateFromParams(searchParams)
    if (parsed.businessDate) {
      setBusinessDate((d) => (d === parsed.businessDate ? d : parsed.businessDate))
    }
    setBranchId((b) => (b === parsed.branchId ? b : parsed.branchId))
  }, [searchParams])

  const loadPreview = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await dailyCloseAPI.getPreview(businessDate, parseFloat(openingCash) || 0, branchParam)
      if (res?.success) setPreview(res.data)
      else toast.error(res?.message || 'Could not load expected cash')
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error('Could not load expected cash')
    } finally {
      setLoading(false)
    }
  }, [enabled, businessDate, openingCash, branchParam])

  const loadHistory = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await dailyCloseAPI.getHistory(null, null, branchParam)
      if (res?.success) setHistory(res.data || [])
    } catch {
      /* optional */
    }
  }, [enabled, branchParam])

  const loadMovements = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await dailyCloseAPI.getMovements(businessDate, branchParam)
      if (res?.success) setMovements(res.data || [])
    } catch {
      /* optional */
    }
  }, [enabled, businessDate, branchParam])

  const loadStatus = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await dailyCloseAPI.getStatus(businessDate, branchParam)
      if (!res?.success) return
      setDayStatus(res.data)
      const cur = res.data?.current
      if (cur?.status === 'Draft') {
        setOpeningCash(String(cur.openingCash ?? 0))
        setCountedCash(cur.countedCash != null ? String(cur.countedCash) : '')
        setVarianceReason(cur.varianceReason || '')
        setComment(cur.comment || '')
      } else if (!res.data?.isLocked) {
        setCountedCash('')
        setVarianceReason('')
        setComment('')
      }
    } catch {
      /* optional */
    }
  }, [enabled, businessDate, branchParam])

  useEffect(() => {
    if (enabled) {
      loadStatus()
      loadHistory()
      loadMovements()
    }
  }, [enabled, businessDate, branchParam, loadStatus, loadHistory, loadMovements])

  useEffect(() => {
    if (enabled) loadPreview()
  }, [enabled, loadPreview])

  const submit = async (submitClose) => {
    const counted = parseFloat(countedCash)
    if (submitClose && (isNaN(counted) || counted < 0)) {
      toast.error('Enter counted cash')
      return
    }
    setSaving(true)
    try {
      const res = await dailyCloseAPI.save({
        businessDate,
        branchId: branchParam,
        openingCash: parseFloat(openingCash) || 0,
        countedCash: isNaN(counted) ? 0 : counted,
        varianceReason,
        comment,
        submitClose
      })
      if (res?.success) {
        toast.success(res.message || 'Saved')
        await loadPreview()
        await loadHistory()
        await loadStatus()
      } else toast.error(res?.message || 'Save failed')
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (enabled === null) return <LoadingCard message="Loading daily close…" />
  if (!enabled) {
    return (
      <div className="p-4 max-w-lg">
        <h1 className="text-xl font-semibold text-neutral-900">Daily close</h1>
        <p className="mt-2 text-sm text-neutral-600">Daily close is not enabled for this workspace. Ask your platform admin to turn on the feature after staging verification.</p>
      </div>
    )
  }

  const variance = preview && countedCash !== ''
    ? (parseFloat(countedCash) || 0) - preview.expectedCash
    : null

  const closedForDate = dayStatus?.isLocked ? dayStatus.current : null

  const addMovement = async () => {
    if (!canManageClose) {
      toast.error('Only owner or admin can record capital or transfers')
      return
    }
    const amt = parseFloat(movementAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSaving(true)
    try {
      const res = await dailyCloseAPI.createMovement({
        businessDate,
        branchId: branchParam,
        kind: movementKind,
        amount: amt,
        note: movementNote || null
      })
      if (res?.success) {
        toast.success('Movement recorded')
        setMovementAmount('')
        setMovementNote('')
        await loadMovements()
        await loadPreview()
      } else toast.error(res?.message || 'Could not save movement')
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error('Could not save movement')
    } finally {
      setSaving(false)
    }
  }

  const removeMovement = async (id) => {
    if (!canManageClose) return
    setSaving(true)
    try {
      const res = await dailyCloseAPI.deleteMovement(id)
      if (res?.success) {
        await loadMovements()
        await loadPreview()
      } else toast.error(res?.message || 'Delete failed')
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error('Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const handleReopen = async () => {
    if (!canManageClose) {
      toast.error('Only owner or admin can reopen a closed day')
      return
    }
    if (!reopenReason.trim() || reopenReason.trim().length < 3) {
      toast.error('Enter a reopen reason (at least 3 characters)')
      return
    }
    setSaving(true)
    try {
      const res = await dailyCloseAPI.reopen({ businessDate, branchId: branchParam, reason: reopenReason.trim() })
      if (res?.success) {
        toast.success(res.message || 'Day reopened')
        setReopenReason('')
        await loadHistory()
        await loadPreview()
        await loadStatus()
      } else toast.error(res?.message || 'Reopen failed')
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error('Reopen failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        {returnTo && (
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary-700"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to {getReturnLabel(returnTo)}
          </button>
        )}
        <h1 className="text-xl font-semibold text-neutral-900">Daily close</h1>
        <p className="text-sm text-neutral-600 mt-1">Compare system expected cash to your physical count. Settlement adjustments are excluded from cash received.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="font-medium text-neutral-700">Business date</span>
          <input type="date" className="mt-1 w-full min-h-[44px] border rounded-lg px-3" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-neutral-700">Opening cash ({cashUnit})</span>
          <input type="number" step="0.01" className="mt-1 w-full min-h-[44px] border rounded-lg px-3" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
        </label>
        {branches?.length > 0 && (
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-neutral-700">Branch (optional)</span>
            <select className="mt-1 w-full min-h-[44px] border rounded-lg px-3 bg-white" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All branches (company cash)</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">Branch close counts sale cash for that branch only; supplier cash stays on company-wide close.</p>
          </label>
        )}
      </div>

      {loading ? <LoadingCard message="Calculating expected cash…" /> : preview && (
        <div className="border rounded-lg p-4 bg-neutral-50 space-y-2 text-sm">
          <div className="flex justify-between"><span>Customer cash (cleared)</span><strong>{money(preview.collectionsCashReceived ?? preview.cashReceived)}</strong></div>
          <div className="flex justify-between"><span>Operating cash paid out</span><strong>{money(preview.collectionsCashPaidOut ?? preview.cashPaidOut)}</strong></div>
          <div className="flex justify-between pt-2 border-t font-semibold text-base"><span>Expected in drawer</span><span>{money(preview.expectedCash)}</span></div>
          <p className="text-xs text-neutral-500">{preview.cashReceiptCount} cash receipt(s), {preview.expenseCount} expense(s), {preview.supplierCashPaymentCount} supplier cash payment(s)</p>
          {(preview.ownerCapitalIn > 0 || preview.ownerDrawing > 0 || preview.bankToDrawer > 0 || preview.drawerToBank > 0) && (
            <div className="pt-2 mt-2 border-t border-dashed space-y-1 text-xs text-neutral-600">
              <p className="font-medium text-neutral-700">Capital &amp; drawer transfers</p>
              {preview.ownerCapitalIn > 0 && <div className="flex justify-between"><span>Owner capital in</span><span>{money(preview.ownerCapitalIn)}</span></div>}
              {preview.ownerDrawing > 0 && <div className="flex justify-between"><span>Owner drawing</span><span>{money(preview.ownerDrawing)}</span></div>}
              {preview.bankToDrawer > 0 && <div className="flex justify-between"><span>Bank → drawer</span><span>{money(preview.bankToDrawer)}</span></div>}
              {preview.drawerToBank > 0 && <div className="flex justify-between"><span>Drawer → bank</span><span>{money(preview.drawerToBank)}</span></div>}
            </div>
          )}
          {(preview.bankReceived > 0 || preview.bankPaidOut > 0) && (
            <div className="pt-2 mt-2 border-t border-dashed space-y-1 text-xs text-neutral-600">
              <p className="font-medium text-neutral-700">Bank / transfer (not in drawer count)</p>
              <div className="flex justify-between"><span>Received</span><span>{money(preview.bankReceived)}</span></div>
              <div className="flex justify-between"><span>Paid out</span><span>{money(preview.bankPaidOut)}</span></div>
            </div>
          )}
        </div>
      )}

      {canManageClose && !closedForDate && (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800">Capital &amp; transfers</h2>
          <p className="text-xs text-neutral-500">Record owner float, drawings, or bank↔drawer moves. These adjust expected cash; they are not sales.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-sm sm:col-span-1">
              <span className="font-medium text-neutral-700">Type</span>
              <select className="mt-1 w-full min-h-[44px] border rounded-lg px-3 bg-white" value={movementKind} onChange={(e) => setMovementKind(e.target.value)}>
                <option value="OwnerCapitalIn">Owner capital in</option>
                <option value="OwnerDrawing">Owner drawing</option>
                <option value="BankToDrawer">Bank → drawer</option>
                <option value="DrawerToBank">Drawer → bank</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-neutral-700">Amount ({cashUnit})</span>
              <input type="number" step="0.01" inputMode="decimal" className="mt-1 w-full min-h-[44px] border rounded-lg px-3" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-3">
              <span className="font-medium text-neutral-700">Note</span>
              <input type="text" className="mt-1 w-full min-h-[44px] border rounded-lg px-3" value={movementNote} onChange={(e) => setMovementNote(e.target.value)} />
            </label>
          </div>
          <LoadingButton type="button" loading={saving} onClick={addMovement} className="min-h-[44px] px-4 bg-slate-800 text-white rounded-lg">Add movement</LoadingButton>
          {movements.length > 0 && (
            <ul className="text-sm divide-y border rounded-lg">
              {movements.map((m) => (
                <li key={m.id} className="px-3 py-2 flex justify-between gap-2 items-center">
                  <span>{m.kind} · {money(m.amount)}</span>
                  <button type="button" className="text-error-fg text-xs min-h-[44px] px-2" onClick={() => removeMovement(m.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-neutral-700">Counted cash ({cashUnit})</span>
          <input type="number" step="0.01" inputMode="decimal" className="mt-1 w-full min-h-[48px] border rounded-lg px-3 text-base" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} placeholder="Physical count" />
        </label>
        {variance != null && Math.abs(variance) > 0.01 && (
          <p className={`text-sm font-medium ${variance < 0 ? 'text-error-fg' : 'text-warning-fg'}`}>
            Variance: {money(variance)} — reason required to close
          </p>
        )}
        <label className="block text-sm">
          <span className="font-medium text-neutral-700">Variance reason</span>
          <input type="text" className="mt-1 w-full min-h-[44px] border rounded-lg px-3" value={varianceReason} onChange={(e) => setVarianceReason(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-neutral-700">Comment</span>
          <textarea className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[72px]" value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
      </div>

      {closedForDate && (
        <div className="border border-amber-300 bg-warning-bg rounded-lg p-4 space-y-2">
          <p className="text-sm text-amber-900 font-medium">This business day is closed (v{closedForDate.version}). Reopen to record a corrected close.</p>
          {canManageClose ? (
            <>
              <input
                type="text"
                className="w-full min-h-[44px] border border-amber-300 rounded-lg px-3 text-sm"
                placeholder="Reopen reason (required)"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
              />
              <LoadingButton type="button" loading={saving} onClick={handleReopen} className="min-h-[44px] px-4 bg-amber-700 text-white rounded-lg">
                Reopen day
              </LoadingButton>
            </>
          ) : (
            <p className="text-xs text-amber-800">Ask an owner or admin to reopen this day.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <LoadingButton type="button" loading={loading} onClick={loadPreview} className="min-h-[44px] px-4 border rounded-lg">Refresh expected</LoadingButton>
        {!closedForDate && (
          <>
            <LoadingButton type="button" loading={saving} onClick={() => submit(false)} className="min-h-[44px] px-4 border rounded-lg">Save draft</LoadingButton>
            {canManageClose ? (
              <LoadingButton type="button" loading={saving} onClick={() => submit(true)} className="min-h-[44px] px-4 bg-success text-white rounded-lg">Submit close</LoadingButton>
            ) : (
              <p className="text-xs text-neutral-500 self-center">Submit close requires owner or admin.</p>
            )}
          </>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-800 mb-2">Recent closes</h2>
          <ul className="text-sm divide-y border rounded-lg">
            {history.slice(0, 10).map((row) => (
              <li key={row.id} className="px-3 py-2 flex justify-between gap-2">
                <span>{new Date(row.businessDate).toLocaleDateString('en-GB')} · v{row.version} · {row.status}</span>
                <span>{money(row.countedCash)} / {money(row.expectedCash)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default DailyClosePage
