'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Type definitions
interface Oligo {
  oligo_id: number
  sequence_name: string
  dna_sequence: string
  created_at: string
  assay_id: number | null
}

interface Assay {
  assay_id: number
  assay_name: string
}

export default function OligoRepositoryPage() {
  const [oligos, setOligos] = useState<Oligo[]>([])
  const [assays, setAssays] = useState<Assay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  
  // Checkbox state for bulk operations
  const [selectedOligos, setSelectedOligos] = useState<Set<number>>(new Set())
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [bulkChangeAssayLoading, setBulkChangeAssayLoading] = useState(false)
  const [bulkAssayId, setBulkAssayId] = useState<number | null>(null)

  // Form state
  const [sequenceName, setSequenceName] = useState('')
  const [dnaSequence, setDnaSequence] = useState('')
  const [assayId, setAssayId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Import state
  const [showImportForm, setShowImportForm] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importAssayId, setImportAssayId] = useState<number | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importProgress, setImportProgress] = useState<{
    total: number
    success: number
    failed: number
    errors: Array<{ name: string; error: string }>
  } | null>(null)

  // Fetch oligos
  const fetchOligos = async () => {
    try {
      setError(null)
      const { data, error: fetchError } = await supabase.rpc('fetch_user_oligos')

      if (fetchError) {
        throw fetchError
      }

      setOligos(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch oligos')
      console.error('Error fetching oligos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch assays using the same RPC function as assay repository
  const fetchAssays = async () => {
    try {
      const { data, error: fetchError } = await supabase.rpc('fetch_user_assays')

      if (fetchError) {
        console.error('Error fetching assays:', fetchError)
        // Don't throw - assays are optional
        return
      }

      // Map the response to our Assay interface
      if (data && Array.isArray(data)) {
        const mappedData = data.map((item: any) => ({
          assay_id: Number(item.assay_id),
          assay_name: item.assay_name,
        }))
        setAssays(mappedData)
      } else {
        setAssays([])
      }
    } catch (err) {
      console.error('Error fetching assays:', err)
      // Assays are optional, so we continue even if this fails
    }
  }

  useEffect(() => {
    fetchOligos()
    fetchAssays()
  }, [])

  // Validate DNA sequence
  const validateDnaSequence = (sequence: string): string | null => {
    // Remove spaces and convert to uppercase
    const cleaned = sequence.replace(/\s/g, '').toUpperCase()

    // Check for valid DNA characters (A, C, G, T and IUPAC codes: R, Y, S, W, K, M, B, D, H, V, N)
    const validChars = /^[ACGTIRYSWKMBDHVN]+$/
    if (!validChars.test(cleaned)) {
      return 'Sequence contains invalid characters. Only A, C, G, T and IUPAC ambiguous codes (R, Y, S, W, K, M, B, D, H, V, N) are allowed.'
    }

    return null
  }

  // Parse FASTA file
  const parseFastaFile = (content: string): Array<{ name: string; sequence: string }> => {
    const sequences: Array<{ name: string; sequence: string }> = []
    const lines = content.split('\n')
    let currentName = ''
    let currentSequence = ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('>')) {
        // Save previous sequence if exists
        if (currentName && currentSequence) {
          sequences.push({
            name: currentName,
            sequence: currentSequence,
          })
        }
        // Start new sequence - remove '>' and take everything up to first space or newline
        currentName = trimmed.substring(1).split(/\s+/)[0] || `Sequence_${sequences.length + 1}`
        currentSequence = ''
      } else {
        // Append to current sequence
        currentSequence += trimmed
      }
    }

    // Don't forget the last sequence
    if (currentName && currentSequence) {
      sequences.push({
        name: currentName,
        sequence: currentSequence,
      })
    }

    return sequences
  }

  // Handle file import
  const handleFileImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importFile) {
      setFormError('Please select a FASTA file')
      return
    }

    setImportLoading(true)
    setFormError(null)
    setImportProgress({ total: 0, success: 0, failed: 0, errors: [] })

    try {
      // Read file content
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsText(importFile)
      })

      // Parse FASTA file
      const sequences = parseFastaFile(fileContent)

      if (sequences.length === 0) {
        setFormError('No sequences found in FASTA file')
        setImportLoading(false)
        return
      }

      setImportProgress({ total: sequences.length, success: 0, failed: 0, errors: [] })

      // Import each sequence
      let successCount = 0
      let failedCount = 0
      const errors: Array<{ name: string; error: string }> = []

      for (const seq of sequences) {
        try {
          // Clean and validate sequence
          const cleanedSequence = seq.sequence.replace(/\s/g, '').toUpperCase()
          const validationError = validateDnaSequence(cleanedSequence)

          if (validationError) {
            throw new Error(validationError)
          }

          // Create oligo
          const { error: createError } = await supabase.rpc('create_user_oligo', {
            p_sequence_name: seq.name.trim() || `Sequence_${successCount + failedCount + 1}`,
            p_dna_sequence: cleanedSequence,
            p_assay_id: importAssayId !== null && importAssayId !== undefined ? importAssayId : null,
            p_panel_id: null,
          })

          if (createError) {
            throw createError
          }

          successCount++
        } catch (err: any) {
          failedCount++
          errors.push({
            name: seq.name,
            error: err.message || 'Unknown error',
          })
        }

        // Update progress
        setImportProgress({
          total: sequences.length,
          success: successCount,
          failed: failedCount,
          errors,
        })
      }

      // Refresh oligos list
      await fetchOligos()

      // Reset form after a short delay to show final results
      setTimeout(() => {
        setImportFile(null)
        setImportAssayId(null)
        setShowImportForm(false)
        setImportProgress(null)
      }, 3000)
    } catch (err: any) {
      setFormError(err.message || 'Failed to import FASTA file')
      console.error('Error importing FASTA file:', err)
    } finally {
      setImportLoading(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Validate sequence name
    if (!sequenceName.trim()) {
      setFormError('Sequence name is required')
      return
    }

    // Clean and validate DNA sequence
    const cleanedSequence = dnaSequence.replace(/\s/g, '').toUpperCase()
    const validationError = validateDnaSequence(cleanedSequence)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setFormLoading(true)

    try {
      const { data, error: createError } = await supabase.rpc('create_user_oligo', {
        p_sequence_name: sequenceName.trim(),
        p_dna_sequence: cleanedSequence,
        p_assay_id: assayId !== null && assayId !== undefined ? assayId : null,
        p_panel_id: null,
      })

      if (createError) {
        throw createError
      }

      // Reset form
      setSequenceName('')
      setDnaSequence('')
      setAssayId(null)
      setShowForm(false)
      setFormError(null)

      // Refresh oligos list
      await fetchOligos()
    } catch (err: any) {
      setFormError(err.message || 'Failed to create oligo')
      console.error('Error creating oligo:', err)
    } finally {
      setFormLoading(false)
    }
  }

  // Handle checkbox toggle
  const handleToggleSelect = (oligoId: number) => {
    setSelectedOligos((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(oligoId)) {
        newSet.delete(oligoId)
      } else {
        newSet.add(oligoId)
      }
      return newSet
    })
  }

  // Handle select all
  const handleSelectAll = () => {
    if (selectedOligos.size === oligos.length) {
      setSelectedOligos(new Set())
    } else {
      setSelectedOligos(new Set(oligos.map((o) => o.oligo_id)))
    }
  }

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedOligos.size === 0) {
      setError('Please select at least one oligo to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedOligos.size} oligo(s)? This action cannot be undone.`)) {
      return
    }

    setBulkDeleteLoading(true)
    setError(null)

    try {
      const oligoIds = Array.from(selectedOligos)
      const errors: string[] = []

      // Delete each oligo
      for (const oligoId of oligoIds) {
        try {
          const { error: deleteError } = await supabase.rpc('delete_user_oligo', {
            p_oligo_id: oligoId,
          })

          if (deleteError) {
            errors.push(`Oligo ${oligoId}: ${deleteError.message}`)
          }
        } catch (err: any) {
          errors.push(`Oligo ${oligoId}: ${err.message || 'Unknown error'}`)
        }
      }

      if (errors.length > 0) {
        setError(`Some deletions failed:\n${errors.join('\n')}`)
      }

      // Clear selection and refresh
      setSelectedOligos(new Set())
      await fetchOligos()
    } catch (err: any) {
      setError(err.message || 'Failed to delete oligos')
      console.error('Error deleting oligos:', err)
    } finally {
      setBulkDeleteLoading(false)
    }
  }

  // Handle bulk change assay
  const handleBulkChangeAssay = async () => {
    if (selectedOligos.size === 0) {
      setError('Please select at least one oligo to modify')
      return
    }

    setBulkChangeAssayLoading(true)
    setError(null)

    try {
      const oligoIds = Array.from(selectedOligos)
      const errors: string[] = []

      // Change assay for each oligo
      for (const oligoId of oligoIds) {
        try {
          const { error: changeError } = await supabase.rpc('oligo_change_assay', {
            p_oligo_id: oligoId,
            p_assay_id: bulkAssayId,
          })

          if (changeError) {
            errors.push(`Oligo ${oligoId}: ${changeError.message}`)
          }
        } catch (err: any) {
          errors.push(`Oligo ${oligoId}: ${err.message || 'Unknown error'}`)
        }
      }

      if (errors.length > 0) {
        setError(`Some changes failed:\n${errors.join('\n')}`)
      } else {
        // Clear selection and reset dropdown
        setSelectedOligos(new Set())
        setBulkAssayId(null)
      }

      // Refresh oligos list
      await fetchOligos()
    } catch (err: any) {
      setError(err.message || 'Failed to change assays')
      console.error('Error changing assays:', err)
    } finally {
      setBulkChangeAssayLoading(false)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Truncate sequence for display
  const truncateSequence = (sequence: string, maxLength: number = 50) => {
    if (sequence.length <= maxLength) {
      return sequence
    }
    return `${sequence.substring(0, maxLength)}...`
  }

  // Get assay name by ID
  const getAssayName = (assayId: number | null) => {
    if (assayId === null || assayId === undefined) return 'Not assigned'
    const assay = assays.find((a) => a.assay_id === assayId)
    return assay ? assay.assay_name : 'Unknown'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Oligo Repository
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportForm(!showImportForm)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition-colors"
          >
            {showImportForm ? 'Cancel Import' : 'Import from FASTA'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
          >
            {showForm ? 'Cancel' : 'Add New Oligo'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Add New Oligo
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="sequenceName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Sequence Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="sequenceName"
                value={sequenceName}
                onChange={(e) => setSequenceName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter sequence name"
                required
              />
            </div>

            <div>
              <label
                htmlFor="dnaSequence"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                DNA Sequence <span className="text-red-500">*</span>
              </label>
              <textarea
                id="dnaSequence"
                value={dnaSequence}
                onChange={(e) => setDnaSequence(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="Enter DNA sequence (spaces and lowercase will be automatically converted)"
                rows={4}
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Valid characters: A, C, G, T and IUPAC codes (R, Y, S, W, K, M, B, D, H, V, N)
              </p>
            </div>

            <div>
              <label
                htmlFor="assayId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Assay (Optional)
              </label>
              <select
                id="assayId"
                value={assayId || ''}
                onChange={(e) => setAssayId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Not assigned</option>
                {assays.map((assay) => (
                  <option key={assay.assay_id} value={assay.assay_id}>
                    {assay.assay_name}
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{formError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg shadow-sm transition-colors"
              >
                {formLoading ? 'Creating...' : 'Create Oligo'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setSequenceName('')
                  setDnaSequence('')
                  setAssayId(null)
                  setFormError(null)
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showImportForm && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Import Oligos from FASTA File
          </h2>
          <form onSubmit={handleFileImport} className="space-y-4">
            <div>
              <label
                htmlFor="fastaFile"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                FASTA File <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                id="fastaFile"
                accept=".fasta,.fa,.fas,.fna"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Select a FASTA file (.fasta, .fa, .fas, or .fna). Each sequence will be imported with its header as the sequence name.
              </p>
            </div>

            <div>
              <label
                htmlFor="importAssayId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Assay (Optional - applies to all sequences)
              </label>
              <select
                id="importAssayId"
                value={importAssayId || ''}
                onChange={(e) => setImportAssayId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Not assigned</option>
                {assays.map((assay) => (
                  <option key={assay.assay_id} value={assay.assay_id}>
                    {assay.assay_name}
                  </option>
                ))}
              </select>
            </div>

            {importProgress && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  Progress: {importProgress.success + importProgress.failed} / {importProgress.total}
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${((importProgress.success + importProgress.failed) / importProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  ✓ Success: {importProgress.success} | ✗ Failed: {importProgress.failed}
                </p>
                {importProgress.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">
                      View errors ({importProgress.errors.length})
                    </summary>
                    <ul className="mt-2 text-xs text-red-700 dark:text-red-300 space-y-1">
                      {importProgress.errors.map((err, idx) => (
                        <li key={idx}>
                          <strong>{err.name}:</strong> {err.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{formError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={importLoading || !importFile}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg shadow-sm transition-colors"
              >
                {importLoading ? 'Importing...' : 'Import Oligos'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowImportForm(false)
                  setImportFile(null)
                  setImportAssayId(null)
                  setFormError(null)
                  setImportProgress(null)
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading oligos...</p>
          </div>
        ) : oligos.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No oligos found. Create your first oligo to get started.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
            >
              Add New Oligo
            </button>
          </div>
        ) : (
          <div>
            {/* Bulk Actions Bar */}
            {selectedOligos.size > 0 && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                      {selectedOligos.size} oligo(s) selected
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        Change Assay:
                      </label>
                      <select
                        value={bulkAssayId || ''}
                        onChange={(e) => setBulkAssayId(e.target.value ? parseInt(e.target.value) : null)}
                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={bulkChangeAssayLoading}
                      >
                        <option value="">Not assigned</option>
                        {assays.map((assay) => (
                          <option key={assay.assay_id} value={assay.assay_id}>
                            {assay.assay_name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleBulkChangeAssay}
                        disabled={bulkChangeAssayLoading}
                        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg shadow-sm transition-colors"
                      >
                        {bulkChangeAssayLoading ? 'Changing...' : 'Apply'}
                      </button>
                    </div>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleteLoading}
                      className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg shadow-sm transition-colors"
                    >
                      {bulkDeleteLoading ? 'Deleting...' : 'Delete Selected'}
                    </button>
                    <button
                      onClick={() => setSelectedOligos(new Set())}
                      className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedOligos.size === oligos.length && oligos.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Sequence Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      DNA Sequence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Assay
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {oligos.map((oligo) => (
                    <tr 
                      key={oligo.oligo_id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedOligos.has(oligo.oligo_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedOligos.has(oligo.oligo_id)}
                          onChange={() => handleToggleSelect(oligo.oligo_id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {oligo.sequence_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">
                        <span title={oligo.dna_sequence}>
                          {truncateSequence(oligo.dna_sequence)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {getAssayName(oligo.assay_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(oligo.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

