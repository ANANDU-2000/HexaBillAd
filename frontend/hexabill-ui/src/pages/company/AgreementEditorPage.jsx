import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Save, Download, Printer } from 'lucide-react'
import { agreementsAPI } from '../../services/documentsApi'

const CLAUSES = [
  'The First Party will provide frozen items meeting food safety and quality standards.',
  'The Second Party will purchase and sell popsicles in their outlet.',
  'The First Party will provide a freezer to the Second Party; the Second Party agrees to provide space in the outlet.',
  'There is no return policy for the items once items delivered unless there is damage; and in case of nonmoving, items should return with good condition which is able to sell at least two months before expiry.',
  'The First Party retains ownership of the freezer and may request its return; the Second Party shall comply.',
]

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
  })
  const [savedId, setSavedId] = useState(id ? Number(id) : null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (isEdit) {
          const res = await agreementsAPI.get(id)
          const a = res?.data ?? res
          if (cancelled || !a) return
          applyDto(a)
        } else {
          const res = await agreementsAPI.previewBlank()
          const a = res?.data ?? res
          if (cancelled || !a) return
          setFirst({
            firstPartyName: a.firstPartyName || '',
            firstPartyLicense: a.firstPartyLicense || 'CN-4937175',
            firstPartyAddress: a.firstPartyAddress || '',
            firstPartyMobile: a.firstPartyMobile || '',
            firstPartyEmail: a.firstPartyEmail || '',
            firstPartyWebsite: a.firstPartyWebsite || '',
            firstPartyPhones: a.firstPartyPhones || '',
          })
          if (a.agreementDate) setAgreementDate(String(a.agreementDate).slice(0, 10))
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || e.message || 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  const applyDto = (a) => {
    setAgreementNo(a.agreementNo || '')
    setAgreementDate(String(a.agreementDate || '').slice(0, 10))
    setStatus(a.status || 'Draft')
    setSecondPartyName(a.secondPartyName || '')
    setSecondPartyLicense(a.secondPartyLicense || '')
    setSecondPartyAddress(a.secondPartyAddress || '')
    setSecondPartyMobile(a.secondPartyMobile || '')
    setSavedId(a.id || null)
    setFirst({
      firstPartyName: a.firstPartyName || '',
      firstPartyLicense: a.firstPartyLicense || 'CN-4937175',
      firstPartyAddress: a.firstPartyAddress || '',
      firstPartyMobile: a.firstPartyMobile || '',
      firstPartyEmail: a.firstPartyEmail || '',
      firstPartyWebsite: a.firstPartyWebsite || '',
      firstPartyPhones: a.firstPartyPhones || '',
    })
  }

  const payload = () => ({
    agreementDate,
    secondPartyName,
    secondPartyLicense,
    secondPartyAddress,
    secondPartyMobile,
    status,
  })

  const save = async () => {
    setError('')
    setSaving(true)
    try {
      const res = savedId
        ? await agreementsAPI.update(savedId, payload())
        : await agreementsAPI.create(payload())
      const a = res?.data ?? res
      applyDto(a)
      if (!isEdit) navigate(`/agreements/${a.id}`, { replace: true })
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePdf = async (format, mode) => {
    setError('')
    try {
      let aid = savedId
      if (!aid) {
        setSaving(true)
        const res = await agreementsAPI.create(payload())
        const a = res?.data ?? res
        applyDto(a)
        aid = a.id
        navigate(`/agreements/${aid}`, { replace: true })
        setSaving(false)
      }
      const blob = await agreementsAPI.getPdf(aid, format)
      const name = `${agreementNo || 'AGR'}_${format}.pdf`
      if (mode === 'download') downloadBlob(blob, name)
      else openPdfBlob(blob)
    } catch (e) {
      setSaving(false)
      setError(e?.response?.data?.message || e.message || 'PDF failed')
    }
  }

  const displaySecond = (v) => (v?.trim() ? v : '________________')

  return (
    <div className="p-3 md:p-4 h-full min-h-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{isEdit ? 'Edit agreement' : 'New agreement'}</h1>
          <p className="text-xs text-text-secondary">{agreementNo || 'Will assign AGR-n on save'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/agreements" className="px-3 py-1.5 text-sm border rounded-md">List</Link>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-md disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'download')} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md">
            <Download className="w-4 h-4" /> Download
          </button>
          <button type="button" onClick={() => handlePdf('A4', 'print')} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md">
            <Printer className="w-4 h-4" /> Print A4
          </button>
          <button type="button" onClick={() => handlePdf('A5', 'print')} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md">
            <Printer className="w-4 h-4" /> Print A5
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0 flex-1">
        <div className="border rounded-lg bg-white p-3 space-y-3 overflow-auto">
          <p className="text-xs text-text-secondary">Second Party fields start blank. First Party is locked from company Settings.</p>
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
            <input className="w-full border rounded px-2 py-1.5 text-sm" value={secondPartyName} onChange={(e) => setSecondPartyName(e.target.value)} placeholder="Blank until typed" />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">License</span>
            <input className="w-full border rounded px-2 py-1.5 text-sm" value={secondPartyLicense} onChange={(e) => setSecondPartyLicense(e.target.value)} />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Address / Location</span>
            <input className="w-full border rounded px-2 py-1.5 text-sm" value={secondPartyAddress} onChange={(e) => setSecondPartyAddress(e.target.value)} />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Mobile</span>
            <input className="w-full border rounded px-2 py-1.5 text-sm" value={secondPartyMobile} onChange={(e) => setSecondPartyMobile(e.target.value)} />
          </label>
          <div className="rounded border bg-slate-50 p-2 text-xs space-y-1">
            <div className="font-semibold">First Party (Settings)</div>
            <div>{first.firstPartyName || '—'}</div>
            <div>License: {first.firstPartyLicense}</div>
            <div>{first.firstPartyAddress}</div>
            <div>{first.firstPartyMobile}</div>
          </div>
        </div>

        <div className="border rounded-lg bg-white p-4 overflow-auto">
          <div className="text-center text-[#E67E22] font-bold text-sm uppercase tracking-wide mb-1">
            {first.firstPartyName || 'First Party'}
          </div>
          <div className="text-center font-bold underline text-sm mb-1">BUSINESS DEVELOPMENT AGREEMENT</div>
          <div className="text-center text-xs mb-4">{agreementDate}</div>

          <div className="text-xs space-y-1 mb-3">
            <div className="font-semibold">First Party:</div>
            <div>{first.firstPartyName}</div>
            <div>License: {first.firstPartyLicense}</div>
            <div>Location: {first.firstPartyAddress}</div>
            {first.firstPartyMobile && <div>Mobile: {first.firstPartyMobile}</div>}
          </div>
          <div className="text-xs space-y-1 mb-3">
            <div className="font-semibold">Second Party:</div>
            <div>{displaySecond(secondPartyName)}</div>
            <div>License: {displaySecond(secondPartyLicense)}</div>
            <div>Location: {displaySecond(secondPartyAddress)}</div>
            <div>Mobile: {displaySecond(secondPartyMobile)}</div>
          </div>
          <p className="text-xs mb-3">
            Whereas the First Party ({first.firstPartyName || '…'}) is a licensed Ice popsicles and Sip up Distributors and the Second Party ({displaySecond(secondPartyName)}) is a Licensed trader.
          </p>
          <div className="text-xs font-semibold mb-1">The parties agree as follows:</div>
          <ol className="text-xs list-decimal pl-4 space-y-1 mb-8">
            {CLAUSES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <div className="grid grid-cols-2 gap-6 text-xs text-center pt-4">
            <div>
              <div className="border-t border-black pt-1 mt-8">First Party</div>
              <div className="text-[10px] mt-1">{first.firstPartyName}</div>
            </div>
            <div>
              <div className="border-t border-black pt-1 mt-8">Second Party</div>
              <div className="text-[10px] mt-1">{displaySecond(secondPartyName)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
