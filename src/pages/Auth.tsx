import React, { useState } from 'react'
import { Wallet, ArrowRight, Loader, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export const Auth: React.FC = () => {
  const { signIn, signUp, error: authError, clearError } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleModeChange = (newMode: 'login' | 'signup') => {
    setMode(newMode)
    clearError()
    setLocalError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    if (mode === 'signup') {
      if (username.trim().length < 3) {
        setLocalError('Username must be at least 3 characters long.')
        return
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setLocalError('Username can only contain alphanumeric characters and underscores.')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password, name.trim(), username.trim().toLowerCase())
        setLocalError('A verification link has been sent to your email. Please verify your account to log in.')
        setMode('login')
      }
    } catch (err: any) {
      // Handled by auth context
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Accent Gradients */}
      <div className="absolute w-72 h-72 bg-accent-blue/10 rounded-full blur-3xl -top-20 -left-20 pointer-events-none"></div>
      <div className="absolute w-96 h-96 bg-accent-green/5 rounded-full blur-3xl -bottom-20 -right-20 pointer-events-none"></div>

      <div className="glass-panel w-full max-w-md rounded-3xl p-8 md:p-10 relative z-10 transition-all duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-accent-blue to-accent-green rounded-2xl flex items-center justify-center shadow-lg shadow-accent-blue/20 mb-3">
            <Wallet className="text-slate-900 w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            SplitID
          </h1>
          <p className="text-xs text-slate-400 mt-1 tracking-wide uppercase">
            Premium Expense Architecture
          </p>
        </div>

        <div className="flex bg-black/20 p-1 rounded-xl mb-6 border border-white/5">
          <button
            onClick={() => handleModeChange('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              mode === 'login' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => handleModeChange('signup')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              mode === 'signup' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {(authError || localError) && (
          <div className="mb-5 bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3.5 rounded-xl flex items-start gap-2.5 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{localError || authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
                  placeholder="Alex Morgan"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Username (Public Searchable)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
                  placeholder="alex_m"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
              placeholder="name@domain.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-white text-slate-950 font-semibold py-3.5 px-4 rounded-xl hover:bg-slate-100 transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.99] shadow-lg shadow-white/5 disabled:opacity-50"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'login' ? 'Access Dashboard' : 'Establish Account Architecture'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
