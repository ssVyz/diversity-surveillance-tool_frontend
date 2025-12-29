'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Type definitions
interface DashboardEntry {
  entry_id: number
  assay_name: string
  lookback_days: number | null
  last_checked: string | null
  nuccor_entries_found: number | null
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
  
  // Checkbox state
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())
  const [lookbackDays, setLookbackDays] = useState<string>('30')
  const [runCheckLoading, setRunCheckLoading] = useState(false)
  const [runCheckError, setRunCheckError] = useState<string | null>(null)

  // Fetch user info
  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserInfo({
          email: user.email || null,
          displayName: null, // Placeholder - not set up yet
          institution: null, // Placeholder - not set up yet
        })
      }
    } catch (err: any) {
      console.error('Error fetching user info:', err)
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
  const fetchDashboardEntries = async () => {
    try {
      setError(null)
      const { data, error: fetchError } = await supabase.rpc('fetch_dashboard_entries')

      if (fetchError) {
        throw fetchError
      }

      // Map the response to our DashboardEntry interface
      if (data && Array.isArray(data)) {
        const mappedData = data.map((item: any) => ({
          entry_id: Number(item.entry_id),
          assay_name: item.assay_name || '',
          lookback_days: item.lookback_days ? Number(item.lookback_days) : null,
          last_checked: item.last_checked || null,
          nuccor_entries_found: item.nuccor_entries_found ? Number(item.nuccor_entries_found) : null,
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
    }
  }

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
  }, [])

  // Handle checkbox toggle
  const handleCheckboxToggle = (entryId: number) => {
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

  // Handle check all
  const handleCheckAll = () => {
    if (selectedEntries.size === dashboardEntries.length) {
      // Uncheck all
      setSelectedEntries(new Set())
    } else {
      // Check all
      setSelectedEntries(new Set(dashboardEntries.map((entry) => entry.entry_id)))
    }
  }

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

    setRunCheckLoading(true)
    setRunCheckError(null)

    try {
      // Call order_dashboard_job for each selected entry
      const promises = Array.from(selectedEntries).map((entryId) =>
        supabase.rpc('order_dashboard_job', {
          p_job_type: '1', // As specified by user
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
      await fetchDashboardEntries()
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
            <p className="text-gray-600 dark:text-gray-400 italic">
              {userInfo.displayName || 'Not set'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Institution
            </label>
            <p className="text-gray-600 dark:text-gray-400 italic">
              {userInfo.institution || 'Not set'}
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
                      checked={selectedEntries.size === dashboardEntries.length && dashboardEntries.length > 0}
                      onChange={handleCheckAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
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
                {dashboardEntries.map((entry) => (
                  <tr
                    key={entry.entry_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedEntries.has(entry.entry_id)}
                        onChange={() => handleCheckboxToggle(entry.entry_id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

