import { useCallback, useRef, useState } from 'react'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const PX_PER_MM = 1.85

/**
 * Visual A4 drag preview for stamp/signature placement.
 * Horizontal mm = inset from left (alignLeft) or right edge; bottom = from page bottom.
 */
export default function StampSignaturePlacementPreview({
  stampSrc,
  signatureSrc,
  stampWidthMm = 38,
  signatureWidthMm = 42,
  stampOffsetRightMm = 55,
  stampOffsetBottomMm = 18,
  signatureOffsetRightMm = 12,
  signatureOffsetBottomMm = 14,
  alignLeft = false,
  onChangeOffsets,
}) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const [active, setActive] = useState(null)

  const stampW = Math.max(Number(stampWidthMm) || 38, 8)
  const sigW = Math.max(Number(signatureWidthMm) || 42, 8)
  const sigH = Math.max(sigW * 0.55, 10)
  const stampHInset = Math.max(0, Number(stampOffsetRightMm) || 0)
  const stampBottom = Math.max(0, Number(stampOffsetBottomMm) || 0)
  const sigHInset = Math.max(0, Number(signatureOffsetRightMm) || 0)
  const sigBottom = Math.max(0, Number(signatureOffsetBottomMm) || 0)

  const emit = useCallback(
    (patch) => {
      if (typeof onChangeOffsets === 'function') onChangeOffsets(patch)
    },
    [onChangeOffsets]
  )

  const onPointerDown = (kind, e) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget
    target.setPointerCapture?.(e.pointerId)
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startH: kind === 'stamp' ? stampHInset : sigHInset,
      startBottom: kind === 'stamp' ? stampBottom : sigBottom,
      widthMm: kind === 'stamp' ? stampW : sigW,
      heightMm: kind === 'stamp' ? stampW : sigH,
    }
    setActive(kind)
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    // Left align: move right increases inset-from-left; right align: move right decreases inset-from-right
    let nextH = alignLeft ? d.startH + dx / PX_PER_MM : d.startH - dx / PX_PER_MM
    let nextBottom = d.startBottom - dy / PX_PER_MM
    nextH = Math.max(0, Math.min(A4_WIDTH_MM - d.widthMm, nextH))
    nextBottom = Math.max(0, Math.min(A4_HEIGHT_MM - d.heightMm, nextBottom))
    nextH = Math.round(nextH * 10) / 10
    nextBottom = Math.round(nextBottom * 10) / 10
    if (d.kind === 'stamp') {
      emit({ stampOffsetRightMm: String(nextH), stampOffsetBottomMm: String(nextBottom) })
    } else {
      emit({ signatureOffsetRightMm: String(nextH), signatureOffsetBottomMm: String(nextBottom) })
    }
  }

  const onPointerUp = (e) => {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null
    setActive(null)
  }

  const canvasW = A4_WIDTH_MM * PX_PER_MM
  const canvasH = A4_HEIGHT_MM * PX_PER_MM
  const stampPos = alignLeft
    ? { left: stampHInset * PX_PER_MM, bottom: stampBottom * PX_PER_MM }
    : { right: stampHInset * PX_PER_MM, bottom: stampBottom * PX_PER_MM }
  const sigPos = alignLeft
    ? { left: sigHInset * PX_PER_MM, bottom: sigBottom * PX_PER_MM }
    : { right: sigHInset * PX_PER_MM, bottom: sigBottom * PX_PER_MM }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-600">
        Drag stamp/signature. Horizontal mm is from the {alignLeft ? 'left' : 'right'} edge; bottom from page bottom (matches PDF).
        Thermal POS receipts are unchanged.
      </p>
      <div
        ref={canvasRef}
        className="relative mx-auto border border-neutral-300 bg-white shadow-sm select-none touch-none"
        style={{ width: canvasW, height: canvasH, maxWidth: '100%' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="absolute inset-x-3 top-3 bottom-10 border border-dashed border-neutral-200 pointer-events-none" />
        <div className="absolute left-2 top-2 text-[10px] text-neutral-400 pointer-events-none">A4 body area</div>
        <div className={`absolute bottom-2 text-[10px] text-neutral-400 pointer-events-none ${alignLeft ? 'left-2' : 'right-2'}`}>
          {alignLeft ? 'First Party / stamp' : 'For company'}
        </div>

        {stampSrc ? (
          <img
            src={stampSrc}
            alt="Stamp placement"
            draggable={false}
            onPointerDown={(e) => onPointerDown('stamp', e)}
            className={`absolute object-contain cursor-move ${active === 'stamp' ? 'ring-2 ring-primary-500 z-20' : 'z-10'}`}
            style={{
              width: stampW * PX_PER_MM,
              height: stampW * PX_PER_MM,
              ...stampPos,
            }}
          />
        ) : null}

        {signatureSrc ? (
          <img
            src={signatureSrc}
            alt="Signature placement"
            draggable={false}
            onPointerDown={(e) => onPointerDown('signature', e)}
            className={`absolute object-contain cursor-move ${active === 'signature' ? 'ring-2 ring-primary-500 z-30' : 'z-20'}`}
            style={{
              width: sigW * PX_PER_MM,
              height: sigH * PX_PER_MM,
              ...sigPos,
            }}
          />
        ) : null}

        {!stampSrc && !signatureSrc ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
            Upload stamp and signature to preview placement
          </div>
        ) : null}
      </div>
    </div>
  )
}
