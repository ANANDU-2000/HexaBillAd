import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Save, Download, Printer } from 'lucide-react'
import { salaryCertificatesAPI } from '../../services/documentsApi'
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

const display = (v) => (v?.toString().trim() ? v.toString().trim() : '________________')

function formatDisplayDate(iso) {
  if (!iso) return '________________'
  const parts = String(iso).slice(0, 10).split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function formatJoiningDisplay(iso) {
  if (!iso) return '________________'
  const parts = String(iso).slice(0, 10).split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

export default function SalaryCertificateEditorPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [certificateNo, setCertificateNo] = useState('')
  const [certificateDate, setCertificateDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('Draft')
  const [recipient, setRecipient] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [employeeNationality, setEmployeeNationality] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [designation, setDesignation] = useState('')
  const [monthlySalary, setMonthlySalary] = useState('')
  const [monthlySalaryWords, setMonthlySalaryWords] = useState('')
  const [employeePhone, setEmployeePhone] = useState('')
  const [signatoryName, setSignatoryName] = useState('Sudheesh Thampi')
  const [signatoryTitle, setSignatoryTitle] = useState('Manager')
  const [company, setCompany] = useState({
    companyName: 'ZAYOGA GENERAL TRADING SOLE PROPRIETORSHIP LLC',
    companyPhone: '+971 56 452 5130',
    companyEmail: 'info@zayoga.ae',
    companyWebsite: 'www.zayoga.ae',
    footerAddress: 'ROOM2102 FLOOR21 ADCP TOWER A ELECTRA STREET',
  })
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
        certificateDate: s.certificateDate,
        status: s.status,
        recipient: s.recipient || '',
        employeeName: s.employeeName || '',
        passportNumber: s.passportNumber || '',
        employeeNationality: s.employeeNationality || '',
        joiningDate: s.joiningDate || '',
        designation: s.designation || '',
        monthlySalary: s.monthlySalary || '',
        monthlySalaryWords: s.monthlySalaryWords || '',
        employeePhone: s.employeePhone || '',
        signatoryName: s.signatoryName || '',
        signatoryTitle: s.signatoryTitle || '',
      }),
    []
  )

  const currentSnapshot = useMemo(
    () =>
      serializeForm({
        certificateDate,
        status,
        recipient,
        employeeName,
        passportNumber,
        employeeNationality,
        joiningDate,
        designation,
        monthlySalary,
        monthlySalaryWords,
        employeePhone,
        signatoryName,
        signatoryTitle,
      }),
    [
      serializeForm,
      certificateDate,
      status,
      recipient,
      employeeName,
      passportNumber,
      employeeNationality,
      joiningDate,
      designation,
      monthlySalary,
      monthlySalaryWords,
      employeePhone,
      signatoryName,
      signatoryTitle,
    ]
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

  const applyDto = (a, { setClean = false } = {}) => {
    const next = {
      certificateDate: String(a.certificateDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      status: a.status || 'Draft',
      recipient: a.recipient || '',
      employeeName: a.employeeName || '',
      passportNumber: a.passportNumber || '',
      employeeNationality: a.employeeNationality || '',
      joiningDate: a.joiningDate ? String(a.joiningDate).slice(0, 10) : '',
      designation: a.designation || '',
      monthlySalary: a.monthlySalary != null && a.monthlySalary !== '' ? String(a.monthlySalary) : '',
      monthlySalaryWords: a.monthlySalaryWords || '',
      employeePhone: a.employeePhone || '',
      signatoryName: a.signatoryName || 'Sudheesh Thampi',
      signatoryTitle: a.signatoryTitle || 'Manager',
    }
    setCertificateNo(a.certificateNo || '')
    setCertificateDate(next.certificateDate)
    setStatus(next.status)
    setRecipient(next.recipient)
    setEmployeeName(next.employeeName)
    setPassportNumber(next.passportNumber)
    setEmployeeNationality(next.employeeNationality)
    setJoiningDate(next.joiningDate)
    setDesignation(next.designation)
    setMonthlySalary(next.monthlySalary)
    setMonthlySalaryWords(next.monthlySalaryWords)
    setEmployeePhone(next.employeePhone)
    setSignatoryName(next.signatoryName)
    setSignatoryTitle(next.signatoryTitle)
    setSavedId(a.id || null)
    setCompany({
      companyName: a.companyName || 'ZAYOGA GENERAL TRADING SOLE PROPRIETORSHIP LLC',
      companyPhone: a.companyPhone || '+971 56 452 5130',
      companyEmail: a.companyEmail || 'info@zayoga.ae',
      companyWebsite: a.companyWebsite || 'www.zayoga.ae',
      footerAddress: a.footerAddress || 'ROOM2102 FLOOR21 ADCP TOWER A ELECTRA STREET',
    })
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
          const res = await salaryCertificatesAPI.get(id)
          const a = res?.data ?? res
          if (cancelled || !a) return
          applyDto(a, { setClean: true })
        } else {
          const res = await salaryCertificatesAPI.previewBlank()
          const a = res?.data ?? res
          if (cancelled || !a) return
          applyDto(
            {
              ...a,
              id: null,
              certificateNo: '',
              recipient: '',
              employeeName: '',
              passportNumber: '',
              employeeNationality: '',
              joiningDate: null,
              designation: '',
              monthlySalary: null,
              monthlySalaryWords: '',
              employeePhone: '',
            },
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
          setLogoUrl(
            getSetting(dict, 'logoPath') ||
              getSetting(dict, 'LogoPath') ||
              getSetting(dict, 'logoUrl') ||
              getSetting(dict, 'LogoUrl') ||
              getSetting(dict, 'COMPANY_LOGO') ||
              ''
          )
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
    certificateDate,
    recipient,
    employeeName,
    passportNumber,
    employeeNationality,
    joiningDate: joiningDate || null,
    designation,
    monthlySalary: monthlySalary === '' ? null : Number(monthlySalary),
    monthlySalaryWords,
    employeePhone,
    signatoryName,
    signatoryTitle,
    status,
  })

  const persist = async () => {
    const res = savedId
      ? await salaryCertificatesAPI.update(savedId, payload())
      : await salaryCertificatesAPI.create(payload())
    const a = res?.data ?? res
    applyDto(a, { setClean: true })
    if (!isEdit && a.id) navigate(`/salary-certificates/${a.id}`, { replace: true })
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
      const blob = await salaryCertificatesAPI.getPdf(aid, format)
      const name = `${certificateNo || 'SC'}_${format}.pdf`
      if (mode === 'download') downloadBlob(blob, name)
      else openPdfBlob(blob)
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'PDF failed')
    } finally {
      setSaving(false)
    }
  }

  const bodyPreview = useMemo(() => {
    const salaryNum = monthlySalary?.toString().trim() ? monthlySalary : '________________'
    const salaryWords = display(monthlySalaryWords)
    return (
      `This is to certify that ${display(employeeName)} ${display(employeeNationality)} nationality holding passport number ${display(passportNumber)} ` +
      `is working with us since ${formatJoiningDisplay(joiningDate)} as ${display(designation)} And drawing a monthly salary ` +
      `${salaryNum}{${salaryWords}} inclusive of all allowances. Please note that this letter is only ` +
      `issued upon the request of the above-mentioned employee and does not in no way and under no ` +
      `circumstances constitute any financial responsibility guarantee and/or liability towards the ` +
      `payment of any loan amount(S) to you from our part.`
    )
  }, [
    employeeName,
    employeeNationality,
    passportNumber,
    joiningDate,
    designation,
    monthlySalary,
    monthlySalaryWords,
  ])

  return (
    <div className="p-2 md:p-3 w-full max-w-full flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {isEdit ? 'Edit salary certificate' : 'New salary certificate'}
          </h1>
          <p className="text-xs text-text-secondary">
            {certificateNo || 'Will assign SC-n on save'}
            {isDirty ? <span className="ml-2 text-amber-700 font-medium">· Unsaved changes</span> : null}
            {autoSaveStatus === 'saving' ? <span className="ml-2 text-text-secondary">· Auto-saving…</span> : null}
            {autoSaveStatus === 'saved' ? <span className="ml-2 text-green-700">· Auto-saved</span> : null}
            {autoSaveStatus === 'error' ? <span className="ml-2 text-red-600">· Auto-save failed</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/salary-certificates" className="px-3 py-1.5 text-sm border rounded-md">
            List
          </Link>
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
          <button
            type="button"
            onClick={() => handlePdf('A4', 'download')}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Download
          </button>
          <button
            type="button"
            onClick={() => handlePdf('A4', 'print')}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Print A4
          </button>
          <button
            type="button"
            onClick={() => handlePdf('A5', 'print')}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Print A5
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        <div className="border rounded-lg bg-white p-2.5 space-y-2">
          <p className="text-xs text-text-secondary">
            Only employee / recipient fields change. Body wording is fixed Zayoga template. Stamp &amp; sign on the left.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Date</span>
              <input
                type="date"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={certificateDate}
                onChange={(e) => setCertificateDate(e.target.value)}
              />
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
            <span className="text-text-secondary">To (Bank / Recipient)</span>
            <input
              data-sc-field="recipient"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onKeyDown={(e) => onFieldKeyDown(e, '[data-sc-field="name"]')}
              placeholder="e.g. DIB"
            />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Employee Name</span>
            <input
              data-sc-field="name"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              onKeyDown={(e) => onFieldKeyDown(e, '[data-sc-field="passport"]')}
              placeholder="e.g. Mr.VIMALPRATHAP"
            />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Passport Number</span>
            <input
              data-sc-field="passport"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              onKeyDown={(e) => onFieldKeyDown(e, '[data-sc-field="nationality"]')}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Nationality</span>
              <input
                data-sc-field="nationality"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={employeeNationality}
                onChange={(e) => setEmployeeNationality(e.target.value)}
                onKeyDown={(e) => onFieldKeyDown(e, '[data-sc-field="joining"]')}
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Working since</span>
              <input
                data-sc-field="joining"
                type="date"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
            </label>
          </div>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Designation / Details</span>
            <input
              data-sc-field="designation"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              onKeyDown={(e) => onFieldKeyDown(e, '[data-sc-field="salary"]')}
              placeholder="e.g. SHOP ASSISTANT{SALES EXCECUTIVE}"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Monthly Salary</span>
              <input
                data-sc-field="salary"
                type="number"
                min="0"
                step="1"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                onKeyDown={(e) => onFieldKeyDown(e, '[data-sc-field="words"]')}
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Salary in words</span>
              <input
                data-sc-field="words"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={monthlySalaryWords}
                onChange={(e) => setMonthlySalaryWords(e.target.value)}
                onKeyDown={(e) => onFieldKeyDown(e, '[data-sc-field="phone"]')}
                placeholder="e.g. TENTHOUSAND"
              />
            </label>
          </div>
          <label className="text-xs space-y-1 block">
            <span className="text-text-secondary">Phone Number</span>
            <input
              data-sc-field="phone"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={employeePhone}
              onChange={(e) => setEmployeePhone(e.target.value)}
              placeholder="e.g. 0506918642"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Signatory Name</span>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-text-secondary">Signatory Title</span>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="border rounded-lg bg-white p-3">
          {!letterheadOnly ? (
            <div className="flex items-start gap-2 mb-2 pb-2 border-b border-orange-400">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-10 w-10 object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : null}
              <div className="flex-1 text-[#E67E22] font-bold text-xs uppercase tracking-wide leading-snug">
                {company.companyName}
              </div>
              <div className="text-[10px] text-right text-text-secondary space-y-0.5 shrink-0">
                <div>{company.companyPhone}</div>
                <div>{company.companyEmail}</div>
                <div>{company.companyWebsite}</div>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-text-secondary italic mb-2">Letterhead paper (body only — no header/footer)</div>
          )}

          <div className="text-center font-bold text-sm mb-4">Sub: SALARY CERTIFICATE</div>
          <div className="text-xs space-y-1 mb-3">
            <div>DATE:{formatDisplayDate(certificateDate)}</div>
            <div>To; {display(recipient)}</div>
          </div>
          <div className="text-xs mb-3">Dear Sir/Madam</div>
          <p className="text-xs leading-relaxed mb-8 whitespace-pre-wrap">{bodyPreview}</p>

          <div className="text-xs space-y-1 max-w-[220px]">
            <div>Yours faithfully</div>
            <div className="pt-8 font-semibold">{signatoryName || 'Sudheesh Thampi'}</div>
            <div>{signatoryTitle || 'Manager'}</div>
            <div className="border-t border-black pt-1 mt-6 text-[10px] text-text-secondary">Stamp / signature (left)</div>
            {employeePhone?.trim() ? (
              <div className="pt-2 text-[10px] text-text-secondary">Phone: {employeePhone}</div>
            ) : null}
          </div>

          {!letterheadOnly ? (
            <div className="mt-6 pt-3 border-t text-[10px] text-center text-text-secondary space-y-0.5">
              <div className="font-semibold text-text-primary">{company.companyName}</div>
              <div>{company.footerAddress}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
