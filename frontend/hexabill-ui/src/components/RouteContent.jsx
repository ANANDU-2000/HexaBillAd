import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import { PageLoading } from './Loading'

export default function RouteContent() {
  const location = useLocation()
  return (
    <ErrorBoundary contained resetKey={location.key}>
      <Suspense fallback={<PageLoading navigationAvailable />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  )
}
