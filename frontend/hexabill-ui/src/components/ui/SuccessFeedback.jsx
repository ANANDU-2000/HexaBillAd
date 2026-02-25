/**
 * SuccessFeedback - Task 18
 * Green checkmark, auto-dismiss, optional undo. Use with toast or inline.
 */
export default function SuccessFeedback({
  message = 'Success!',
  onUndo,
  showCheck = true,
  className = '',
}) {
  return (
    <div
      className={`flex items-center gap-2 text-success ${className}`}
      role="status"
      aria-live="polite"
    >
      {showCheck && (
        <svg
          className="w-5 h-5 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className="text-sm font-medium">{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="text-sm underline hover:no-underline ml-2"
        >
          Undo
        </button>
      )}
    </div>
  )
}
