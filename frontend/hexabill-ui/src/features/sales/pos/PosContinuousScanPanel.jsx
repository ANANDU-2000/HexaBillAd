import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, SwitchCamera, X, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCameraBarcodeScanner } from './barcode/useCameraBarcodeScanner'
import { playScanSuccessBeep, playScanErrorBeep } from './barcode/scanBeep'

const ERROR_COPY = {
  permission_denied:
    'Camera access is blocked. Enable it in your browser settings, or use search instead.',
  no_camera: 'No camera found on this device. Use product search instead.',
  not_supported: "Camera scanning isn't supported in this browser. Use product search instead.",
  decode_timeout: null, // soft — keep scanning
}

const SCAN_STATUS_LABEL = {
  starting: 'Starting camera…',
  scanning: 'Looking for barcode…',
  found: 'Barcode found',
  timeout: 'No barcode yet — keep aiming',
}

/**
 * Docked continuous camera scan panel (not full-screen, not ProductDrawer).
 * Cart / typing remain usable while this is open.
 */
export default function PosContinuousScanPanel({
  active,
  getProducts,
  onProductMatched,
  onStop,
}) {
  const [flashOk, setFlashOk] = useState(false)
  const [statusOk, setStatusOk] = useState(null) // { name, qty }
  const [statusMiss, setStatusMiss] = useState(null) // { code }
  const [panelError, setPanelError] = useState(null)
  const clearOkTimer = useRef(null)
  const clearMissTimer = useRef(null)

  const handleDetect = useCallback((code, match) => {
    if (match) {
      const result = onProductMatched?.(match, code)
      playScanSuccessBeep()
      setFlashOk(true)
      setTimeout(() => setFlashOk(false), 350)
      setStatusMiss(null)
      setStatusOk({
        name: result?.name || match.nameEn || match.name || 'Product',
        qty: result?.qty ?? 1,
      })
      if (clearOkTimer.current) clearTimeout(clearOkTimer.current)
      clearOkTimer.current = setTimeout(() => setStatusOk(null), 1500)
      return
    }
    playScanErrorBeep()
    setStatusOk(null)
    setStatusMiss({ code })
    toast.error(`No product for ${code}`, { id: 'pos-scan', duration: 2500 })
    if (clearMissTimer.current) clearTimeout(clearMissTimer.current)
    clearMissTimer.current = setTimeout(() => setStatusMiss(null), 4000)
  }, [onProductMatched])

  const handleError = useCallback((reason) => {
    if (reason === 'decode_timeout') return // keep scanning silently
    setPanelError(ERROR_COPY[reason] || 'Camera error. Try again or use search.')
  }, [])

  const {
    videoRef,
    start,
    stop,
    switchCamera,
    isScanning,
    engineType,
    facingMode,
    scanStatus,
  } = useCameraBarcodeScanner({
    onDetect: handleDetect,
    onError: handleError,
    facingMode: 'environment',
    getProducts,
  })

  useEffect(() => {
    if (!active) {
      stop()
      setPanelError(null)
      setStatusOk(null)
      setStatusMiss(null)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      const ok = await start()
      if (cancelled) stop()
      if (!ok && !cancelled) {
        /* onError already set panel message */
      }
    })()
    return () => {
      cancelled = true
      stop()
    }
  }, [active, start, stop])

  useEffect(() => () => {
    if (clearOkTimer.current) clearTimeout(clearOkTimer.current)
    if (clearMissTimer.current) clearTimeout(clearMissTimer.current)
  }, [])

  if (!active) return null

  const addProductUrl = statusMiss?.code
    ? `/products?barcode=${encodeURIComponent(statusMiss.code)}`
    : null

  const idleHint = SCAN_STATUS_LABEL[scanStatus]
    || (isScanning ? 'Looking for barcode…' : null)

  return (
    <div
      className="fixed z-40 bottom-24 right-3 sm:bottom-28 sm:right-4 w-[min(100vw-1.5rem,16rem)] rounded-lg border border-neutral-300 bg-neutral-900 shadow-xl overflow-hidden pointer-events-auto"
      data-pos-scan-panel
      role="region"
      aria-label="Continuous barcode scanner"
    >
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-neutral-800 text-white">
        <span className="text-[11px] font-semibold inline-flex items-center gap-1">
          <Camera className="h-3.5 w-3.5 text-amber-400" />
          Scan {isScanning ? 'ON' : '…'}
          {engineType && (
            <span className="text-[9px] font-normal text-neutral-400 ml-1">
              {engineType === 'native' ? 'fast' : 'compat'}
            </span>
          )}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => switchCamera()}
            className="p-1.5 rounded hover:bg-white/10 text-white"
            title={`Switch camera (now ${facingMode === 'environment' ? 'back' : 'front'})`}
            aria-label="Switch camera"
          >
            <SwitchCamera className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onStop?.()}
            className="p-1.5 rounded hover:bg-white/10 text-white"
            title="Stop scanning"
            aria-label="Stop scanning"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative aspect-[4/3] bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {/* Cosmetic scan guide */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`w-[72%] h-10 border-2 rounded-sm ${flashOk ? 'border-emerald-400 bg-emerald-400/20' : 'border-amber-400/80'}`} />
        </div>
        {panelError && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-red-900/90 text-[10px] text-red-50 leading-snug">
            {panelError}
            <button
              type="button"
              className="block mt-1 underline text-white"
              onClick={() => { setPanelError(null); start() }}
            >
              Retry camera
            </button>
          </div>
        )}
      </div>

      <div className="min-h-[2.25rem] px-2 py-1.5 bg-neutral-850 border-t border-neutral-700 text-[10px] text-neutral-200">
        {statusOk && (
          <p className="text-emerald-300 font-medium truncate">
            ✓ {statusOk.name} · qty {statusOk.qty}
          </p>
        )}
        {statusMiss && !statusOk && (
          <div className="text-amber-200 space-y-0.5">
            <p className="leading-snug">No product found for {statusMiss.code}</p>
            {addProductUrl && (
              <a
                href={addProductUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-sky-300 underline"
              >
                Add as new product
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
        {!statusOk && !statusMiss && !panelError && (
          <p className="text-neutral-400 flex items-center gap-1">
            {idleHint || (
              <>
                <CameraOff className="h-3 w-3" /> Waiting for camera
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
