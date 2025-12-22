'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function Home() {
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [session, setSession] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Check database connection
    const checkConnection = async () => {
      try {
        // Check if we can reach Supabase by getting the session
        // This verifies both network connectivity and API key validity
        const { data, error } = await supabase.auth.getSession()
        
        // If we get a response (even if no session), connection is working
        // Only mark as disconnected if there's a network/connection error
        if (error) {
          // Check if it's a connection error vs auth error
          const isConnectionError = 
            error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError')
          
          if (isConnectionError) {
            throw error
          }
        }
        
        setDbStatus('connected')
      } catch (error) {
        console.error('Database connection error:', error)
        setDbStatus('disconnected')
      }
    }

    checkConnection()

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getStatusColor = () => {
    switch (dbStatus) {
      case 'connected':
        return 'bg-green-500'
      case 'disconnected':
        return 'bg-red-500'
      default:
        return 'bg-yellow-500'
    }
  }

  const getStatusText = () => {
    switch (dbStatus) {
      case 'connected':
        return 'Connected'
      case 'disconnected':
        return 'Disconnected'
      default:
        return 'Checking...'
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* Status Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Database Status:
            </span>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`}></div>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {getStatusText()}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Sequence diversity surveillance tool
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Primer sequence surveillance tool
          </p>

          {session ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Logged in as: <span className="font-semibold">{session.user.email}</span>
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <Link
                href="/login"
                className="block w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-center"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="block w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-center"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

