'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Type definitions
interface TaxID {
  entry_id: number
  taxid: number
  created_at: string
  taxid_spec: string | null
}

export default function TaxIDPage() {
  const [taxids, setTaxids] = useState<TaxID[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null)

  // Form state
  const [taxid, setTaxid] = useState('')
  const [taxidSpec, setTaxidSpec] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Fetch taxids
  const fetchTaxids = async () => {
    try {
      setError(null)
      const { data, error: fetchError } = await supabase.rpc('fetch_user_taxids')

      if (fetchError) {
        throw fetchError
      }

      // Handle the response - ensure data is an array and map to our type
      if (data && Array.isArray(data)) {
        const mappedData = data.map((item: any) => ({
          entry_id: Number(item.entry_id),
          taxid: Number(item.taxid),
          created_at: item.created_at,
          taxid_spec: item.taxid_spec || null,
        }))
        setTaxids(mappedData)
      } else {
        setTaxids([])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch taxids')
      console.error('Error fetching taxids:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTaxids()
  }, [])

  // Validate taxid
  const validateTaxid = (value: string): string | null => {
    const trimmed = value.trim()
    if (!trimmed) {
      return 'TaxID is required'
    }

    const taxidNum = parseInt(trimmed, 10)
    if (isNaN(taxidNum) || taxidNum <= 0) {
      return 'TaxID must be a positive integer'
    }

    return null
  }

  // Fetch species name from NCBI
  const handleFetchSpeciesName = async () => {
    // Validate taxid first
    const validationError = validateTaxid(taxid)
    if (validationError) {
      setFetchError(validationError)
      return
    }

    setFetchLoading(true)
    setFetchError(null)

    try {
      const response = await fetch(`/api/taxid-lookup?taxid=${encodeURIComponent(taxid.trim())}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch species name')
      }

      // Populate the species name field
      if (data.scientificName) {
        setTaxidSpec(data.scientificName)
      } else {
        setFetchError('Species name not found')
      }
    } catch (err: any) {
      setFetchError(err.message || 'Failed to fetch species name from NCBI')
      console.error('Error fetching species name:', err)
    } finally {
      setFetchLoading(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Validate taxid
    const validationError = validateTaxid(taxid)
    if (validationError) {
      setFormError(validationError)
      return
    }

    const taxidNum = parseInt(taxid.trim(), 10)

    setFormLoading(true)

    try {
      const { data, error: createError } = await supabase.rpc('create_user_taxid', {
        p_taxid: taxidNum,
        p_taxid_spec: taxidSpec.trim() || null,
      })

      if (createError) {
        throw createError
      }

      // Reset form
      setTaxid('')
      setTaxidSpec('')
      setShowForm(false)
      setFormError(null)

      // Refresh taxids list
      await fetchTaxids()
    } catch (err: any) {
      setFormError(err.message || 'Failed to create taxid entry')
      console.error('Error creating taxid:', err)
    } finally {
      setFormLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async (entryId: number) => {
    if (!confirm('Are you sure you want to delete this taxid entry? This action cannot be undone.')) {
      return
    }

    setDeleteLoading(entryId)

    try {
      const { error: deleteError } = await supabase.rpc('delete_user_taxid', {
        p_entry_id: entryId,
      })

      if (deleteError) {
        throw deleteError
      }

      // Refresh taxids list
      await fetchTaxids()
    } catch (err: any) {
      setError(err.message || 'Failed to delete taxid entry')
      console.error('Error deleting taxid:', err)
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          TaxID Area
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
        >
          {showForm ? 'Cancel' : 'Add New TaxID'}
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
            Add New TaxID Entry
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="taxid"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                TaxID (NCBI Taxonomy ID) <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  id="taxid"
                  value={taxid}
                  onChange={(e) => {
                    setTaxid(e.target.value)
                    setFetchError(null)
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter NCBI taxonomy ID (e.g., 9606)"
                  min="1"
                  step="1"
                  required
                />
                <button
                  type="button"
                  onClick={handleFetchSpeciesName}
                  disabled={fetchLoading || !taxid.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors whitespace-nowrap"
                  title="Fetch species name from NCBI"
                >
                  {fetchLoading ? 'Fetching...' : 'Fetch Name'}
                </button>
              </div>
              {fetchError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fetchError}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Must be a positive integer representing an NCBI taxonomy ID
              </p>
            </div>

            <div>
              <label
                htmlFor="taxidSpec"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Species Name (Optional)
              </label>
              <input
                type="text"
                id="taxidSpec"
                value={taxidSpec}
                onChange={(e) => setTaxidSpec(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter human-readable species name (e.g., Homo sapiens)"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Optional human-readable species name for reference
              </p>
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
                {formLoading ? 'Creating...' : 'Create TaxID Entry'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setTaxid('')
                  setTaxidSpec('')
                  setFormError(null)
                  setFetchError(null)
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
            <p className="text-gray-600 dark:text-gray-400">Loading taxids...</p>
          </div>
        ) : taxids.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No taxid entries found. Create your first taxid entry to get started.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
            >
              Add New TaxID
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    TaxID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Species Name
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
                {taxids.map((taxidEntry) => (
                  <tr key={taxidEntry.entry_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {taxidEntry.taxid}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {taxidEntry.taxid_spec || (
                        <span className="text-gray-400 dark:text-gray-500 italic">Not specified</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(taxidEntry.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(taxidEntry.entry_id)}
                        disabled={deleteLoading === taxidEntry.entry_id}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleteLoading === taxidEntry.entry_id ? 'Deleting...' : 'Delete'}
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

