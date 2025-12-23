'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Type definitions
interface UserAssay {
  assay_id: number
  assay_name: string
  target_taxid: number | null
  target_gene: string | null
  assay_ref_amplicon: number
  amplicon_name: string | null
  created_at: string
}

interface TaxID {
  entry_id: number
  taxid: number
  taxid_spec: string | null
}

export default function AssayRepositoryPage() {
  const [assays, setAssays] = useState<UserAssay[]>([])
  const [taxids, setTaxids] = useState<TaxID[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null)

  // Form state
  const [assayName, setAssayName] = useState('')
  const [targetTaxid, setTargetTaxid] = useState<number | null>(null)
  const [targetGene, setTargetGene] = useState('')
  const [ampliconSequence, setAmpliconSequence] = useState('')
  const [ampliconName, setAmpliconName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Import state
  const [showImportForm, setShowImportForm] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)

  // Fetch assays
  const fetchAssays = async () => {
    try {
      setError(null)
      const { data, error: fetchError } = await supabase.rpc('fetch_user_assays')

      if (fetchError) {
        throw fetchError
      }

      // Handle the response - ensure data is an array and map to our type
      if (data && Array.isArray(data)) {
        const mappedData = data.map((item: any) => ({
          assay_id: Number(item.assay_id),
          assay_name: item.assay_name,
          target_taxid: item.target_taxid ? Number(item.target_taxid) : null,
          target_gene: item.target_gene || null,
          assay_ref_amplicon: Number(item.assay_ref_amplicon),
          amplicon_name: item.amplicon_name || null,
          created_at: item.created_at,
        }))
        setAssays(mappedData)
      } else {
        setAssays([])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch assays')
      console.error('Error fetching assays:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch taxids for dropdown
  const fetchTaxids = async () => {
    try {
      const { data, error: fetchError } = await supabase.rpc('fetch_user_taxids')

      if (fetchError) {
        console.error('Error fetching taxids:', fetchError)
        // Don't throw - taxids are optional
        return
      }

      // Handle the response - ensure data is an array and map to our type
      if (data && Array.isArray(data)) {
        const mappedData = data.map((item: any) => ({
          entry_id: Number(item.entry_id),
          taxid: Number(item.taxid),
          taxid_spec: item.taxid_spec || null,
        }))
        setTaxids(mappedData)
      } else {
        setTaxids([])
      }
    } catch (err: any) {
      console.error('Error fetching taxids:', err)
      // Taxids are optional, so we continue even if this fails
    }
  }

  useEffect(() => {
    fetchAssays()
    fetchTaxids()
  }, [])

  // Validate DNA sequence
  const validateDnaSequence = (sequence: string): string | null => {
    // Remove spaces and convert to uppercase
    const cleaned = sequence.replace(/\s/g, '').toUpperCase()

    if (!cleaned) {
      return 'Amplicon sequence is required'
    }

    // Check for valid DNA characters (A, C, G, T and IUPAC codes: R, Y, S, W, K, M, B, D, H, V, N)
    const validChars = /^[ACGTIRYSWKMBDHVN]+$/
    if (!validChars.test(cleaned)) {
      return 'Sequence contains invalid characters. Only A, C, G, T and IUPAC ambiguous codes (R, Y, S, W, K, M, B, D, H, V, N) are allowed.'
    }

    return null
  }

  // Parse FASTA file (single entry only)
  const parseFastaFile = (content: string): { name: string; sequence: string } | null => {
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

    if (sequences.length === 0) {
      return null
    }

    if (sequences.length > 1) {
      throw new Error('FASTA file must contain exactly one sequence. Found ' + sequences.length + ' sequences.')
    }

    return sequences[0]
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

    try {
      // Read file content
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsText(importFile)
      })

      // Parse FASTA file (must have exactly one sequence)
      const parsed = parseFastaFile(fileContent)

      if (!parsed) {
        setFormError('No sequence found in FASTA file')
        setImportLoading(false)
        return
      }

      // Clean and validate sequence
      const cleanedSequence = parsed.sequence.replace(/\s/g, '').toUpperCase()
      const validationError = validateDnaSequence(cleanedSequence)

      if (validationError) {
        setFormError(validationError)
        setImportLoading(false)
        return
      }

      // Populate form fields
      setAmpliconSequence(cleanedSequence)
      if (parsed.name && !ampliconName.trim()) {
        setAmpliconName(parsed.name)
      }

      // Close import form and show main form
      setShowImportForm(false)
      setImportFile(null)
      setShowForm(true)
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

    // Validate assay name
    if (!assayName.trim()) {
      setFormError('Assay name is required')
      return
    }

    // Clean and validate DNA sequence
    const cleanedSequence = ampliconSequence.replace(/\s/g, '').toUpperCase()
    const validationError = validateDnaSequence(cleanedSequence)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setFormLoading(true)

    try {
      const { data, error: createError } = await supabase.rpc('create_user_assay', {
        p_assay_name: assayName.trim(),
        p_amplicon_seq: cleanedSequence,
        p_target_taxid: targetTaxid !== null && targetTaxid !== undefined ? targetTaxid : null,
        p_target_gene: targetGene.trim() || null,
        p_amplicon_name: ampliconName.trim() || null,
      })

      if (createError) {
        throw createError
      }

      // Reset form
      setAssayName('')
      setTargetTaxid(null)
      setTargetGene('')
      setAmpliconSequence('')
      setAmpliconName('')
      setShowForm(false)
      setFormError(null)

      // Refresh assays list
      await fetchAssays()
    } catch (err: any) {
      setFormError(err.message || 'Failed to create assay')
      console.error('Error creating assay:', err)
    } finally {
      setFormLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async (assayId: number) => {
    if (!confirm('Are you sure you want to delete this assay? This will also delete the associated reference amplicon and any linked oligos. This action cannot be undone.')) {
      return
    }

    setDeleteLoading(assayId)

    try {
      const { error: deleteError } = await supabase.rpc('delete_user_assay', {
        p_assay_id: assayId,
      })

      if (deleteError) {
        throw deleteError
      }

      // Refresh assays list
      await fetchAssays()
    } catch (err: any) {
      setError(err.message || 'Failed to delete assay')
      console.error('Error deleting assay:', err)
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

  // Get taxid display string
  const getTaxidDisplay = (entryId: number | null) => {
    if (entryId === null || entryId === undefined) return 'Not assigned'
    const taxidEntry = taxids.find((t) => t.entry_id === entryId)
    if (!taxidEntry) return `Entry ID: ${entryId}`
    return taxidEntry.taxid_spec 
      ? `${taxidEntry.taxid} (${taxidEntry.taxid_spec})`
      : `TaxID: ${taxidEntry.taxid}`
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Assay Repository
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportForm(!showImportForm)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition-colors"
          >
            {showImportForm ? 'Cancel Import' : 'Import from FASTA'}
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm)
              if (showForm) {
                // Reset form when closing
                setAssayName('')
                setTargetTaxid(null)
                setTargetGene('')
                setAmpliconSequence('')
                setAmpliconName('')
                setFormError(null)
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
          >
            {showForm ? 'Cancel' : 'Add New Assay'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {showImportForm && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Import Amplicon Sequence from FASTA File
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
                Select a FASTA file (.fasta, .fa, .fas, or .fna) containing exactly one sequence. The sequence will be imported as the reference amplicon.
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
                disabled={importLoading || !importFile}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg shadow-sm transition-colors"
              >
                {importLoading ? 'Importing...' : 'Import Sequence'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowImportForm(false)
                  setImportFile(null)
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

      {showForm && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Add New Assay
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="assayName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Assay Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="assayName"
                value={assayName}
                onChange={(e) => setAssayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter assay name"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Must be unique for your account
              </p>
            </div>

            <div>
              <label
                htmlFor="targetTaxid"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Target TaxID (Optional)
              </label>
              <select
                id="targetTaxid"
                value={targetTaxid || ''}
                onChange={(e) => setTargetTaxid(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Not assigned</option>
                {taxids.map((taxid) => (
                  <option key={taxid.entry_id} value={taxid.entry_id}>
                    {taxid.taxid_spec 
                      ? `${taxid.taxid} - ${taxid.taxid_spec}`
                      : `TaxID: ${taxid.taxid}`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Select a taxid entry from your taxid surveillance table
              </p>
            </div>

            <div>
              <label
                htmlFor="targetGene"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Target Gene (Optional)
              </label>
              <input
                type="text"
                id="targetGene"
                value={targetGene}
                onChange={(e) => setTargetGene(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter target gene name (e.g., rpoB)"
              />
            </div>

            <div>
              <label
                htmlFor="ampliconSequence"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Reference Amplicon Sequence <span className="text-red-500">*</span>
              </label>
              <textarea
                id="ampliconSequence"
                value={ampliconSequence}
                onChange={(e) => setAmpliconSequence(e.target.value)}
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
                htmlFor="ampliconName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Amplicon Name (Optional)
              </label>
              <input
                type="text"
                id="ampliconName"
                value={ampliconName}
                onChange={(e) => setAmpliconName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter optional name for the reference amplicon"
              />
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
                {formLoading ? 'Creating...' : 'Create Assay'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setAssayName('')
                  setTargetTaxid(null)
                  setTargetGene('')
                  setAmpliconSequence('')
                  setAmpliconName('')
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
            <p className="text-gray-600 dark:text-gray-400">Loading assays...</p>
          </div>
        ) : assays.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No assays found. Create your first assay to get started.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
            >
              Add New Assay
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Assay Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Target TaxID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Target Gene
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Amplicon Name
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
                {assays.map((assay) => (
                  <tr key={assay.assay_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {assay.assay_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {getTaxidDisplay(assay.target_taxid)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {assay.target_gene || (
                        <span className="text-gray-400 dark:text-gray-500 italic">Not specified</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {assay.amplicon_name || (
                        <span className="text-gray-400 dark:text-gray-500 italic">Unnamed</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(assay.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(assay.assay_id)}
                        disabled={deleteLoading === assay.assay_id}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleteLoading === assay.assay_id ? 'Deleting...' : 'Delete'}
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
