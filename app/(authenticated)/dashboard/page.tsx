'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Type definitions
interface DashboardEntry {
  entry_id: number
  assay_id: number
  assay_name: string
  lookback_days: number | null
  last_checked: string | null
  nuccor_entries_found: number | null
  nuccor_queue_entry: number | null
}

interface UserInfo {
  email: string | null
  displayName: string | null
  institution: string | null
}

export default function DashboardPage() {
  const [userInfo, setUserInfo] = useState<UserInfo>({
    email: null,
    displayName: null,
    institution: null,
  })
  const [assaysCount, setAssaysCount] = useState<number>(0)
  const [oligosCount, setOligosCount] = useState<number>(0)
  const [dashboardEntries, setDashboardEntries] = useState<DashboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  
  // Checkbox state
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())
  const [lookbackDays, setLookbackDays] = useState<string>('30')
  const [runCheckLoading, setRunCheckLoading] = useState(false)
  const [runCheckError, setRunCheckError] = useState<string | null>(null)
  
  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch user info
  const fetchUserInfo = async () => {
    try {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser()
      const userEmail = user?.email || null

      // Fetch name and institution from database
      const { data, error: fetchError } = await supabase.rpc('fetch_user_name_institution')

      if (fetchError) {
        console.error('Error fetching user settings:', fetchError)
        // Still set email even if settings fetch fails
        setUserInfo({
          email: userEmail,
          displayName: null,
          institution: null,
        })
        return
      }

      // The function returns an array with one row, or empty array if no entry exists
      let displayName: string | null = null
      let institution: string | null = null

      if (data && Array.isArray(data) && data.length > 0) {
        displayName = data[0].user_name || null
        institution = data[0].user_institution || null
      }

      setUserInfo({
        email: userEmail,
        displayName,
        institution,
      })
    } catch (err: any) {
      console.error('Error fetching user info:', err)
      // Set email if available even on error
      const { data: { user } } = await supabase.auth.getUser()
      setUserInfo({
        email: user?.email || null,
        displayName: null,
        institution: null,
      })
    }
  }

  // Fetch assays count
  const fetchAssaysCount = async () => {
    try {
      const { data, error: fetchError } = await supabase.rpc('fetch_user_assays')
      if (fetchError) {
        console.error('Error fetching assays:', fetchError)
        return
      }
      setAssaysCount(Array.isArray(data) ? data.length : 0)
    } catch (err: any) {
      console.error('Error fetching assays count:', err)
    }
  }

  // Fetch oligos count
  const fetchOligosCount = async () => {
    try {
      const { data, error: fetchError } = await supabase.rpc('fetch_user_oligos')
      if (fetchError) {
        console.error('Error fetching oligos:', fetchError)
        return
      }
      setOligosCount(Array.isArray(data) ? data.length : 0)
    } catch (err: any) {
      console.error('Error fetching oligos count:', err)
    }
  }

  // Fetch dashboard entries
  // First calls fetch_dashboard_entries to sync the dashboard_entries table,
  // then calls fetch_dashboard_update to get all columns including nuccor_queue_entry
  const fetchDashboardEntries = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      }
      setError(null)
      
      // Step 1: Call fetch_dashboard_entries first to sync the dashboard_entries table
      // This ensures assays are entered and orphaned entries are deleted
      const syncResult = await supabase.rpc('fetch_dashboard_entries')
      
      if (syncResult.error) {
        throw syncResult.error
      }

      // Step 2: Fetch dashboard entries with all columns (including nuccor_queue_entry)
      // and assays in parallel
      const [entriesResult, assaysResult] = await Promise.all([
        supabase.rpc('fetch_dashboard_update'),
        supabase.rpc('fetch_user_assays')
      ])

      if (entriesResult.error) {
        throw entriesResult.error
      }

      if (assaysResult.error) {
        throw assaysResult.error
      }

      // Create a map of assay_id to assay_name
      const assayMap = new Map<number, string>()
      if (assaysResult.data && Array.isArray(assaysResult.data)) {
        assaysResult.data.forEach((assay: any) => {
          assayMap.set(Number(assay.assay_id), assay.assay_name || 'Unknown')
        })
      }

      // Map the response to our DashboardEntry interface
      if (entriesResult.data && Array.isArray(entriesResult.data)) {
        const mappedData = entriesResult.data.map((item: any) => ({
          entry_id: Number(item.entry_id),
          assay_id: Number(item.assay_id),
          assay_name: assayMap.get(Number(item.assay_id)) || 'Unknown',
          lookback_days: item.lookback_days ? Number(item.lookback_days) : null,
          last_checked: item.last_checked || null,
          nuccor_entries_found: item.nuccor_entries_found ? Number(item.nuccor_entries_found) : null,
          nuccor_queue_entry: item.nuccor_queue_entry ? Number(item.nuccor_queue_entry) : null,
        }))
        setDashboardEntries(mappedData)
      } else {
        setDashboardEntries([])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard entries')
      console.error('Error fetching dashboard entries:', err)
    } finally {
      setLoading(false)
      if (showRefreshing) {
        setRefreshing(false)
      }
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchUserInfo(),
        fetchAssaysCount(),
        fetchOligosCount(),
        fetchDashboardEntries(),
      ])
    }
    loadData()
  }, [fetchDashboardEntries])

  // Handle checkbox toggle - prevent selecting entries with queued jobs
  const handleCheckboxToggle = (entryId: number) => {
    const entry = dashboardEntries.find((e) => e.entry_id === entryId)
    // Don't allow selection if job is queued
    if (entry && entry.nuccor_queue_entry !== null) {
      return
    }
    
    setSelectedEntries((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(entryId)) {
        newSet.delete(entryId)
      } else {
        newSet.add(entryId)
      }
      return newSet
    })
  }

  // Handle check all - only select entries without queued jobs
  const handleCheckAll = () => {
    const selectableEntries = dashboardEntries.filter(
      (entry) => entry.nuccor_queue_entry === null
    )
    const selectableIds = new Set(selectableEntries.map((entry) => entry.entry_id))
    
    // Check if all selectable entries are already selected
    const allSelectableSelected = selectableIds.size > 0 && 
      Array.from(selectableIds).every((id) => selectedEntries.has(id))
    
    if (allSelectableSelected) {
      // Uncheck all
      setSelectedEntries(new Set())
    } else {
      // Check all selectable entries
      setSelectedEntries(new Set(selectableIds))
    }
  }
  
  // Manual refresh handler
  const handleRefresh = async () => {
    await fetchDashboardEntries(true)
  }
  
  // Setup auto-refresh timer
  useEffect(() => {
    if (autoRefreshEnabled) {
      // Refresh every 5 seconds
      refreshIntervalRef.current = setInterval(() => {
        fetchDashboardEntries(false)
      }, 5000)
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
      }
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [autoRefreshEnabled, fetchDashboardEntries])

  // Handle run check
  const handleRunCheck = async () => {
    if (selectedEntries.size === 0) {
      setRunCheckError('Please select at least one entry to check')
      return
    }

    const lookbackDaysNum = parseInt(lookbackDays, 10)
    if (isNaN(lookbackDaysNum) || lookbackDaysNum <= 0) {
      setRunCheckError('Lookback days must be a positive integer')
      return
    }

    // Filter out entries that already have queued jobs (safety check)
    const validEntries = Array.from(selectedEntries).filter((entryId) => {
      const entry = dashboardEntries.find((e) => e.entry_id === entryId)
      return entry && entry.nuccor_queue_entry === null
    })

    if (validEntries.length === 0) {
      setRunCheckError('Selected entries already have jobs queued')
      return
    }

    setRunCheckLoading(true)
    setRunCheckError(null)

    try {
      // Call order_dashboard_job for each selected entry
      const promises = validEntries.map((entryId) =>
        supabase.rpc('order_dashboard_job', {
          p_job_type: 1, // Currently there is only one job. Has to be amended later
          p_entry_id: entryId,
          p_lookback_days: lookbackDaysNum,
        })
      )

      const results = await Promise.all(promises)

      // Check for errors
      const errors = results.filter((result) => result.error)
      if (errors.length > 0) {
        const errorMessages = errors.map((e) => e.error?.message || 'Unknown error').join('; ')
        throw new Error(`Failed to queue some jobs: ${errorMessages}`)
      }

      // Clear selection and refresh dashboard entries
      setSelectedEntries(new Set())
      await fetchDashboardEntries(false)
    } catch (err: any) {
      setRunCheckError(err.message || 'Failed to queue jobs')
      console.error('Error running check:', err)
    } finally {
      setRunCheckLoading(false)
    }
  }

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        Dashboard
      </h1>

      {/* General Information Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          General Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <p className="text-gray-600 dark:text-gray-400">
              {userInfo.displayName || <span className="italic">Not set</span>}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Institution
            </label>
            <p className="text-gray-600 dark:text-gray-400">
              {userInfo.institution || <span className="italic">Not set</span>}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <p className="text-gray-600 dark:text-gray-400">
              {userInfo.email || 'Not available'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Assays
            </label>
            <p className="text-gray-600 dark:text-gray-400">
              {assaysCount}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Oligos
            </label>
            <p className="text-gray-600 dark:text-gray-400">
              {oligosCount}
            </p>
          </div>
        </div>
      </div>

      {/* Assay Surveillance Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Assay Surveillance
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label
                htmlFor="lookback-days"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Lookback Days:
              </label>
              <input
                type="number"
                id="lookback-days"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(e.target.value)}
                min="1"
                step="1"
                className="w-20 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors flex items-center gap-2"
              title="Refresh dashboard entries"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-refresh"
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="auto-refresh"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                Auto-refresh
              </label>
            </div>
            <button
              onClick={handleRunCheck}
              disabled={runCheckLoading || selectedEntries.size === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors"
            >
              {runCheckLoading ? 'Running Check...' : 'Run Check'}
            </button>
          </div>
        </div>

        {runCheckError && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 text-sm">{runCheckError}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading dashboard entries...</p>
          </div>
        ) : dashboardEntries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No dashboard entries found. Create assays with target taxids to see them here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={
                        dashboardEntries.length > 0 &&
                        dashboardEntries.filter((e) => e.nuccor_queue_entry === null).length > 0 &&
                        dashboardEntries
                          .filter((e) => e.nuccor_queue_entry === null)
                          .every((e) => selectedEntries.has(e.entry_id))
                      }
                      onChange={handleCheckAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Assay Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Lookback Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Last Checked
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Entries Found
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dashboardEntries.map((entry) => {
                  const hasQueuedJob = entry.nuccor_queue_entry !== null
                  return (
                    <tr
                      key={entry.entry_id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        hasQueuedJob ? 'opacity-75' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedEntries.has(entry.entry_id)}
                          onChange={() => handleCheckboxToggle(entry.entry_id)}
                          disabled={hasQueuedJob}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {hasQueuedJob ? (
                          <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            <svg
                              className="w-3 h-3 animate-spin"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Queued
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Ready
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {entry.assay_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {entry.lookback_days !== null ? entry.lookback_days : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(entry.last_checked)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {entry.nuccor_entries_found !== null ? entry.nuccor_entries_found : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

