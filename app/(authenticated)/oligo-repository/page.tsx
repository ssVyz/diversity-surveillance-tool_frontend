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
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null)

  // Form state
  const [sequenceName, setSequenceName] = useState('')
  const [dnaSequence, setDnaSequence] = useState('')
  const [assayId, setAssayId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

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

  // Fetch assays
  const fetchAssays = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('user_assays')
        .select('assay_id, assay_name')
        .order('assay_name', { ascending: true })

      if (fetchError) {
        console.error('Error fetching assays:', fetchError)
        // Don't throw - assays are optional
        return
      }

      setAssays(data || [])
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
        p_assay_id: assayId || null,
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

  // Handle delete
  const handleDelete = async (oligoId: number) => {
    if (!confirm('Are you sure you want to delete this oligo? This action cannot be undone.')) {
      return
    }

    setDeleteLoading(oligoId)

    try {
      const { error: deleteError } = await supabase.rpc('delete_user_oligo', {
        p_oligo_id: oligoId,
      })

      if (deleteError) {
        throw deleteError
      }

      // Refresh oligos list
      await fetchOligos()
    } catch (err: any) {
      setError(err.message || 'Failed to delete oligo')
      console.error('Error deleting oligo:', err)
    } finally {
      setDeleteLoading(null)
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
    if (!assayId) return 'None'
    const assay = assays.find((a) => a.assay_id === assayId)
    return assay ? assay.assay_name : 'Unknown'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Oligo Repository
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
        >
          {showForm ? 'Cancel' : 'Add New Oligo'}
        </button>
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
                <option value="">None</option>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {oligos.map((oligo) => (
                  <tr key={oligo.oligo_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(oligo.oligo_id)}
                        disabled={deleteLoading === oligo.oligo_id}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleteLoading === oligo.oligo_id ? 'Deleting...' : 'Delete'}
                      </button>
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

