import { useCallback, useEffect, useRef, useState } from 'react'
import { matchProductByCode } from './matchProductByCode'

/** Formats shared by native BarcodeDetector and WASM (must stay in sync). */
export const CAMERA_BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'qr_code',
]

const DETECT_INTERVAL_MS = 110 // ~9 Hz
const DEDUPE_MS = 1500
const DECODE_TIMEOUT_MS = 15000

/**
 * Shared camera barcode scanner: native BarcodeDetector with ZBar-WASM fallback.
 *
 * @param {{
 *   onDetect?: (code: string, match: object|null) => void,
 *   onError?: (reason: string) => void,
 *   facingMode?: 'environment'|'user',
 *   getProducts?: () => object[],
 * }} options
 */
export function useCameraBarcodeScanner({
  onDetect,
  onError,
  facingMode: initialFacing = 'environment',
  getProducts,
} = {}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const lastTickRef = useRef(0)
  const lastCodeRef = useRef({ code: '', at: 0 })
  const detectorRef = useRef(null)
  const wasmScannerRef = useRef(null)
  const canvasRef = useRef(null)
  const runningRef = useRef(false)
  const startedAtRef = useRef(0)
  const timeoutFiredRef = useRef(false)
  const facingRef = useRef(initialFacing)
  const onDetectRef = useRef(onDetect)
  const onErrorRef = useRef(onError)
  const getProductsRef = useRef(getProducts)

  onDetectRef.current = onDetect
  onErrorRef.current = onError
  getProductsRef.current = getProducts

  const [isScanning, setIsScanning] = useState(false)
  const [lastError, setLastError] = useState(null)
  const [engineType, setEngineType] = useState(null) // 'native' | 'wasm'
  const [facingMode, setFacingMode] = useState(initialFacing)
  /** idle | starting | scanning | found | timeout */
  const [scanStatus, setScanStatus] = useState('idle')

  const emitError = useCallback((reason) => {
    setLastError(reason)
    if (reason === 'decode_timeout') {
      setScanStatus('timeout')
    }
    onErrorRef.current?.(reason)
  }, [])

  const stopTracks = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    runningRef.current = false
    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      stream.getTracks().forEach((t) => {
        try { t.stop() } catch { /* ignore */ }
      })
    }
    const video = videoRef.current
    if (video) {
      try { video.srcObject = null } catch { /* ignore */ }
    }
    detectorRef.current = null
    if (wasmScannerRef.current) {
      try { wasmScannerRef.current.destroy() } catch { /* ignore */ }
      wasmScannerRef.current = null
    }
    setIsScanning(false)
    setScanStatus('idle')
  }, [])

  const handleDecoded = useCallback((rawCode) => {
    const code = String(rawCode || '').trim()
    if (!code) return
    const now = Date.now()
    if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < DEDUPE_MS) {
      return
    }
    lastCodeRef.current = { code, at: now }
    timeoutFiredRef.current = true // success resets soft-timeout pressure
    startedAtRef.current = now
    setScanStatus('found')

    let match = null
    const getter = getProductsRef.current
    if (typeof getter === 'function') {
      match = matchProductByCode(getter() || [], code)
    }
    onDetectRef.current?.(code, match)
  }, [])

  const tickDetect = useCallback(async () => {
    if (!runningRef.current) return
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => { tickDetect() })
      return
    }

    const now = performance.now()
    if (now - lastTickRef.current < DETECT_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(() => { tickDetect() })
      return
    }
    lastTickRef.current = now

    if (!timeoutFiredRef.current && Date.now() - startedAtRef.current > DECODE_TIMEOUT_MS) {
      timeoutFiredRef.current = true
      emitError('decode_timeout')
    }

    try {
      if (detectorRef.current) {
        const barcodes = await detectorRef.current.detect(video)
        if (barcodes?.length) {
          const raw = barcodes[0].rawValue
          if (raw) handleDecoded(raw)
        }
      } else if (wasmScannerRef.current) {
        let canvas = canvasRef.current
        if (!canvas) {
          canvas = document.createElement('canvas')
          canvasRef.current = canvas
        }
        const w = video.videoWidth
        const h = video.videoHeight
        if (w > 0 && h > 0) {
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h)
            const imageData = ctx.getImageData(0, 0, w, h)
            const { scanImageData } = await import('@undecaf/zbar-wasm')
            const symbols = await scanImageData(imageData, wasmScannerRef.current)
            if (symbols?.length) {
              const decoded = symbols[0].decode?.() || ''
              if (decoded) handleDecoded(decoded)
            }
          }
        }
      }
    } catch {
      /* frame decode errors are transient — keep looping */
    }

    if (runningRef.current) {
      rafRef.current = requestAnimationFrame(() => { tickDetect() })
    }
  }, [emitError, handleDecoded])

  const startStream = useCallback(async (facing) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      emitError('not_supported')
      return false
    }

    stopTracks()
    facingRef.current = facing
    setFacingMode(facing)
    setLastError(null)
    setScanStatus('starting')
    timeoutFiredRef.current = false
    startedAtRef.current = Date.now()
    lastCodeRef.current = { code: '', at: 0 }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
    } catch (err) {
      const name = err?.name || ''
      setScanStatus('idle')
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        emitError('permission_denied')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        emitError('no_camera')
      } else if (name === 'NotSupportedError' || name === 'TypeError') {
        emitError('not_supported')
      } else {
        emitError('no_camera')
      }
      return false
    }

    streamRef.current = stream
    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      video.muted = true
      try {
        await video.play()
      } catch {
        /* autoplay may need user gesture — stream is still attached */
      }
    }

    const hasNative = typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function'
    if (hasNative) {
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: CAMERA_BARCODE_FORMATS })
        setEngineType('native')
      } catch {
        detectorRef.current = null
      }
    }

    if (!detectorRef.current) {
      try {
        const zbar = await import('@undecaf/zbar-wasm')
        try {
          const wasmUrl = (await import('@undecaf/zbar-wasm/dist/zbar.wasm?url')).default
          zbar.setModuleArgs({
            locateFile: (filename) => (filename.endsWith('.wasm') ? wasmUrl : filename),
          })
        } catch {
          /* inlined / default locate may still work */
        }
        const scanner = await zbar.ZBarScanner.create()
        // Enable common 1D + QR; disable everything else for speed
        const { ZBarSymbolType, ZBarConfigType } = zbar
        scanner.setConfig(ZBarSymbolType.ZBAR_NONE, ZBarConfigType.ZBAR_CFG_ENABLE, 0)
        const enable = [
          ZBarSymbolType.ZBAR_EAN13,
          ZBarSymbolType.ZBAR_EAN8,
          ZBarSymbolType.ZBAR_UPCA,
          ZBarSymbolType.ZBAR_UPCE,
          ZBarSymbolType.ZBAR_CODE128,
          ZBarSymbolType.ZBAR_CODE39,
          ZBarSymbolType.ZBAR_QRCODE,
        ]
        for (const sym of enable) {
          scanner.setConfig(sym, ZBarConfigType.ZBAR_CFG_ENABLE, 1)
        }
        wasmScannerRef.current = scanner
        setEngineType('wasm')
      } catch {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setScanStatus('idle')
        emitError('not_supported')
        return false
      }
    }

    runningRef.current = true
    setIsScanning(true)
    setScanStatus('scanning')
    startedAtRef.current = Date.now()
    rafRef.current = requestAnimationFrame(() => { tickDetect() })
    return true
  }, [emitError, stopTracks, tickDetect])

  const start = useCallback(async () => {
    return startStream(facingRef.current || 'environment')
  }, [startStream])

  const stop = useCallback(() => {
    stopTracks()
  }, [stopTracks])

  const switchCamera = useCallback(async () => {
    const next = facingRef.current === 'environment' ? 'user' : 'environment'
    return startStream(next)
  }, [startStream])

  useEffect(() => () => {
    stopTracks()
  }, [stopTracks])

  return {
    videoRef,
    start,
    stop,
    switchCamera,
    isScanning,
    lastError,
    engineType,
    facingMode,
    scanStatus,
  }
}
