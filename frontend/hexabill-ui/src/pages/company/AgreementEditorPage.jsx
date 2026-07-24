import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Save, Download, Printer } from 'lucide-react'
import { agreementsAPI } from '../../services/documentsApi'
import { getSetting, getSettingBool } from '../../utils/settingsKeys'

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, 1000)
}

function openPdfBlob(blob) {
  const url = window.URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
}

const display = (v) => (v?.trim() ? v : '________________')

export default function AgreementEditorPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [agreementNo, setAgreementNo] = useState('')
  const [agreementDate, setAgreementDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('Draft')
  const [secondPartyName, setSecondPartyName] = useState('')
  const [secondPartyLicense, setSecondPartyLicense] = useState('')
  const [secondPartyAddress, setSecondPartyAddress] = useState('')
  const [secondPartyMobile, setSecondPartyMobile] = useState('')
  const [first, setFirst] = useState({
    firstPartyName: '',
    firstPartyLicense: 'CN-4937175',
    firstPartyAddress: '',
    firstPartyMobile: '',
    firstPartyEmail: '',
    firstPartyWebsite: '',
    firstPartyPhones: '',
    footerAddress: '',
  })
  const [whereasText, setWhereasText] = useState('')
  const [clauses, setClauses] = useState([])
  const [savedId, setSavedId] = useState(id ? Number(id) : null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [baseline, setBaseline] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [letterheadOnly, setLetterheadOnly] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState('')
  const autoSaveTimer = useRef(null)
  const persistRef = useRef(null)
  const isDirtyRef = useRef(false)
  const skipAutoSave = useRef(true)

  const serializeForm = useCallback(
    (s) =>
      JSON.stringify({
        agreementDate: s.agreementDate,
        status: s.status,
        secondPartyName: s.secondPartyName || '',
        secondPartyLicense: s.secondPartyLicense || '',
        secondPartyAddress: s.secondPartyAddress || '',
        secondPartyMobile: s.secondPartyMobile || '',
      }),
    []
  )

  const currentSnapshot = useMemo(
    () =>
      serializeForm({
        agreementDate,
        status,
        secondPartyName,
        secondPartyLicense,
        secondPartyAddress,
        secondPartyMobile,
      }),
    [serializeForm, agreementDate, status, secondPartyName, secondPartyLicense, secondPartyAddress, secondPartyMobile]
  )

  const isDirty = Boolean(baseline) && currentSnapshot !== baseline
  isDirtyRef.current = isDirty

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    if (skipAutoSave.current) {
      skipAutoSave.current = false
      return undefined
    }
    if (!isDirty || !baseline) return undefined
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      if (!isDirtyRef.current || !persistRef.current) return
      setAutoSaveStatus('saving')
      try {
        await persistRef.current()
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus(''), 2000)
      } catch {
        setAutoSaveStatus('error')
      }
    }, 1200)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [currentSnapshot, isDirty, baseline])

  useEffect(() => {
    if (!first.firstPartyName) return
    const second = display(secondPartyName)
    setWhereasText(
      `Whereas, ${first.firstPartyName} is a licensed Ice popsicles and Sip up Distributors based in UAE an ${second} is Licensed trader selling products directly to the customers, both parties agreed on the following points:`
    )
  }, [first.firstPartyName, secondPartyName])

  const applyDto = (a, { setClean = false } = {}) => {
    const next = {
      agreementDate: String(a.agreementDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      status: a.status || 'Draft',
      secondPartyName: a.secondPartyName || '',
      secondPartyLicense: a.secondPartyLicense || '',
      secondPartyAddress: a.secondPartyAddress || '',
      secondPartyMobile: a.secondPartyMobile || '',
    }
    setAgreementNo(a.agreementNo || '')
    setAgreementDate(next.agreementDate)
    setStatus(next.status)
    setSecondPartyName(next.secondPartyName)
    setSecondPartyLicense(next.secondPartyLicense)
    setSecondPartyAddress(next.secondPartyAddress)
    setSecondPartyMobile(next.secondPartyMobile)
    setSavedId(a.id || null)
    setFirst({
      firstPartyName: a.firstPartyName || '',
      firstPartyLicense: a.firstPartyLicense || 'CN-4937175',
      firstPartyAddress: a.firstPartyAddress || '',
      firstPartyMobile: a.firstPartyMobile || '',
      firstPartyEmail: a.firstPartyEmail || '',
      firstPartyWebsite: a.firstPartyWebsite || '',
      firstPartyPhones: a.firstPartyPhones || '',
      footerAddress: a.footerAddress || '',
    })
    if (Array.isArray(a.clauses) && a.clauses.length) setClauses(a.clauses)
    if (a.whereasText) setWhereasText(a.whereasText)
    if (setClean) {
      setBaseline(serializeForm(next))
      skipAutoSave.current = true
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (isEdit) {
          const res = await agreementsAPI.get(id)
          const a = res?.data ?? res
          if (cancelled || !a) return
          applyDto(a, { setClean: true })
        } else {
          const res = await agreementsAPI.previewBlank()
          const a = res?.data ?? res
          if (cancelled || !a) return
          applyDto(
            { ...a, id: null, agreementNo: '', secondPartyName: '', secondPartyLicense: '', secondPartyAddress: '', secondPartyMobile: '' },
            { setClean: true }
          )
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || e.message || 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per id
  }, [id, isEdit])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { settingsAPI } = await import('../../services')
        const res = await settingsAPI.getCompanySettings()
        const raw = res?.data ?? res ?? {}
        const dict = raw.data && typeof raw.data === 'object' && !raw.legalNameEn ? raw.data : raw
        if (!cancelled) {
          setLogoUrl(getSetting(dict, 'logoPath') || getSetting(dict, 'LogoPath') || getSetting(dict, 'logoUrl') || getSetting(dict, 'LogoUrl') || getSetting(dict, 'COMPANY_LOGO') || '')
          setLetterheadOnly(getSettingBool(dict, 'Feature_LetterheadOnlyPrint'))
        }
      } catch {
        /* optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const payload = () => ({
    agreementDate,
    secondPartyName,
    secondPartyLicense,
    secondPartyAddress,
    secondPartyMobile,
    status,
  })

  const persist = async () => {
    const res = savedId
      ? await agreementsAPI.update(savedId, payload())
      : await agreementsAPI.create(payload())
    const a = res?.data ?? res
    applyDto(a, { setClean: true })
    if (!isEdit && a.id) navigate(`/agreements/${a.id}`, { replace: true })
    return a.id
  }
  persistRef.current = persist

  const onFieldKeyDown = (e, nextSelector) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (nextSelector) document.querySelector(nextSelector)?.focus()
  }

  const save = async () => {
    setError('')
    setSaving(true)
    try {
      await persist()
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePdf = async (format, mode) => {
    setError('')
    setSaving(true)
    try {
      let aid = savedId
      if (!aid || isDirty) {
        aid = await persist()
      }
      const blob = await agreementsAPI.getPdf(aid, format)
      const name = `${agreementNo || 'AGR'}_${format}.pdf`
      if (mode === 'download') downloadBlob(blob, name)
      else openPdfBlob(blob)
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'PDF failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-2 md:p-3 w-full max-w-full flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{isEdit ? 'Edit agreement' : 'New agreement'}</h1>
          <p className="text-xs text-text-secondary">
            {agreementNo || 'Will assign AGR-n on save'}
            {isDirty ? <span className="ml-2 text-amber-700 font-medium">· Unsaved changes</span> : null}
            {autoSaveStatus === 'saving' ? <span className="ml-2 text-text-secondary">· Auto-saving…</span> : null}
            {autoSaveStatus === 'saved' ? <span className="ml-2 text-green-700">· Auto-saved</span> : null}
            {autoSaveStatus === 'error' ? <span className="ml-2 text-red-600">· Auto-save failed</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/agreements" className="px-3 py-1.5 text-sm border rounded-md">List</Link>
          <button
            type="button"
            onClick={save}
            disabled={saving || !isDirty}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md disabled:opacity-50 ${
              isDirty ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'border text-text-secondary bg-slate-50'
            }`}
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'download')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50">
            <Download className="w-4 h-4" /> Download
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'print')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print A4
          </button>
          <button type="button" onClick={() => handlePdf('A5', 'print')} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print A5
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        <div className="border rounded-lg bg-white p-2.5 space-y-2">
          <p className="text-xs text-text-secondary">Second Party fields start blank. First Party + clauses are fixed Zayoga template text.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Date</span>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={agreementDate} onChange={(e) => setAgreementDate(e.target.value)} />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Status</span>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Draft">Draft</option>
                <option value="Final">Final</option>
              </select>
            </label>
          </div>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Second Party Name</span>
            <input
              data-agr-field="name"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={secondPartyName}
              onChange={(e) => setSecondPartyName(e.target.value)}
              onKeyDown={(e) => onFieldKeyDown(e, '[data-agr-field="license"]')}
              placeholder="Blank until typed"
            />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">License</span>
            <input
              data-agr-field="license"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={secondPartyLicense}
              onChange={(e) => setSecondPartyLicense(e.target.value)}
              onKeyDown={(e) => onFieldKeyDown(e, '[data-agr-field="address"]')}
            />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Address / Location</span>
            <input
              data-agr-field="address"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={secondPartyAddress}
              onChange={(e) => setSecondPartyAddress(e.target.value)}
              onKeyDown={(e) => onFieldKeyDown(e, '[data-agr-field="mobile"]')}
            />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Mobile</span>
            <input
              data-agr-field="mobile"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={secondPartyMobile}
              onChange={(e) => setSecondPartyMobile(e.target.value)}
            />
          </label>
          <div className="rounded border bg-slate-50 p-2 text-xs space-y-1">
            <div className="font-semibold">First Party (fixed template)</div>
            <div>{first.firstPartyName || '—'}</div>
            <div>License: {first.firstPartyLicense}</div>
            <div>{first.firstPartyAddress}</div>
            <div>{first.firstPartyMobile}</div>
          </div>
        </div>

        <div className="border rounded-lg bg-white p-3">
          {!letterheadOnly ? (
            <div className="flex items-start gap-2 mb-1">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-10 w-10 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : null}
              <div className="flex-1 text-center text-[#E67E22] font-bold text-sm uppercase tracking-wide">
                {first.firstPartyName || 'First Party'}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-text-secondary italic mb-2">Letterhead paper (body only)</div>
          )}
          <div className="text-center font-bold underline text-sm mb-1">BUSINESS DEVELOPMENT AGREEMENT</div>
          <div className="text-center text-xs mb-4 underline">DATE-{agreementDate ? agreementDate.split('-').reverse().join('/') : ''}</div>

          <div className="text-xs space-y-1 mb-3">
            <div className="font-semibold">First party:</div>
            <div>{first.firstPartyName}</div>
            <div>License number: {first.firstPartyLicense}</div>
            <div>{first.firstPartyAddress}</div>
            <div>Mob: {first.firstPartyMobile}</div>
          </div>
          <div className="text-xs space-y-1 mb-3">
            <div className="font-semibold">Second Party</div>
            <div>Name: {display(secondPartyName)}</div>
            <div>License number: {display(secondPartyLicense)}</div>
            <div>{display(secondPartyAddress)}</div>
            <div>Mob: {display(secondPartyMobile)}</div>
          </div>
          <p className="text-xs mb-3">{whereasText}</p>
          <ul className="text-xs space-y-1.5 mb-8 list-none pl-0">
            {clauses.map((c, idx) => (
              <li key={idx} className={idx >= 2 ? 'pl-3' : ''}>
                {idx >= 2 ? '❖ ' : '• '}
                {c}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-6 text-xs pt-4">
            <div>
              <div className="font-semibold">First Party:</div>
              <div className="text-[10px] mt-1">{first.firstPartyName}</div>
              <div className="border-t border-black pt-1 mt-10" />
            </div>
            <div>
              <div className="font-semibold">Second Party</div>
              <div className="text-[10px] mt-1">{display(secondPartyName)}</div>
              <div className="border-t border-black pt-1 mt-10" />
            </div>
          </div>
          {!letterheadOnly ? (
            <div className="mt-6 pt-3 border-t text-[10px] text-center text-text-secondary space-y-0.5">
              <div className="font-semibold text-text-primary">{first.firstPartyName}</div>
              <div>{first.footerAddress}</div>
              <div>{first.firstPartyPhones}</div>
              <div>{[first.firstPartyEmail, first.firstPartyWebsite].filter(Boolean).join('  |  ')}</div>
            </div>
          ) : (
            <div className="mt-8 text-[10px] text-text-secondary text-right italic">Stamp / signature zone (pre-printed)</div>
          )}
        </div>
      </div>
    </div>
  )
}
