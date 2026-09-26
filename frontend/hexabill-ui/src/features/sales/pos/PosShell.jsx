/** Fixed viewport shell — only children body should scroll. */
export default function PosShell({ header, toolbar, footer, children, className = '' }) {
  return (
    <div
      className={`h-[100dvh] max-h-[100dvh] flex flex-col max-w-full overflow-hidden bg-[#F8FAFC] ${className}`}
      data-pos-shell="enterprise-v2"
    >
      {header}
      {toolbar}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        {children}
      </div>
      {footer}
    </div>
  )
}
