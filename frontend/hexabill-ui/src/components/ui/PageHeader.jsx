/**
 * Page header: one per page, directly inside the shell content area.
 *
 * The mobile top bar already shows the page title, so below md the title is
 * visually hidden (still in the accessibility tree) unless `showTitleOnMobile`.
 * Actions: at most one primary button; put the rest in an overflow menu.
 * On phones the actions wrap under the title and share the full width.
 * Renders a <div>, not <header>, so the shell keeps the only banner landmark.
 */
export default function PageHeader({
  title,
  description,
  actions,
  meta,
  showTitleOnMobile = false,
  className = '',
}) {
  return (
    <div
      data-page-header
      className={`mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between ${className}`}
    >
      <div className="min-w-0">
        <h1 className={`${showTitleOnMobile ? '' : 'sr-only md:not-sr-only'} text-h2 font-semibold text-text-primary md:text-h1`}>
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>
      )}
    </div>
  )
}
