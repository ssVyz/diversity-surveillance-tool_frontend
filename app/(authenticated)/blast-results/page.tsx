'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Type definitions
interface BlastAlignerJob {
  align_id: number
  created_at: string
  user_auth: string
  alignjob_status: string
  alignjob_assay_id: number
  alignjob_taxid: number
  alignjob_date_from: string
  alignjob_date_to: string
  alignjob_reference_seq: string
  alignjob_oligos: any // JSONB
  alignjob_identity: number | null
  alignjob_coverage: number | null
  alignjob_match_score: number | null
  alignjob_mismatch_score: number | null
  alignjob_opengap: number | null
  alignjob_extendgap: number | null
  alignjob_oligo_min_cover: number | null
  alignjob_result: any | null // JSONB
}

interface UserAssay {
  assay_id: number
  assay_name: string
}

interface ResultPattern {
  count: number
  pattern: string
  examples: string[]
  matched_oligos: number
  total_mismatches: number
}

interface ResultData {
  error: string | null
  success: boolean
  patterns: ResultPattern[]
  statistics: {
    alignment_rate: number
    total_blast_hits: number
    sequences_aligned: number
    filtered_blast_hits: number
    sequences_with_min_matches: number
  }
  per_oligo_stats: Record<string, {
    match_rate: number
    sense_matches: number
    total_matches: number
    antisense_matches: number
  }>
}

export default function BlastResultsPage() {
  const [jobs, setJobs] = useState<BlastAlignerJob[]>([])
  const [assays, setAssays] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set())
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [viewingResult, setViewingResult] = useState<{
    job: BlastAlignerJob
    result: ResultData
  } | null>(null)

  // Fetch assays to map assay_id to assay_name
  const fetchAssays = async () => {
    try {
      const { data, error: fetchError } = await supabase.rpc('fetch_user_assays')
      if (fetchError) {
        console.error('Error fetching assays:', fetchError)
        return
      }
      if (data && Array.isArray(data)) {
        const assayMap = new Map<number, string>()
        data.forEach((assay: any) => {
          assayMap.set(Number(assay.assay_id), assay.assay_name)
        })
        setAssays(assayMap)
      }
    } catch (err) {
      console.error('Error fetching assays:', err)
    }
  }

  // Fetch BLAST aligner jobs
  const fetchJobs = async () => {
    try {
      setError(null)
      setLoading(true)
      const { data, error: fetchError } = await supabase.rpc('fetch_blast_aligner_jobs')

      if (fetchError) {
        throw fetchError
      }

      if (data && Array.isArray(data)) {
        const mappedData = data.map((item: any) => ({
          align_id: Number(item.align_id),
          created_at: item.created_at,
          user_auth: item.user_auth,
          alignjob_status: item.alignjob_status,
          alignjob_assay_id: Number(item.alignjob_assay_id),
          alignjob_taxid: Number(item.alignjob_taxid),
          alignjob_date_from: item.alignjob_date_from,
          alignjob_date_to: item.alignjob_date_to,
          alignjob_reference_seq: item.alignjob_reference_seq,
          alignjob_oligos: item.alignjob_oligos,
          alignjob_identity: item.alignjob_identity ? Number(item.alignjob_identity) : null,
          alignjob_coverage: item.alignjob_coverage ? Number(item.alignjob_coverage) : null,
          alignjob_match_score: item.alignjob_match_score ? Number(item.alignjob_match_score) : null,
          alignjob_mismatch_score: item.alignjob_mismatch_score ? Number(item.alignjob_mismatch_score) : null,
          alignjob_opengap: item.alignjob_opengap ? Number(item.alignjob_opengap) : null,
          alignjob_extendgap: item.alignjob_extendgap ? Number(item.alignjob_extendgap) : null,
          alignjob_oligo_min_cover: item.alignjob_oligo_min_cover ? Number(item.alignjob_oligo_min_cover) : null,
          alignjob_result: item.alignjob_result,
        }))
        setJobs(mappedData)
      } else {
        setJobs([])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch BLAST jobs')
      console.error('Error fetching BLAST jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      await fetchAssays()
      await fetchJobs()
    }
    loadData()
  }, [])

  // Handle checkbox toggle
  const handleCheckboxToggle = (alignId: number) => {
    setSelectedJobs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(alignId)) {
        newSet.delete(alignId)
      } else {
        newSet.add(alignId)
      }
      return newSet
    })
  }

  // Handle select all
  const handleSelectAll = () => {
    if (selectedJobs.size === jobs.length && jobs.length > 0) {
      setSelectedJobs(new Set())
    } else {
      setSelectedJobs(new Set(jobs.map((job) => job.align_id)))
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (selectedJobs.size === 0) {
      setError('Please select at least one job to delete')
      return
    }

    setDeleteLoading(true)
    setError(null)

    try {
      const deletePromises = Array.from(selectedJobs).map((alignId) =>
        supabase.rpc('delete_blast_aligner_job', { p_align_id: alignId })
      )

      const results = await Promise.all(deletePromises)
      const errors = results.filter((result) => result.error)

      if (errors.length > 0) {
        const errorMessages = errors.map((e) => e.error?.message || 'Unknown error').join('; ')
        throw new Error(`Failed to delete some jobs: ${errorMessages}`)
      }

      setSelectedJobs(new Set())
      await fetchJobs()
    } catch (err: any) {
      setError(err.message || 'Failed to delete jobs')
      console.error('Error deleting jobs:', err)
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handle view result
  const handleViewResult = (job: BlastAlignerJob) => {
    if (job.alignjob_status === 'done' && job.alignjob_result) {
      try {
        const result = job.alignjob_result as ResultData
        setViewingResult({ job, result })
      } catch (err) {
        setError('Failed to parse result data')
        console.error('Error parsing result:', err)
      }
    }
  }

  // Get assay name
  const getAssayName = (assayId: number): string => {
    return assays.get(assayId) || `Assay ${assayId}`
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      scheduled: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300' },
      working: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
      done: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300' },
    }
    const colors = statusColors[status] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300' }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        BLAST Results
      </h1>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Actions bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={selectedJobs.size === jobs.length && jobs.length > 0}
              onChange={handleSelectAll}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Select All
            </span>
          </label>
          <button
            onClick={handleDelete}
            disabled={deleteLoading || selectedJobs.size === 0}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors"
          >
            {deleteLoading ? 'Deleting...' : `Delete (${selectedJobs.size})`}
          </button>
        </div>
        <button
          onClick={fetchJobs}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg shadow-sm transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Jobs list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading BLAST jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">No BLAST jobs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedJobs.size === jobs.length && jobs.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Assay Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {jobs.map((job) => {
                  const canViewResult = job.alignjob_status === 'done' && job.alignjob_result !== null
                  return (
                    <tr
                      key={job.align_id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        canViewResult ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => canViewResult && handleViewResult(job)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedJobs.has(job.align_id)}
                          onChange={() => handleCheckboxToggle(job.align_id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {getAssayName(job.alignjob_assay_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(job.alignjob_date_from)} - {formatDate(job.alignjob_date_to)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(job.alignjob_status)}
                        {canViewResult && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Click to view)</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Result Viewer Modal */}
      {viewingResult && (
        <ResultViewer
          job={viewingResult.job}
          result={viewingResult.result}
          assayName={getAssayName(viewingResult.job.alignjob_assay_id)}
          onClose={() => setViewingResult(null)}
        />
      )}
    </div>
  )
}

// Result Viewer Component
interface ResultViewerProps {
  job: BlastAlignerJob
  result: ResultData
  assayName: string
  onClose: () => void
}

function ResultViewer({ job, result, assayName, onClose }: ResultViewerProps) {
  // Parse oligos from JSONB
  const oligos = Array.isArray(job.alignjob_oligos) ? job.alignjob_oligos : []
  const oligoNames = oligos.map((o: any) => o.id || '')
  const oligoSequences = oligos.map((o: any) => o.sequence || '')

  // Export to CSV
  const handleExportCSV = () => {
    const rows: string[][] = []

    // Helper function to add a row
    const addRow = (cells: string[]) => {
      rows.push(cells)
    }

    // Helper function to add an empty row
    const addEmptyRow = () => {
      rows.push([''])
    }

    // Helper function to add a section header
    const addSectionHeader = (title: string) => {
      addEmptyRow()
      addRow([title])
      addRow(['']) // Empty row after header
    }

    // ============================================
    // METADATA SECTION
    // ============================================

    // Assay Name and Date Range
    addSectionHeader('Job Information')
    addRow(['Assay Name', assayName])
    addRow(['Job ID', job.align_id.toString()])
    addRow(['Date Range', `${job.alignjob_date_from} to ${job.alignjob_date_to}`])

    // Statistics
    addSectionHeader('Statistics')
    addRow(['Alignment Rate (%)', result.statistics.alignment_rate.toString()])
    addRow(['Total BLAST Hits', result.statistics.total_blast_hits.toString()])
    addRow(['Sequences Aligned', result.statistics.sequences_aligned.toString()])
    addRow(['Filtered BLAST Hits', result.statistics.filtered_blast_hits.toString()])
    addRow(['Sequences with Min Matches', result.statistics.sequences_with_min_matches.toString()])

    // Per-Oligo Statistics
    if (result.per_oligo_stats && Object.keys(result.per_oligo_stats).length > 0) {
      addSectionHeader('Per-Oligo Statistics')
      // Header row
      addRow(['Oligo Name', 'Match Rate (%)', 'Sense Matches', 'Antisense Matches', 'Total Matches'])
      // Data rows
      Object.entries(result.per_oligo_stats).forEach(([oligoName, stats]) => {
        addRow([
          oligoName,
          stats.match_rate.toString(),
          stats.sense_matches.toString(),
          stats.antisense_matches.toString(),
          stats.total_matches.toString(),
        ])
      })
    }

    // Input Parameters
    addSectionHeader('Input Parameters')
    addRow(['Date From', job.alignjob_date_from])
    addRow(['Date To', job.alignjob_date_to])
    addRow(['TaxID', job.alignjob_taxid.toString()])
    addRow([''])
    addRow(['BLAST Parameters'])
    addRow(['Identity (%)', job.alignjob_identity?.toString() || 'N/A'])
    addRow(['Coverage (%)', job.alignjob_coverage?.toString() || 'N/A'])
    addRow([''])
    addRow(['Pairwise Aligner Parameters'])
    addRow(['Match Score', job.alignjob_match_score?.toString() || 'N/A'])
    addRow(['Mismatch Score', job.alignjob_mismatch_score?.toString() || 'N/A'])
    addRow(['Open Gap Penalty', job.alignjob_opengap?.toString() || 'N/A'])
    addRow(['Extend Gap Penalty', job.alignjob_extendgap?.toString() || 'N/A'])
    addRow([''])
    addRow(['Other Parameters'])
    addRow(['Oligo Min Cover', job.alignjob_oligo_min_cover?.toString() || 'N/A'])

    // ============================================
    // ALIGNMENT PATTERNS TABLE
    // ============================================

    addSectionHeader('Alignment Patterns')

    // Header row: oligo names
    addRow([...oligoNames, 'Count', 'Total Mismatches', 'Examples'])

    // Second row: oligo sequences
    addRow([...oligoSequences, '', '', ''])

    // Pattern rows
    result.patterns.forEach((pattern) => {
      // Parse pattern to extract alignment strings for each oligo
      // Pattern format: "........................(fwd) | ..........................(rev) | ..."
      const patternParts = pattern.pattern.split('|').map((p) => p.trim())
      const alignmentStrings = patternParts.map((part) => {
        // Extract the dots/alignment part before the direction indicator
        const match = part.match(/^([^()]+)/)
        if (match) {
          return match[1].trim()
        }
        // If no match, try to extract just the dots
        const dotMatch = part.match(/^([.]+)/)
        return dotMatch ? dotMatch[1] : part
      })

      // Pad to match number of oligos
      while (alignmentStrings.length < oligoNames.length) {
        alignmentStrings.push('')
      }

      addRow([
        ...alignmentStrings.slice(0, oligoNames.length),
        pattern.count.toString(),
        pattern.total_mismatches.toString(),
        pattern.examples.join('; '),
      ])
    })

    // Convert to CSV
    const csvContent = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `blast_result_${job.align_id}_${assayName.replace(/\s+/g, '_')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              BLAST Result: {assayName}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Job ID: {job.align_id} | Date Range: {job.alignjob_date_from} - {job.alignjob_date_to}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition-colors text-sm"
            >
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg shadow-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Alignment Patterns Table */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Alignment Patterns
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    {oligoNames.map((name, idx) => (
                      <th
                        key={idx}
                        className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white"
                      >
                        {name}
                      </th>
                    ))}
                    <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                      Count
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                      Total Mismatches
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                      Example Accessions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Second row: oligo sequences */}
                  <tr className="bg-gray-100 dark:bg-gray-700/50">
                    {oligoSequences.map((seq, idx) => (
                      <td
                        key={idx}
                        className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-xs font-mono text-gray-700 dark:text-gray-300"
                      >
                        {seq}
                      </td>
                    ))}
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2"></td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2"></td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2"></td>
                  </tr>
                  {/* Pattern rows */}
                  {result.patterns.map((pattern, patternIdx) => {
                    // Parse pattern to extract alignment strings for each oligo
                    // Pattern format: "........................(fwd) | ..........................(rev) | ..."
                    const patternParts = pattern.pattern.split('|').map((p) => p.trim())
                    const alignmentStrings = patternParts.map((part) => {
                      // Extract the dots/alignment part before the direction indicator
                      // Match everything up to (fwd) or (rev) or similar
                      const match = part.match(/^([^()]+)/)
                      if (match) {
                        return match[1].trim()
                      }
                      // If no match, try to extract just the dots
                      const dotMatch = part.match(/^([.]+)/)
                      return dotMatch ? dotMatch[1] : part
                    })

                    // Pad to match number of oligos
                    while (alignmentStrings.length < oligoNames.length) {
                      alignmentStrings.push('')
                    }

                    return (
                      <tr key={patternIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        {alignmentStrings.slice(0, oligoNames.length).map((alignStr, idx) => (
                          <td
                            key={idx}
                            className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-xs font-mono text-gray-700 dark:text-gray-300"
                          >
                            {alignStr}
                          </td>
                        ))}
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {pattern.count}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {pattern.total_mismatches}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">
                          <div className="flex flex-col gap-1">
                            {pattern.examples.map((example, exIdx) => (
                              <span key={exIdx} className="text-xs font-mono">
                                {example}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statistics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Alignment Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.statistics.alignment_rate}%
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total BLAST Hits</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.statistics.total_blast_hits}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Sequences Aligned</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.statistics.sequences_aligned}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Filtered BLAST Hits</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.statistics.filtered_blast_hits}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Sequences with Min Matches</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.statistics.sequences_with_min_matches}
                </p>
              </div>
            </div>
          </div>

          {/* Per-Oligo Statistics */}
          {result.per_oligo_stats && Object.keys(result.per_oligo_stats).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Per-Oligo Statistics
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                        Oligo Name
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                        Match Rate (%)
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                        Sense Matches
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                        Antisense Matches
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                        Total Matches
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.per_oligo_stats).map(([oligoName, stats]) => (
                      <tr key={oligoName} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                          {oligoName}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {stats.match_rate}%
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {stats.sense_matches}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {stats.antisense_matches}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {stats.total_matches}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Input Parameters */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Input Parameters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Date Range
                </h4>
                <p className="text-sm text-gray-900 dark:text-white">
                  {job.alignjob_date_from} to {job.alignjob_date_to}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  BLAST Parameters
                </h4>
                <div className="space-y-1 text-sm text-gray-900 dark:text-white">
                  <p>Identity: {job.alignjob_identity ?? 'N/A'}%</p>
                  <p>Coverage: {job.alignjob_coverage ?? 'N/A'}%</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Pairwise Aligner Parameters
                </h4>
                <div className="space-y-1 text-sm text-gray-900 dark:text-white">
                  <p>Match Score: {job.alignjob_match_score ?? 'N/A'}</p>
                  <p>Mismatch Score: {job.alignjob_mismatch_score ?? 'N/A'}</p>
                  <p>Open Gap Penalty: {job.alignjob_opengap ?? 'N/A'}</p>
                  <p>Extend Gap Penalty: {job.alignjob_extendgap ?? 'N/A'}</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Other Parameters
                </h4>
                <div className="space-y-1 text-sm text-gray-900 dark:text-white">
                  <p>Oligo Min Cover: {job.alignjob_oligo_min_cover ?? 'N/A'}</p>
                  <p>TaxID: {job.alignjob_taxid}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

