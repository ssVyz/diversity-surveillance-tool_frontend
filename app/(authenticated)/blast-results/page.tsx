'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ============================================
// TYPE DEFINITIONS
// ============================================

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
  alignjob_oligos: any
  alignjob_identity: number | null
  alignjob_coverage: number | null
  alignjob_match_score: number | null
  alignjob_mismatch_score: number | null
  alignjob_opengap: number | null
  alignjob_extendgap: number | null
  alignjob_oligo_min_cover: number | null
  alignjob_result: any | null
}

interface UserAssay {
  assay_id: number
  assay_name: string
}

// New JSONB result format types
interface SettingsUsed {
  mode?: string
  match_score?: number
  mismatch_score?: number
  gap_open_score?: number
  gap_extend_score?: number
  min_coverage?: number
  max_mismatches_per_oligo?: number
  min_fwd_matched?: number
  min_rev_matched?: number
  min_probe_matched?: number
  ambiguity_display?: string
  min_amplicon_size?: number | null
  max_amplicon_size?: number | null
}

interface OligoOrder {
  forward_primers: string[]
  probes: string[]
  reverse_primers: string[]
}

interface OligoSignature {
  category: string
  oligo_id: string
  signature: string
}

interface PatternEntry {
  pattern_number: number
  combined_signature: string
  per_oligo_signatures: OligoSignature[]
  count: number
  percentage: number
  total_mismatches: number
  fwd_matched: number
  rev_matched: number
  probe_matched: number
  amplicon_length: number | null
  example_sequences: string[]
}

interface PerOligoStat {
  id: string
  category: string
  total_matches: number
  total_sequences: number
  percentage: number
  sense_matches: number
  antisense_matches: number
}

interface MismatchDist {
  zero_mm: number
  zero_mm_pct: number
  one_mm: number
  one_mm_pct: number
  more_mm: number
  more_mm_pct: number
  no_match: number
  no_match_pct: number
}

interface OverallPattern {
  all_perfect: number
  all_perfect_pct: number
  max_one_mm: number
  max_one_mm_pct: number
  two_plus_mm: number
  two_plus_mm_pct: number
  no_match: number
  no_match_pct: number
}

interface ResultSummary {
  total_sequences: number
  sequences_meeting_thresholds: number
  threshold_percentage: number
  sequences_with_valid_amplicon: number
  valid_amplicon_percentage: number
  sequences_without_valid_amplicon: number
}

interface ResultData {
  success: boolean
  error: string | null
  blast_statistics?: {
    total_blast_hits: number
    filtered_blast_hits: number
  }
  settings_used?: SettingsUsed
  oligo_order?: OligoOrder
  oligo_sequences?: Record<string, string>
  patterns?: PatternEntry[]
  per_oligo_stats?: PerOligoStat[]
  summary?: ResultSummary
  mismatch_distribution?: {
    forward_primers?: MismatchDist
    probes?: MismatchDist
    reverse_primers?: MismatchDist
  }
  overall_pattern?: OverallPattern
  output_text?: string
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

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

  const handleSelectAll = () => {
    if (selectedJobs.size === jobs.length && jobs.length > 0) {
      setSelectedJobs(new Set())
    } else {
      setSelectedJobs(new Set(jobs.map((job) => job.align_id)))
    }
  }

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

  const getAssayName = (assayId: number): string => {
    return assays.get(assayId) || `Assay ${assayId}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

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

// ============================================
// RESULT VIEWER COMPONENT
// ============================================

interface ResultViewerProps {
  job: BlastAlignerJob
  result: ResultData
  assayName: string
  onClose: () => void
}

function ResultViewer({ job, result, assayName, onClose }: ResultViewerProps) {
  // Build ordered oligo list from oligo_order
  const oligoOrder = result.oligo_order || { forward_primers: [], probes: [], reverse_primers: [] }
  const allOligoIds = [
    ...oligoOrder.forward_primers,
    ...oligoOrder.probes,
    ...oligoOrder.reverse_primers,
  ]
  const oligoSequences = result.oligo_sequences || {}
  const settings = result.settings_used || {}
  const patterns = result.patterns || []
  const perOligoStats = result.per_oligo_stats || []
  const summary = result.summary
  const blastStats = result.blast_statistics
  const mmDist = result.mismatch_distribution || {}
  const overall = result.overall_pattern

  // Category boundary indices for column grouping
  const nFwd = oligoOrder.forward_primers.length
  const nProbe = oligoOrder.probes.length
  const nRev = oligoOrder.reverse_primers.length

  // Group per-oligo stats by category
  const fwdStats = perOligoStats.filter((s) => s.category === 'forward_primer')
  const probeStats = perOligoStats.filter((s) => s.category === 'probe')
  const revStats = perOligoStats.filter((s) => s.category === 'reverse_primer')

  // Excel export using ExcelJS
  const handleExportExcel = async () => {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('Results')

    const boldFont = { bold: true }
    const titleFont = { bold: true, size: 14 }
    const categoryFont = { bold: true, size: 11 }
    const monoFont = { name: 'Courier New', size: 10 }

    let row = 1

    // Title
    ws.getCell(row, 1).value = 'qPCR Oligo Inclusivity Analysis Results'
    ws.getCell(row, 1).font = titleFont
    row += 2

    // Settings
    const settingsParts = [
      `min_fwd=${settings.min_fwd_matched ?? 'N/A'}`,
      `min_rev=${settings.min_rev_matched ?? 'N/A'}`,
      `min_probes=${settings.min_probe_matched ?? 'N/A'}`,
      `min_coverage=${settings.min_coverage ?? 'N/A'}`,
      `max_mm/oligo=${settings.max_mismatches_per_oligo ?? 'N/A'}`,
    ]
    ws.getCell(row, 1).value = `Settings: ${settingsParts.join(', ')}`
    ws.getCell(row, 1).font = boldFont
    row++

    // Amplicon size constraints
    if (settings.min_amplicon_size != null || settings.max_amplicon_size != null) {
      const parts = []
      if (settings.min_amplicon_size != null) parts.push(`min=${settings.min_amplicon_size}`)
      if (settings.max_amplicon_size != null) parts.push(`max=${settings.max_amplicon_size}`)
      ws.getCell(row, 1).value = `Amplicon size constraints: ${parts.join(', ')}`
      ws.getCell(row, 1).font = boldFont
      row++
    }
    row++

    // Category labels row
    let col = 2 // col 1 is Pattern #
    if (nFwd > 0) {
      ws.getCell(row, col).value = '--- Forward Primers ---'
      ws.getCell(row, col).font = categoryFont
      col += nFwd
    }
    if (nProbe > 0) {
      ws.getCell(row, col).value = '--- Probes ---'
      ws.getCell(row, col).font = categoryFont
      col += nProbe
    }
    if (nRev > 0) {
      ws.getCell(row, col).value = '--- Reverse Primers ---'
      ws.getCell(row, col).font = categoryFont
    }
    row++

    // Column headers
    const totalOligos = allOligoIds.length
    const headers = ['Pattern #', ...allOligoIds, 'Count', 'Percentage', 'Total Mismatches', 'Fwd Matched', 'Rev Matched', 'Probes Matched', 'Amplicon Length', 'Example Sequences']
    headers.forEach((h, i) => {
      ws.getCell(row, i + 1).value = h
      ws.getCell(row, i + 1).font = boldFont
    })
    row++

    // Oligo sequences row
    ws.getCell(row, 1).value = ''
    allOligoIds.forEach((id, i) => {
      ws.getCell(row, i + 2).value = oligoSequences[id] || ''
      ws.getCell(row, i + 2).font = monoFont
    })
    row++

    // Pattern data rows
    for (const pat of patterns) {
      ws.getCell(row, 1).value = pat.pattern_number
      // Per-oligo signatures
      pat.per_oligo_signatures.forEach((sigObj, i) => {
        if (i < totalOligos) {
          ws.getCell(row, i + 2).value = sigObj.signature
          ws.getCell(row, i + 2).font = monoFont
        }
      })
      const dataCol = totalOligos + 2
      ws.getCell(row, dataCol).value = pat.count
      ws.getCell(row, dataCol + 1).value = `${pat.percentage.toFixed(1)}%`
      ws.getCell(row, dataCol + 2).value = pat.total_mismatches
      ws.getCell(row, dataCol + 3).value = pat.fwd_matched
      ws.getCell(row, dataCol + 4).value = pat.rev_matched
      ws.getCell(row, dataCol + 5).value = pat.probe_matched
      ws.getCell(row, dataCol + 6).value = pat.amplicon_length ?? ''
      // Examples: first 3 + "+N more"
      const exArr = pat.example_sequences || []
      let exStr = exArr.slice(0, 3).join(', ')
      if (exArr.length > 3) exStr += `, +${exArr.length - 3} more`
      ws.getCell(row, dataCol + 7).value = exStr
      row++
    }
    row++

    // Per-Oligo Statistics
    ws.getCell(row, 1).value = 'PER-OLIGO STATISTICS:'
    ws.getCell(row, 1).font = boldFont
    row++

    const writeOligoStatCategory = (label: string, stats: PerOligoStat[]) => {
      if (stats.length === 0) return
      ws.getCell(row, 1).value = label
      ws.getCell(row, 1).font = categoryFont
      row++
      for (const s of stats) {
        ws.getCell(row, 1).value = `  ${s.id}: ${s.total_matches}/${s.total_sequences} matches (${s.percentage.toFixed(1)}%) - Sense: ${s.sense_matches}, Antisense: ${s.antisense_matches}`
        row++
      }
    }

    writeOligoStatCategory('Forward Primers:', fwdStats)
    writeOligoStatCategory('Probes:', probeStats)
    writeOligoStatCategory('Reverse Primers:', revStats)
    row++

    // Summary
    if (summary) {
      ws.getCell(row, 1).value = 'SUMMARY:'
      ws.getCell(row, 1).font = boldFont
      row++
      ws.getCell(row, 1).value = `Total sequences analyzed: ${summary.total_sequences}`
      row++
      const meetPct = summary.total_sequences > 0 ? ((summary.sequences_meeting_thresholds / summary.total_sequences) * 100).toFixed(1) : '0.0'
      ws.getCell(row, 1).value = `Sequences meeting all thresholds: ${summary.sequences_meeting_thresholds} (${meetPct}%)`
      row += 2

      // Amplicon Statistics
      ws.getCell(row, 1).value = 'AMPLICON STATISTICS:'
      ws.getCell(row, 1).font = boldFont
      row++
      const ampPct = summary.total_sequences > 0 ? ((summary.sequences_with_valid_amplicon / summary.total_sequences) * 100).toFixed(1) : '0.0'
      ws.getCell(row, 1).value = `Sequences with valid amplicon: ${summary.sequences_with_valid_amplicon} (${ampPct}%)`
      row++
      ws.getCell(row, 1).value = `Sequences without valid amplicon: ${summary.sequences_without_valid_amplicon}`
      row += 2
    }

    // Mismatch Distribution
    ws.getCell(row, 1).value = 'MISMATCH DISTRIBUTION (best oligo per category per sequence):'
    ws.getCell(row, 1).font = boldFont
    row++

    const writeMmDist = (label: string, dist: MismatchDist | undefined) => {
      if (!dist) return
      ws.getCell(row, 1).value = label
      ws.getCell(row, 1).font = categoryFont
      row++
      ws.getCell(row, 1).value = `  0 mismatches: ${dist.zero_mm} (${dist.zero_mm_pct.toFixed(1)}%)`
      row++
      ws.getCell(row, 1).value = `  1 mismatch: ${dist.one_mm} (${dist.one_mm_pct.toFixed(1)}%)`
      row++
      ws.getCell(row, 1).value = `  >1 mismatches: ${dist.more_mm} (${dist.more_mm_pct.toFixed(1)}%)`
      row++
      ws.getCell(row, 1).value = `  No match: ${dist.no_match} (${dist.no_match_pct.toFixed(1)}%)`
      row++
    }

    writeMmDist('Forward Primers:', mmDist.forward_primers)
    writeMmDist('Probes:', mmDist.probes)
    writeMmDist('Reverse Primers:', mmDist.reverse_primers)
    row++

    // Overall Pattern
    if (overall) {
      ws.getCell(row, 1).value = 'Overall Pattern (worst best-match across all categories):'
      ws.getCell(row, 1).font = boldFont
      row++
      ws.getCell(row, 1).value = `  All categories 0 mismatches: ${overall.all_perfect} (${overall.all_perfect_pct.toFixed(1)}%)`
      row++
      ws.getCell(row, 1).value = `  All categories \u22641 mismatch: ${overall.max_one_mm} (${overall.max_one_mm_pct.toFixed(1)}%)`
      row++
      ws.getCell(row, 1).value = `  \u22652 mismatches in any category: ${overall.two_plus_mm} (${overall.two_plus_mm_pct.toFixed(1)}%)`
      row++
      ws.getCell(row, 1).value = `  No match in any category: ${overall.no_match} (${overall.no_match_pct.toFixed(1)}%)`
      row++
    }

    // Auto-width columns
    ws.columns.forEach((column) => {
      let maxLen = 10
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = cell.value ? cell.value.toString().length : 0
        if (len > maxLen) maxLen = len
      })
      column.width = Math.min(maxLen + 2, 60)
    })

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `blast_result_${job.align_id}_${assayName.replace(/\s+/g, '_')}.xlsx`
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Error result
  if (!result.success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            BLAST Result: {assayName}
          </h2>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <p className="text-red-800 dark:text-red-200">{result.error || 'Job failed with unknown error'}</p>
          </div>
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg">
            Close
          </button>
        </div>
      </div>
    )
  }

  // No data result
  if (patterns.length === 0 && perOligoStats.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            BLAST Result: {assayName}
          </h2>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              {result.output_text || 'No sequences passed BLAST filtering. No patterns to display.'}
            </p>
          </div>
          {blastStats && (
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              <p>Total BLAST hits: {blastStats.total_blast_hits}</p>
              <p>Filtered BLAST hits: {blastStats.filtered_blast_hits}</p>
            </div>
          )}
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
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
              onClick={handleExportExcel}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition-colors text-sm"
            >
              Export Excel
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
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Settings Used */}
          {settings && Object.keys(settings).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Settings Used</h3>
              <div className="flex flex-wrap gap-3 text-sm">
                {settings.min_fwd_matched != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Min Fwd: {settings.min_fwd_matched}</span>
                )}
                {settings.min_rev_matched != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Min Rev: {settings.min_rev_matched}</span>
                )}
                {settings.min_probe_matched != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Min Probes: {settings.min_probe_matched}</span>
                )}
                {settings.min_coverage != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Min Coverage: {settings.min_coverage}</span>
                )}
                {settings.max_mismatches_per_oligo != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Max MM/Oligo: {settings.max_mismatches_per_oligo}</span>
                )}
                {settings.match_score != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Match: {settings.match_score}</span>
                )}
                {settings.mismatch_score != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Mismatch: {settings.mismatch_score}</span>
                )}
                {settings.gap_open_score != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Gap Open: {settings.gap_open_score}</span>
                )}
                {settings.gap_extend_score != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Gap Extend: {settings.gap_extend_score}</span>
                )}
                {settings.min_amplicon_size != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Min Amplicon: {settings.min_amplicon_size}</span>
                )}
                {settings.max_amplicon_size != null && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">Max Amplicon: {settings.max_amplicon_size}</span>
                )}
              </div>
            </div>
          )}

          {/* Summary & BLAST Statistics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {blastStats && (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total BLAST Hits</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{blastStats.total_blast_hits}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Filtered BLAST Hits</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{blastStats.filtered_blast_hits}</p>
                  </div>
                </>
              )}
              {summary && (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Sequences</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_sequences}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Meeting Thresholds</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {summary.sequences_meeting_thresholds}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                        ({summary.total_sequences > 0 ? ((summary.sequences_meeting_thresholds / summary.total_sequences) * 100).toFixed(1) : '0.0'}%)
                      </span>
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Valid Amplicon</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {summary.sequences_with_valid_amplicon}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                        ({summary.total_sequences > 0 ? ((summary.sequences_with_valid_amplicon / summary.total_sequences) * 100).toFixed(1) : '0.0'}%)
                      </span>
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">No Valid Amplicon</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.sequences_without_valid_amplicon}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Alignment Patterns Table */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Alignment Patterns ({patterns.length})
            </h3>
            <div className="overflow-x-auto border border-gray-300 dark:border-gray-600 rounded-lg">
              <table className="border-collapse text-sm" style={{ minWidth: 'max-content' }}>
                {/* Category group headers */}
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700/50">
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-500 dark:text-gray-400"></th>
                    {nFwd > 0 && (
                      <th
                        colSpan={nFwd}
                        className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-bold text-center text-blue-700 dark:text-blue-300"
                      >
                        Forward Primers
                      </th>
                    )}
                    {nProbe > 0 && (
                      <th
                        colSpan={nProbe}
                        className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-bold text-center text-purple-700 dark:text-purple-300"
                      >
                        Probes
                      </th>
                    )}
                    {nRev > 0 && (
                      <th
                        colSpan={nRev}
                        className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-bold text-center text-green-700 dark:text-green-300"
                      >
                        Reverse Primers
                      </th>
                    )}
                    <th colSpan={8} className="border border-gray-300 dark:border-gray-600 px-3 py-1"></th>
                  </tr>
                  {/* Oligo ID headers */}
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">#</th>
                    {allOligoIds.map((id, idx) => (
                      <th
                        key={idx}
                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap"
                      >
                        {id}
                      </th>
                    ))}
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">Count</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">%</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">Total MM</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">Fwd</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">Rev</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">Probes</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">Amp Len</th>
                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">Examples</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Oligo sequences row */}
                  <tr className="bg-gray-100 dark:bg-gray-700/50">
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-500 dark:text-gray-400 italic">seq</td>
                    {allOligoIds.map((id, idx) => (
                      <td
                        key={idx}
                        className="border border-gray-300 dark:border-gray-600 px-3 py-1 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap"
                      >
                        {oligoSequences[id] || ''}
                      </td>
                    ))}
                    <td colSpan={8} className="border border-gray-300 dark:border-gray-600"></td>
                  </tr>
                  {/* Pattern rows */}
                  {patterns.map((pat) => (
                    <tr key={pat.pattern_number} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-900 dark:text-white text-center font-medium">
                        {pat.pattern_number}
                      </td>
                      {allOligoIds.map((_, idx) => {
                        const sigObj = pat.per_oligo_signatures[idx]
                        const sig = sigObj ? sigObj.signature : ''
                        const isNoMatch = sig === 'NO_MATCH'
                        return (
                          <td
                            key={idx}
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-1 font-mono text-xs whitespace-nowrap ${
                              isNoMatch
                                ? 'text-red-600 dark:text-red-400 font-bold'
                                : 'text-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {sig}
                          </td>
                        )
                      })}
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-900 dark:text-white text-right">{pat.count}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-900 dark:text-white text-right">{pat.percentage.toFixed(1)}%</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-900 dark:text-white text-right">{pat.total_mismatches}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-900 dark:text-white text-right">{pat.fwd_matched}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-900 dark:text-white text-right">{pat.rev_matched}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-900 dark:text-white text-right">{pat.probe_matched}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-900 dark:text-white text-right">{pat.amplicon_length ?? ''}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(pat.example_sequences || []).slice(0, 3).map((ex, i) => (
                            <span key={i} className="font-mono">{ex}</span>
                          ))}
                          {(pat.example_sequences || []).length > 3 && (
                            <span className="text-gray-400">+{pat.example_sequences.length - 3} more</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-Oligo Statistics */}
          {perOligoStats.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Per-Oligo Statistics</h3>
              <div className="space-y-4">
                {[
                  { label: 'Forward Primers', stats: fwdStats, color: 'blue' },
                  { label: 'Probes', stats: probeStats, color: 'purple' },
                  { label: 'Reverse Primers', stats: revStats, color: 'green' },
                ].filter((g) => g.stats.length > 0).map((group) => (
                  <div key={group.label}>
                    <h4 className={`text-sm font-bold text-${group.color}-700 dark:text-${group.color}-300 mb-2`}>{group.label}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">Oligo</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">Matches</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">Match Rate</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">Sense</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-white">Antisense</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.stats.map((s) => (
                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">{s.id}</td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">{s.total_matches}/{s.total_sequences}</td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">{s.percentage.toFixed(1)}%</td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">{s.sense_matches}</td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-white">{s.antisense_matches}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mismatch Distribution */}
          {mmDist && Object.keys(mmDist).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Mismatch Distribution
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Best oligo per category per sequence</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Forward Primers', dist: mmDist.forward_primers, color: 'blue' },
                  { label: 'Probes', dist: mmDist.probes, color: 'purple' },
                  { label: 'Reverse Primers', dist: mmDist.reverse_primers, color: 'green' },
                ].filter((g) => g.dist).map((group) => (
                  <div key={group.label} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h4 className={`text-sm font-bold text-${group.color}-700 dark:text-${group.color}-300 mb-3`}>{group.label}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">0 mismatches:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{group.dist!.zero_mm} ({group.dist!.zero_mm_pct.toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">1 mismatch:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{group.dist!.one_mm} ({group.dist!.one_mm_pct.toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">&gt;1 mismatches:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{group.dist!.more_mm} ({group.dist!.more_mm_pct.toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">No match:</span>
                        <span className="font-medium text-red-600 dark:text-red-400">{group.dist!.no_match} ({group.dist!.no_match_pct.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall Pattern */}
          {overall && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Overall Pattern
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Worst best-match across all active categories per sequence</p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">All 0 mismatches</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-300">{overall.all_perfect} <span className="text-sm font-normal">({overall.all_perfect_pct.toFixed(1)}%)</span></p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">All &le;1 mismatch</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{overall.max_one_mm} <span className="text-sm font-normal">({overall.max_one_mm_pct.toFixed(1)}%)</span></p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">&ge;2 mismatches</p>
                    <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">{overall.two_plus_mm} <span className="text-sm font-normal">({overall.two_plus_mm_pct.toFixed(1)}%)</span></p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-1">No match</p>
                    <p className="text-xl font-bold text-red-700 dark:text-red-300">{overall.no_match} <span className="text-sm font-normal">({overall.no_match_pct.toFixed(1)}%)</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input Parameters */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Input Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Date Range & Target</h4>
                <div className="space-y-1 text-sm text-gray-900 dark:text-white">
                  <p>{job.alignjob_date_from} to {job.alignjob_date_to}</p>
                  <p>TaxID: {job.alignjob_taxid}</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">BLAST Parameters</h4>
                <div className="space-y-1 text-sm text-gray-900 dark:text-white">
                  <p>Identity: {job.alignjob_identity ?? 'N/A'}%</p>
                  <p>Coverage: {job.alignjob_coverage ?? 'N/A'}%</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Pairwise Aligner</h4>
                <div className="space-y-1 text-sm text-gray-900 dark:text-white">
                  <p>Match Score: {job.alignjob_match_score ?? 'N/A'}</p>
                  <p>Mismatch Score: {job.alignjob_mismatch_score ?? 'N/A'}</p>
                  <p>Open Gap: {job.alignjob_opengap ?? 'N/A'}</p>
                  <p>Extend Gap: {job.alignjob_extendgap ?? 'N/A'}</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Other</h4>
                <div className="space-y-1 text-sm text-gray-900 dark:text-white">
                  <p>Oligo Min Cover: {job.alignjob_oligo_min_cover ?? 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
