'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Type definitions
interface BlastPlanningEntry {
  planner_entry_id: number
  assay_id: number
  assay_name: string
  oligo_count: number
}

export default function BlastPlannerPage() {
  const [entries, setEntries] = useState<BlastPlanningEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())

  // Form state for BLAST parameters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [identity, setIdentity] = useState<string>('95.0')
  const [coverage, setCoverage] = useState<string>('80.0')
  const [matchScore, setMatchScore] = useState<string>('2.0')
  const [mismatchScore, setMismatchScore] = useState<string>('-1.0')
  const [openGap, setOpenGap] = useState<string>('-0.5')
  const [extendGap, setExtendGap] = useState<string>('-0.1')
  const [oligoMinCover, setOligoMinCover] = useState<string>('1')

  // Fetch planning list
  const fetchPlanningList = async () => {
    try {
      setError(null)
      setLoading(true)
      const { data, error: fetchError } = await supabase.rpc('fetch_blast_planning_list')

      if (fetchError) {
        throw fetchError
      }

      if (data && Array.isArray(data)) {
        const mappedData = data.map((item: any) => ({
          planner_entry_id: Number(item.planner_entry_id),
          assay_id: Number(item.assay_id),
          assay_name: item.assay_name,
          oligo_count: Number(item.oligo_count),
        }))
        setEntries(mappedData)
        setSelectedEntries(new Set()) // Clear selections when list refreshes
      } else {
        setEntries([])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch planning list')
      console.error('Error fetching planning list:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlanningList()
  }, [])

  // Handle checkbox toggle for individual entry
  const handleEntryToggle = (plannerEntryId: number) => {
    const newSelected = new Set(selectedEntries)
    if (newSelected.has(plannerEntryId)) {
      newSelected.delete(plannerEntryId)
    } else {
      newSelected.add(plannerEntryId)
    }
    setSelectedEntries(newSelected)
  }

  // Handle "check all" toggle
  const handleSelectAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set())
    } else {
      setSelectedEntries(new Set(entries.map((e) => e.planner_entry_id)))
    }
  }

  // Validate form
  const validateForm = (): string | null => {
    if (!dateFrom.trim()) {
      return 'Date From is required'
    }
    if (!dateTo.trim()) {
      return 'Date To is required'
    }
    if (selectedEntries.size === 0) {
      return 'Please select at least one assay'
    }

    // Validate numeric fields
    const numFields = [
      { name: 'Identity', value: identity },
      { name: 'Coverage', value: coverage },
      { name: 'Match Score', value: matchScore },
      { name: 'Mismatch Score', value: mismatchScore },
      { name: 'Open Gap', value: openGap },
      { name: 'Extend Gap', value: extendGap },
      { name: 'Oligo Min Cover', value: oligoMinCover },
    ]

    for (const field of numFields) {
      const num = parseFloat(field.value)
      if (isNaN(num)) {
        return `${field.name} must be a valid number`
      }
    }

    // Validate oligo_min_cover is an integer >= 1
    const oligoMinCoverNum = parseInt(oligoMinCover)
    if (isNaN(oligoMinCoverNum) || oligoMinCoverNum < 1) {
      return 'Oligo Min Cover must be an integer greater than or equal to 1'
    }

    return null
  }

  // Handle submit - order jobs for all selected entries
  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault()
    }

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const selectedEntryIds = Array.from(selectedEntries)
      const results: Array<{ entryId: number; success: boolean; error?: string }> = []

      // Process each selected entry
      for (const plannerEntryId of selectedEntryIds) {
        try {
          const { data, error: orderError } = await supabase.rpc('order_blast_aligner_job', {
            p_planner_entry_id: plannerEntryId,
            p_date_from: dateFrom.trim(),
            p_date_to: dateTo.trim(),
            p_identity: parseFloat(identity),
            p_coverage: parseFloat(coverage),
            p_match_score: parseFloat(matchScore),
            p_mismatch_score: parseFloat(mismatchScore),
            p_opengap: parseFloat(openGap),
            p_extendgap: parseFloat(extendGap),
            p_oligo_min_cover: parseInt(oligoMinCover),
          })

          if (orderError) {
            results.push({ entryId: plannerEntryId, success: false, error: orderError.message })
          } else {
            results.push({ entryId: plannerEntryId, success: true })
          }
        } catch (err: any) {
          results.push({
            entryId: plannerEntryId,
            success: false,
            error: err.message || 'Failed to order job',
          })
        }
      }

      // Check if all succeeded
      const failures = results.filter((r) => !r.success)
      if (failures.length > 0) {
        const errorMessages = failures.map((f) => {
          const entry = entries.find((e) => e.planner_entry_id === f.entryId)
          return `${entry?.assay_name || f.entryId}: ${f.error}`
        })
        setError(`Some jobs failed:\n${errorMessages.join('\n')}`)
      }

      // Refresh the list (this will remove successfully processed entries)
      await fetchPlanningList()
    } catch (err: any) {
      setError(err.message || 'Failed to submit jobs')
      console.error('Error submitting jobs:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          BLAST Planner
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Schedule BLAST aligner jobs for your assays. Only assays with a target taxid, reference amplicon, and at least one oligo are eligible.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 whitespace-pre-line">{error}</p>
        </div>
      )}

      {/* Setup Section */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Job Parameters
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="dateFrom"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Date From <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label
                htmlFor="dateTo"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Date To <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* BLAST Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="identity"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                BLAST Identity (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="identity"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                step="0.1"
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label
                htmlFor="coverage"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                BLAST Coverage (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="coverage"
                value={coverage}
                onChange={(e) => setCoverage(e.target.value)}
                step="0.1"
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Pairwise Aligner Parameters */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Pairwise Aligner Parameters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="matchScore"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Match Score <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="matchScore"
                  value={matchScore}
                  onChange={(e) => setMatchScore(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="mismatchScore"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Mismatch Score <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="mismatchScore"
                  value={mismatchScore}
                  onChange={(e) => setMismatchScore(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="openGap"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Open Gap Penalty <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="openGap"
                  value={openGap}
                  onChange={(e) => setOpenGap(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="extendGap"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Extend Gap Penalty <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="extendGap"
                  value={extendGap}
                  onChange={(e) => setExtendGap(e.target.value)}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Oligo Min Cover */}
          <div>
            <label
              htmlFor="oligoMinCover"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Oligo Minimum Coverage <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="oligoMinCover"
              value={oligoMinCover}
              onChange={(e) => setOligoMinCover(e.target.value)}
              min="1"
              step="1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Minimum number of oligos that must cover a sequence region
            </p>
          </div>

          {/* Submit button in form (for keyboard accessibility, main button is in list section) */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={submitting || selectedEntries.size === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors"
            >
              {submitting ? 'Processing...' : 'Run BLAST-Align'}
            </button>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Select assays from the list below, then click this button or use the button in the assay list section.
            </p>
          </div>
        </form>
      </div>

      {/* Assay List Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Eligible Assays
          </h2>
          {entries.length > 0 && (
            <div className="flex items-center gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedEntries.size === entries.length && entries.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Select All
                </span>
              </label>
              <button
                onClick={(e) => handleSubmit(e)}
                disabled={submitting || selectedEntries.size === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors"
              >
                {submitting ? 'Processing...' : 'Run BLAST-Align'}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading assays...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No eligible assays found. Assays must have:
            </p>
            <ul className="text-sm text-gray-500 dark:text-gray-400 list-disc list-inside space-y-1">
              <li>A target taxid</li>
              <li>A reference amplicon</li>
              <li>At least one oligo</li>
              <li>Not already in a BLAST aligner job</li>
            </ul>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedEntries.size === entries.length && entries.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Assay Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Oligo Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {entries.map((entry) => (
                  <tr
                    key={entry.planner_entry_id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedEntries.has(entry.planner_entry_id)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedEntries.has(entry.planner_entry_id)}
                        onChange={() => handleEntryToggle(entry.planner_entry_id)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {entry.assay_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {entry.oligo_count}
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

