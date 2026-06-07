import React, { useState, useEffect } from 'react'
import { X, AlertCircle, Loader } from 'lucide-react'
import { Profile } from '../types'
import { useSettlements } from '../hooks/useSettlements'
import { SUPPORTED_CURRENCIES } from '../lib/utils'

interface SettleModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  members: Profile[]
  defaultPayerId: string
  defaultPayeeId: string
  defaultAmount: number
  defaultCurrency: string
  onSave: () => void
}

export const SettleModal: React.FC<SettleModalProps> = ({
  isOpen,
  onClose,
  groupId,
  members,
  defaultPayerId,
  defaultPayeeId,
  defaultAmount,
  defaultCurrency,
  onSave
}) => {
  const { recordSettlement, loading } = useSettlements()

  const [payerId, setPayerId] = useState('')
  const [payeeId, setPayeeId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setValidationError(null)
      setPayerId(defaultPayerId || members[0]?.id || '')
      setPayeeId(defaultPayeeId || members[1]?.id || members[0]?.id || '')
      setAmount(defaultAmount > 0 ? defaultAmount.toFixed(2) : '')
      setCurrency(defaultCurrency || 'USD')
    }
  }, [isOpen, defaultPayerId, defaultPayeeId, defaultAmount, defaultCurrency, members])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (payerId === payeeId) {
      setValidationError('Payer and Payee cannot be the same user.')
      return
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Please enter a valid amount greater than 0.')
      return
    }

    const success = await recordSettlement(groupId, payerId, payeeId, parsedAmount, currency)
    if (success) {
      onSave()
      onClose()
    } else {
      setValidationError('Failed to record settlement log.')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div className="glass-panel w-full max-w-md rounded-3xl p-6 md:p-8 transform scale-100 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white tracking-tight">Record Debt Settlement</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {validationError && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Payer (Sent Cash)</label>
              <select
                value={payerId}
                onChange={e => setPayerId(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-3 text-sm appearance-none bg-slate-900 focus:outline-none cursor-pointer"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Payee (Received Cash)</label>
              <select
                value={payeeId}
                onChange={e => setPayeeId(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-3 text-sm appearance-none bg-slate-900 focus:outline-none cursor-pointer"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount Paid</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-3 text-sm appearance-none bg-slate-900 focus:outline-none cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-accent-blue to-accent-blue/80 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-accent-blue/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              <span>Settle Balance</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
