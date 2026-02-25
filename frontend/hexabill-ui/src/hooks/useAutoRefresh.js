/*
Purpose: Auto-refresh hook for real-time updates without page reload
Author: AI Assistant
Date: 2025
*/
import { useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for auto-refreshing data at intervals
 * @param {Function} fetchFunction - Function to call for refresh
 * @param {number} intervalMs - Interval in milliseconds (default: 30000 = 30 seconds)
 * @param {Array} dependencies - Dependencies that trigger refresh (default: [])
 * @param {boolean} enabled - Whether auto-refresh is enabled (default: true)
 */
export function useAutoRefresh(fetchFunction, intervalMs = 30000, dependencies = [], enabled = true) {
  const intervalRef = useRef(null)
  const fetchRef = useRef(fetchFunction)

  // Update ref when function changes
  useEffect(() => {
    fetchRef.current = fetchFunction
  }, [fetchFunction])

  // Set up auto-refresh — only poll when tab is visible
  useEffect(() => {
    if (!enabled) return

    // Initial fetch
    fetchRef.current()

    // Set up interval — skip fetch when tab is hidden
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchRef.current()
    }, intervalMs)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [intervalMs, enabled, ...dependencies])

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchRef.current()
  }, [])

  return { refresh }
}

/**
 * Hook for fast polling (short intervals for critical data)
 */
export function useFastRefresh(fetchFunction, dependencies = []) {
  return useAutoRefresh(fetchFunction, 10000, dependencies) // 10 seconds
}

/**
 * Hook for slow polling (long intervals for less critical data)
 */
export function useSlowRefresh(fetchFunction, dependencies = []) {
  return useAutoRefresh(fetchFunction, 60000, dependencies) // 60 seconds
}

