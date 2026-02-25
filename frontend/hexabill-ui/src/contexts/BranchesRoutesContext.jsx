/**
 * BranchesRoutesContext - Centralized cache for branches, routes, and staff assignments.
 * Prevents 429 rate limits by fetching once and sharing across all pages.
 * Cache invalidates on user/tenant change or explicit refresh.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { branchesAPI, routesAPI, usersAPI } from '../services'
import { isAdminOrOwner } from '../utils/roles'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes - branches/routes rarely change

const BranchesRoutesContext = createContext(null)

export function BranchesRoutesProvider({ children }) {
  const { user, impersonatedTenantId } = useAuth()
  const [branches, setBranches] = useState([])
  const [routes, setRoutes] = useState([])
  const [assignedRouteIds, setAssignedRouteIds] = useState([])
  const [assignedBranchIds, setAssignedBranchIds] = useState([])
  const [staffHasNoAssignments, setStaffHasNoAssignments] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const lastFetchRef = useRef(0)
  const fetchInProgressRef = useRef(false)

  const load = useCallback(async (forceRefresh = false) => {
    if (!user?.id) {
      setBranches([])
      setRoutes([])
      setAssignedRouteIds([])
      setAssignedBranchIds([])
      setStaffHasNoAssignments(false)
      setLoading(false)
      return
    }

    const now = Date.now()
    const cacheValid = !forceRefresh && (now - lastFetchRef.current) < CACHE_TTL_MS
    if (cacheValid && branches.length > 0) return
    if (fetchInProgressRef.current) return

    fetchInProgressRef.current = true
    setLoading(true)
    setError(null)

    try {
      const isManagerOrAdmin = isAdminOrOwner(user)
      let serverAssignedRouteIds = []
      let serverAssignedBranchIds = []

      if (!isManagerOrAdmin) {
        try {
          const meRes = await usersAPI.getMyAssignedRoutes()
          if (meRes?.success && meRes?.data) {
            serverAssignedRouteIds = meRes.data.assignedRouteIds || []
            serverAssignedBranchIds = meRes.data.assignedBranchIds || []
          }
        } catch (_) {
          /* API failure: keep empty */
        }
        setAssignedRouteIds(serverAssignedRouteIds)
        setAssignedBranchIds(serverAssignedBranchIds)
        setStaffHasNoAssignments(
          serverAssignedBranchIds.length === 0 && serverAssignedRouteIds.length === 0
        )
      } else {
        setStaffHasNoAssignments(false)
      }

      let branchList = []
      let routeList = []
      try {
        const [bRes, rRes] = await Promise.all([
          branchesAPI.getBranches(),
          routesAPI.getRoutes()
        ])
        branchList = (bRes?.success && Array.isArray(bRes?.data)) ? bRes.data : (Array.isArray(bRes?.data) ? bRes.data : (Array.isArray(bRes) ? bRes : []))
        routeList = (rRes?.success && Array.isArray(rRes?.data)) ? rRes.data : (Array.isArray(rRes?.data) ? rRes.data : (Array.isArray(rRes) ? rRes : []))
      } catch (apiErr) {
        const msg = apiErr?.response?.data?.message || apiErr?.message || 'Failed to load branches and routes'
        setError(msg)
        console.error('[BranchesRoutesContext]', msg, apiErr?.response?.data)
      }

      if (!isManagerOrAdmin && (serverAssignedBranchIds.length > 0 || serverAssignedRouteIds.length > 0)) {
        if (serverAssignedBranchIds.length > 0) {
          branchList = branchList.filter(b => serverAssignedBranchIds.includes(b.id))
        }
        if (serverAssignedRouteIds.length > 0) {
          routeList = routeList.filter(r => serverAssignedRouteIds.includes(r.id))
        }
      }

      setBranches(branchList)
      setRoutes(routeList)
      lastFetchRef.current = Date.now()
    } catch (err) {
      setError(err?.message || 'Failed to load branches and routes')
    } finally {
      setLoading(false)
      fetchInProgressRef.current = false
    }
  }, [user])

  // Load on mount and when user/tenant changes. On tenant switch, clear state first so we don't show previous tenant's data.
  useEffect(() => {
    setBranches([])
    setRoutes([])
    load(true)
  }, [user?.id, impersonatedTenantId])

  const refresh = useCallback(() => {
    lastFetchRef.current = 0
    load(true)
  }, [load])

  const value = {
    branches,
    routes,
    assignedRouteIds,
    assignedBranchIds,
    staffHasNoAssignments,
    loading,
    error,
    refresh
  }

  return (
    <BranchesRoutesContext.Provider value={value}>
      {children}
    </BranchesRoutesContext.Provider>
  )
}

export function useBranchesRoutes() {
  const ctx = useContext(BranchesRoutesContext)
  if (!ctx) {
    throw new Error('useBranchesRoutes must be used within BranchesRoutesProvider')
  }
  return ctx
}
