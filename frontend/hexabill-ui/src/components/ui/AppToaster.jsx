import { useEffect } from 'react'
import toast, { Toaster, ToastBar, resolveValue, useToasterStore } from 'react-hot-toast'
import { Loader2, X } from 'lucide-react'
import { NOTICE_TONES } from './Alert'

const TOAST_LIMIT = 3

// react-hot-toast types -> notice tone. Plain toast() and custom toasts read as information.
const toneOf = (type) => (type === 'success' || type === 'error' ? type : 'info')

// Flat ERP toast: no bounce, no animated icon, no pill. Colour lives only in the left bar and icon.
const toastStyle = {
  background: '#ffffff',
  color: '#1f2937',
  borderRadius: '10px',
  border: '1px solid #e5e7eb',
  padding: '10px 10px 10px 12px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.06)',
  width: 'min(380px, calc(100vw - 24px))',
  maxWidth: 'none',
  fontSize: '14px',
  lineHeight: '20px',
}

export default function AppToaster() {
  const { toasts } = useToasterStore()

  useEffect(() => {
    const visible = toasts.filter((t) => t.visible)
    if (visible.length > TOAST_LIMIT) {
      visible.slice(0, visible.length - TOAST_LIMIT).forEach((t) => toast.dismiss(t.id))
    }
  }, [toasts])

  return (
    <Toaster
      position="bottom-center"
      toastOptions={{ duration: 3000, className: 'hb-toast', style: toastStyle, error: { duration: 5000 } }}
      containerClassName="hb-toaster"
      gutter={6}
    >
      {(t) => {
        const { icon, Icon } = NOTICE_TONES[toneOf(t.type)]
        const loading = t.type === 'loading'
        return (
          <ToastBar
            toast={t}
            style={{
              ...toastStyle,
              // Short fade only; the library default is a scale/bounce.
              animation: t.visible ? 'hb-toast-in 140ms ease-out both' : 'hb-toast-out 100ms ease-in both',
            }}
          >
            {() => (
              <div className="flex w-full items-start gap-2.5">
                {loading ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-neutral-500" aria-hidden />
                ) : (
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} strokeWidth={2} aria-hidden />
                )}
                <div
                  role={t.type === 'error' ? 'alert' : 'status'}
                  aria-live={t.type === 'error' ? 'assertive' : 'polite'}
                  className="min-w-0 flex-1 break-words font-medium text-neutral-900"
                >
                  {resolveValue(t.message, t)}
                </div>
                {t.type !== 'loading' && (
                  <button
                    type="button"
                    onClick={() => toast.dismiss(t.id)}
                    className="-my-2 -mr-2 flex h-touch w-touch shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            )}
          </ToastBar>
        )
      }}
    </Toaster>
  )
}
