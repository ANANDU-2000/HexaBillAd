import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * One back control for detail and editor pages: top-left, names where it goes, 44px touch target.
 * Use a real route (to) so it also works when the page was opened from a link or after a reload.
 */
export default function BackLink ({ to, label, className = '' }) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-11 items-center gap-1 self-start rounded-md pr-3 text-sm font-medium text-primary-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      <span>{label}</span>
    </Link>
  )
}
