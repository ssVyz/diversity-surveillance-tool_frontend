'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface UserSettings {
  user_name: string | null
  user_institution: string | null
}

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [userInstitution, setUserInstitution] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Fetch user email and settings
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get user email from auth
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setEmail(user.email || null)
        }

        // Fetch name and institution from database
        const { data, error: fetchError } = await supabase.rpc('fetch_user_name_institution')

        if (fetchError) {
          throw fetchError
        }

        // The function returns an array with one row, or empty array if no entry exists
        if (data && Array.isArray(data) && data.length > 0) {
          const settings = data[0] as UserSettings
          setUserName(settings.user_name || '')
          setUserInstitution(settings.user_institution || '')
        } else {
          // No entry exists yet
          setUserName('')
          setUserInstitution('')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch user settings')
        console.error('Error fetching user data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const { data, error: updateError } = await supabase.rpc('edit_user_name_institution', {
        p_user_name: userName.trim() || null,
        p_user_institution: userInstitution.trim() || null,
      })

      if (updateError) {
        throw updateError
      }

      setSuccess(true)
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update settings')
      console.error('Error updating settings:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          User Information
        </h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-800 dark:text-green-200 text-sm">
              Settings updated successfully!
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Email cannot be changed
            </p>
          </div>

          {/* Name (editable) */}
          <div>
            <label
              htmlFor="user-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Name
            </label>
            <input
              type="text"
              id="user-name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="No name set yet"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {!userName && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                No name set yet
              </p>
            )}
          </div>

          {/* Institution (editable) */}
          <div>
            <label
              htmlFor="user-institution"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Institution
            </label>
            <input
              type="text"
              id="user-institution"
              value={userInstitution}
              onChange={(e) => setUserInstitution(e.target.value)}
              placeholder="No institution set yet"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {!userInstitution && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                No institution set yet
              </p>
            )}
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors font-medium"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

