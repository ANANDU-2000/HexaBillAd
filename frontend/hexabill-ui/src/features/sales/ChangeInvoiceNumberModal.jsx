// UX-008: Owner/Admin "Change invoice number". Dry run first, then a plain confirmation, then the real change.
// Errors stay inline in the modal; the caller gets exactly one success toast via onChanged.
import { useEffect, useId, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../../components/Modal'
import { salesAPI } from '../../services/index'
import { mapInvoiceNumberError, sanitizeInvoiceNumberInput, validateInvoiceNumberChange } from '../../utils/invoiceNumberChange'

const inputClass = 'block w-full min-h-11 rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30'

export default function ChangeInvoiceNumberModal ({ isOpen, sale, onClose, onChanged }) {
  const numberId = useId()
  const reasonId = useId()
  const errorId = useId()
  const [next, setNext] = useState('')
  const [reason, setReason] = useState('')
  const [step, setStep] = useState('edit') // edit | confirm
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null) // { field?, kind?, message }

  const current = sale?.invoiceNo ?? ''

  useEffect(() => {
    if (isOpen) { setNext(''); setReason(''); setStep('edit'); setBusy(false); setError(null) }
  }, [isOpen, sale?.id])

  if (!isOpen || !sale) return null

  const run = async (dryRun) => {
    setBusy(true)
    setError(null)
    try {
      const res = await salesAPI.changeInvoiceNumber(sale.id, { newInvoiceNumber: next, reason }, { dryRun })
      const data = res?.data || {}
      if (dryRun) {
        setStep('confirm')
      } else {
        const newNo = data.newInvoiceNo || next
        toast.success(data.changed === false ? `Invoice already has number ${newNo}.` : `Invoice ${data.oldInvoiceNo || current} is now ${newNo}.`, { id: 'invoice-number-change' })
        onChanged?.(data)
        onClose()
      }
    } catch (e) {
      setStep('edit')
      setError(mapInvoiceNumberError(e?.response?.status, e?.response?.data))
    } finally {
      setBusy(false)
    }
  }

  const handleCheck = (e) => {
    e?.preventDefault()
    const v = validateInvoiceNumberChange({ current, next, reason })
    if (v) { setError(v); return }
    run(true)
  }

  const numberErr = error && (error.field === 'number' || (!error.field && error.kind !== 'forbidden')) ? error.message : null
  const reasonErr = error?.field === 'reason' ? error.message : null
  const formErr = error?.kind === 'forbidden' ? error.message : null

  const footer = step === 'edit'
    ? (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-100">Cancel</button>
        <button type="submit" form={`${numberId}-form`} disabled={busy || error?.kind === 'forbidden'} className="min-h-11 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          {busy ? 'Checking…' : 'Confirm'}
        </button>
      </div>
      )
    : (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => setStep('edit')} disabled={busy} className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-100">Back</button>
        <button type="button" onClick={() => run(false)} disabled={busy} className="min-h-11 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          {busy ? 'Changing…' : 'Change number'}
        </button>
      </div>
      )

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title="Change invoice number" size="sm" footer={footer} closeOnOverlayClick={!busy}>
      {step === 'edit' ? (
        <form id={`${numberId}-form`} onSubmit={handleCheck} noValidate className="space-y-4">
          <div>
            <p className="text-sm text-neutral-600">Current number</p>
            <p className="break-all text-lg font-semibold text-neutral-900" data-testid="current-invoice-number">{current || '—'}</p>
          </div>
          <div className="space-y-1">
            <label htmlFor={numberId} className="block text-sm font-medium text-neutral-700">New invoice number</label>
            <input
              id={numberId}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={next}
              onChange={(e) => { setNext(sanitizeInvoiceNumberInput(e.target.value)); if (error) setError(null) }}
              aria-invalid={!!numberErr}
              aria-describedby={numberErr ? errorId : undefined}
              className={inputClass}
            />
            {numberErr
              ? <p id={errorId} role="alert" className="text-sm font-medium text-error-fg">{numberErr}</p>
              : <p className="text-xs text-neutral-500">Digits only, at least 4.</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor={reasonId} className="block text-sm font-medium text-neutral-700">Reason <span className="text-error" aria-hidden>*</span></label>
            <textarea
              id={reasonId}
              rows={2}
              value={reason}
              required
              onChange={(e) => { setReason(e.target.value); if (error?.field === 'reason') setError(null) }}
              aria-invalid={!!reasonErr}
              className={inputClass}
              placeholder="Why the number is changing"
            />
            {reasonErr && <p role="alert" className="text-sm font-medium text-error-fg">{reasonErr}</p>}
          </div>
          {formErr && <p role="alert" className="rounded-md bg-error-bg p-3 text-sm font-medium text-error-fg">{formErr}</p>}
        </form>
      ) : (
        <div className="space-y-3">
          <p className="break-words text-base font-semibold text-neutral-900">Change {current} to {next}?</p>
          <p className="text-sm text-neutral-700">Payments, returns and statements follow the new number automatically. The change is recorded in the audit log with your reason.</p>
          <p className="rounded-md bg-warning-bg p-3 text-sm text-warning-fg">Customers who already have a PDF of this invoice will see the old number. Reprint and resend it if needed.</p>
        </div>
      )}
    </Modal>
  )
}
