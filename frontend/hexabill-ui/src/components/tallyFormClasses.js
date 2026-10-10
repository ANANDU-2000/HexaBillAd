/** Shared Tally-style voucher + mobile form layout (purchase, supplier, POS, ledger filters) */

/** Page shell: no horizontal page scroll on mobile */
export const mobilePageShellClass = 'w-full max-w-full overflow-x-hidden'

// Voucher fields share the neutral input look (the old lime 2px border was removed in the design-system pass).
export const tallyInputClass =
  'w-full max-w-full px-3 py-2 min-h-11 text-base md:min-h-10 md:text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed'

export const tallySelectClass =
  'w-full max-w-full px-3 py-2 min-h-11 text-base md:min-h-10 md:text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:opacity-50'

export const tallyLabelClass = 'block text-sm font-medium text-neutral-700 mb-1'

export const tallySectionClass = 'mb-4 p-3 sm:p-4 bg-white rounded-lg border border-surface-border w-full max-w-full'

export const tallySectionTitleClass = 'text-sm font-semibold text-neutral-900 mb-3'

export const tallyVoucherShellClass =
  'bg-white rounded-lg border border-surface-border p-4 sm:p-6 mb-6 w-full max-w-full overflow-hidden'

/** Neutral fields (POS payment sheet, ledger filters, modals) */
export const mobileFormFieldClass =
  'w-full max-w-full px-3 py-2.5 min-h-11 text-base border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed'

export const mobileFormSelectClass =
  'w-full max-w-full px-3 py-2.5 min-h-11 text-base border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50'

export const mobileFormSectionClass =
  'w-full max-w-full rounded-lg border border-surface-border bg-white p-3 sm:p-4 space-y-3'

export const mobileFormStackClass = 'flex flex-col gap-3 w-full max-w-full min-w-0'

/** Compact filter row: 2 columns on phone, no horizontal page scroll */
export const mobileFilterGridClass = 'grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full max-w-full min-w-0'

export const mobileDateInputClass =
  'w-full min-w-0 px-2 py-2 min-h-10 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
