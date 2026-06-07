import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'

interface AuthContextType {
  user: Profile | null
  session: any | null
  loading: boolean
  error: string | null
  signUp: (email: string, password: string, name: string, username: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: { name?: string; username?: string; avatar_url?: string | null }) => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (profileErr) throw profileErr
      
      if (!data) {
        throw new Error('User profile not found. If you registered before the database fix, please sign up with a new email.')
      }

      setUser(data)
    } catch (e: any) {
      console.error('Error fetching user profile:', e.message)
      setError(e.message)
      setUser(null)
    }
  }

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session: activeSession } }: any) => {
      setSession(activeSession)
      if (activeSession?.user) {
        fetchProfile(activeSession.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Listen to auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, currentSession: any) => {
      setSession(currentSession)
      if (currentSession?.user) {
        setLoading(true)
        await fetchProfile(currentSession.user.id)
        setLoading(false)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, name: string, username: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            username,
          },
        },
      })

      if (signUpError) throw signUpError

      if (data && !data.session) {
        setLoading(false)
      }
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
      throw e
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
      throw e
    }
  }

  const signOut = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      setUser(null)
      setSession(null)
    } catch (e: any) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: { name?: string; username?: string; avatar_url?: string | null }) => {
    if (!user) return
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) throw updateError
      // Refresh local profile
      await fetchProfile(user.id)
    } catch (e: any) {
      setError(e.message)
      throw e
    }
  }

  const clearError = () => setError(null)

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        error,
        signUp,
        signIn,
        signOut,
        updateProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
