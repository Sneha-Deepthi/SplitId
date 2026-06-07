import React, { useState, useEffect } from 'react'
import { Copy, Check, Save, Loader, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export const Profile: React.FC = () => {
  const { user, updateProfile, loading: authLoading } = useAuth()
  
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [copied, setCopied] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setUsername(user.username)
    }
  }, [user])

  const handleCopy = () => {
    if (!user) return
    navigator.clipboard.writeText(user.public_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long.')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain alphanumeric characters and underscores.')
      return
    }

    try {
      await updateProfile({
        name: name.trim(),
        username: username.trim().toLowerCase()
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.')
    }
  }

  const initials = user?.name?.substring(0, 2).toUpperCase() || 'ID'

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-bold text-white">Profile Settings</h2>
        <p className="text-xs text-slate-400">Configure your identity registry details</p>
      </div>

      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent-blue to-accent-green p-0.5 shadow-md shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center font-bold text-xl text-white">
              {initials}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-normal">{user?.name}</h3>
            <p className="text-xs text-slate-400">Premium Tier Core User</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-accent-green/10 border border-accent-green/30 text-accent-green p-3 rounded-xl text-xs">
            Profile metadata synchronized successfully.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
              Registered Email
            </label>
            <input
              type="text"
              readOnly
              className="w-full glass-input rounded-xl px-4 py-3 text-sm cursor-not-allowed opacity-60 focus:outline-none"
              value={user?.email || ''}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
              Public Routing ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                className="flex-1 glass-input rounded-xl px-4 py-3 text-sm font-mono text-accent-blue focus:outline-none"
                value={user?.public_id || ''}
              />
              <button
                type="button"
                onClick={handleCopy}
                className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              Display Name
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
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              Username
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

          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-white text-slate-950 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-100 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-[0.99] disabled:opacity-50"
          >
            {authLoading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Registry Metadata</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
