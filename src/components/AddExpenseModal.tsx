import React, { useState, useEffect } from 'react'
import { X, UploadCloud, AlertCircle, Loader } from 'lucide-react'
import { Profile, Expense } from '../types'
import { useExpenses } from '../hooks/useExpenses'
import { useAuth } from '../hooks/useAuth'
import { SUPPORTED_CURRENCIES, cn } from '../lib/utils'

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  members: Profile[]
  expenseToEdit: Expense | null
  onSave: () => void
}

type SplitMode = 'equal' | 'percentage' | 'exact'

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  groupId,
  members,
  expenseToEdit,
  onSave
}) => {
  const { addExpense, updateExpense, uploadReceipt, loading: expenseLoading } = useExpenses()
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [paidBy, setPaidBy] = useState('')
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [notes, setNotes] = useState('')
  
  // Splits state: maps profile_id to value (checkbox state for equal, percentage or amount for others)
  const [equalSplits, setEqualSplits] = useState<Record<string, boolean>>({})
  const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>({})
  const [exactSplits, setExactSplits] = useState<Record<string, string>>({})

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Initialize form fields
  useEffect(() => {
    if (isOpen) {
      setValidationError(null)
      if (expenseToEdit) {
        setTitle(expenseToEdit.title)
        setAmount(expenseToEdit.amount.toString())
        setCurrency(expenseToEdit.currency)
        setPaidBy(expenseToEdit.paid_by)
        setNotes(expenseToEdit.notes || '')
        setReceiptUrl(expenseToEdit.receipt_url)
        
        // Detect split mode and fill states
        const totalSplitsCount = expenseToEdit.splits?.length || 0
        const isPercentage = expenseToEdit.splits?.some(s => s.percentage !== null)
        
        if (isPercentage) {
          setSplitMode('percentage')
          const pctMap: Record<string, string> = {}
          expenseToEdit.splits?.forEach(s => {
            pctMap[s.profile_id] = s.percentage?.toString() || '0'
          })
          setPercentageSplits(pctMap)
        } else {
          // Check if equal split: splits are roughly equal and all members are present
          const equalVal = Number(expenseToEdit.amount) / Math.max(1, totalSplitsCount)
          const isAllEqual = expenseToEdit.splits?.every(s => Math.abs(Number(s.amount) - equalVal) < 0.05)
          
          if (isAllEqual && totalSplitsCount > 0) {
            setSplitMode('equal')
            const eqMap: Record<string, boolean> = {}
            members.forEach(m => {
              eqMap[m.id] = expenseToEdit.splits?.some(s => s.profile_id === m.id) || false
            })
            setEqualSplits(eqMap)
          } else {
            setSplitMode('exact')
            const exMap: Record<string, string> = {}
            expenseToEdit.splits?.forEach(s => {
              exMap[s.profile_id] = s.amount.toString()
            })
            setExactSplits(exMap)
          }
        }
      } else {
        // Defaults for new expense
        setTitle('')
        setAmount('')
        setCurrency('USD')
        setPaidBy(members[0]?.id || '')
        setSplitMode('equal')
        setNotes('')
        setReceiptUrl(null)
        
        // Default equal splits: check all members
        const eqMap: Record<string, boolean> = {}
        members.forEach(m => { eqMap[m.id] = true })
        setEqualSplits(eqMap)
        
        // Default percentages: equal distribution
        const pctMap: Record<string, string> = {}
        const defaultPct = (100 / Math.max(1, members.length)).toFixed(2)
        members.forEach(m => { pctMap[m.id] = defaultPct })
        setPercentageSplits(pctMap)

        // Default exact: empty
        const exMap: Record<string, string> = {}
        members.forEach(m => { exMap[m.id] = '' })
        setExactSplits(exMap)
      }
    }
  }, [isOpen, expenseToEdit, members])

  if (!isOpen) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setValidationError('File size exceeds 5MB limit.')
      return
    }

    setUploadingFile(true)
    setValidationError(null)
    try {
      const url = await uploadReceipt(file)
      if (url) {
        setReceiptUrl(url)
      } else {
        setValidationError('Failed to upload receipt.')
      }
    } catch (err: any) {
      setValidationError(err.message)
    } finally {
      setUploadingFile(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Please enter a valid amount greater than 0.')
      return
    }

    // Process splits based on mode
    const computedSplits: { profileId: string; amount: number; percentage?: number }[] = []

    if (splitMode === 'equal') {
      const checkedMembers = Object.keys(equalSplits).filter(id => equalSplits[id])
      if (checkedMembers.length === 0) {
        setValidationError('Please select at least one member to split the expense.')
        return
      }

      const share = Number((parsedAmount / checkedMembers.length).toFixed(2))
      // Handle remaining pennies
      let totalAssigned = 0
      checkedMembers.forEach((id, index) => {
        let memberShare = share
        if (index === checkedMembers.length - 1) {
          memberShare = Number((parsedAmount - totalAssigned).toFixed(2))
        }
        totalAssigned += memberShare
        computedSplits.push({
          profileId: id,
          amount: memberShare
        })
      })
    } else if (splitMode === 'percentage') {
      let totalPct = 0
      members.forEach(m => {
        totalPct += parseFloat(percentageSplits[m.id] || '0')
      })

      if (Math.abs(totalPct - 100) > 0.05) {
        setValidationError(`Percentages must sum to exactly 100% (currently ${totalPct.toFixed(2)}%).`)
        return
      }

      let totalAssigned = 0
      members.forEach((m, index) => {
        const pct = parseFloat(percentageSplits[m.id] || '0')
        let memberShare = Number(((pct / 100) * parsedAmount).toFixed(2))
        if (index === members.length - 1) {
          memberShare = Number((parsedAmount - totalAssigned).toFixed(2))
        }
        totalAssigned += memberShare
        computedSplits.push({
          profileId: m.id,
          amount: memberShare,
          percentage: pct
        })
      })
    } else if (splitMode === 'exact') {
      let totalExact = 0
      members.forEach(m => {
        totalExact += parseFloat(exactSplits[m.id] || '0')
      })

      if (Math.abs(totalExact - parsedAmount) > 0.005) {
        setValidationError(`Exact split sum (${totalExact.toFixed(2)}) must equal total amount (${parsedAmount.toFixed(2)}).`)
        return
      }

      members.forEach(m => {
        computedSplits.push({
          profileId: m.id,
          amount: parseFloat(exactSplits[m.id] || '0')
        })
      })
    }

    let success = false
    if (expenseToEdit) {
      success = await updateExpense(
        groupId,
        expenseToEdit.id,
        title.trim(),
        parsedAmount,
        currency,
        paidBy,
        notes.trim() || null,
        receiptUrl,
        computedSplits
      )
    } else {
      success = await addExpense(
        groupId,
        title.trim(),
        parsedAmount,
        currency,
        paidBy,
        notes.trim() || null,
        receiptUrl,
        computedSplits
      )
    }

    if (success) {
      onSave()
      onClose()
    } else {
      setValidationError('Failed to commit expense entry.')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-6 md:p-8 transform scale-100 transition-all duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white tracking-tight">
            {expenseToEdit ? 'Edit Expense Entry' : 'Create Asset/Expense Entry'}
          </h3>
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
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Expense / Transaction Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
              placeholder="e.g., Grocery Provisions, Dinner Tab"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-3 text-sm"
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
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Paid By</label>
              <select
                value={paidBy}
                onChange={e => setPaidBy(e.target.value)}
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

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Split Architecture Mode</label>
            <div className="grid grid-cols-3 gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
              {(['equal', 'percentage', 'exact'] as SplitMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSplitMode(mode)}
                  className={cn(
                    'py-2 text-xs font-medium rounded-lg capitalize transition-all duration-200',
                    splitMode === mode ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {mode === 'equal' ? 'Equal' : mode === 'percentage' ? '% Share' : 'Specific'}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional splits inputs based on mode */}
          <div className="bg-black/10 rounded-2xl p-4 border border-white/5 space-y-3 max-h-[220px] overflow-y-auto">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Split Distributions</p>
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between text-sm gap-2">
                <span className="text-slate-300 font-medium truncate max-w-[150px]">
                  {member.name} {member.id === user?.id && '(You)'}
                </span>

                {splitMode === 'equal' && (
                  <input
                    type="checkbox"
                    checked={equalSplits[member.id] || false}
                    onChange={e => setEqualSplits({ ...equalSplits, [member.id]: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-white/10 text-accent-blue focus:ring-0 cursor-pointer"
                  />
                )}

                {splitMode === 'percentage' && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="any"
                      value={percentageSplits[member.id] || ''}
                      onChange={e => setPercentageSplits({ ...percentageSplits, [member.id]: e.target.value })}
                      className="w-20 glass-input rounded-lg px-2.5 py-1 text-right text-xs"
                      placeholder="0.00"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                )}

                {splitMode === 'exact' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">{currency}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={exactSplits[member.id] || ''}
                      onChange={e => setExactSplits({ ...exactSplits, [member.id]: e.target.value })}
                      className="w-24 glass-input rounded-lg px-2.5 py-1 text-right text-xs"
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full glass-input rounded-xl px-4 py-2.5 text-sm h-16 focus:outline-none resize-none"
              placeholder="Add payment details, items list, or comments..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Receipt & Ledger Verification</label>
            {receiptUrl ? (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-accent-blue/5 border border-accent-blue/20">
                <div className="truncate text-xs font-mono text-accent-blue max-w-[320px]">
                  Receipt: {receiptUrl}
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptUrl(null)}
                  className="text-xs text-rose-400 hover:underline hover:text-rose-300 font-medium"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-white/10 rounded-2xl p-4 text-center hover:border-accent-blue/40 transition-colors cursor-pointer group flex flex-col items-center">
                <input
                  type="file"
                  accept="image/png, image/jpeg, application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {uploadingFile ? (
                  <>
                    <Loader className="w-6 h-6 animate-spin text-accent-blue mb-2" />
                    <span className="block text-xs text-slate-300 font-medium">Uploading to ledger nodes...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-6 h-6 text-slate-500 group-hover:text-accent-blue transition-colors mb-2" />
                    <span className="block text-xs text-slate-300 font-medium">Drop physical receipt or verification file here</span>
                    <span className="block text-[10px] text-slate-500 mt-1">PDF, PNG, JPG accepted (Max 5MB)</span>
                  </>
                )}
              </label>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={expenseLoading || uploadingFile}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={expenseLoading || uploadingFile}
              className="flex-1 py-3 bg-gradient-to-r from-accent-blue to-accent-blue/80 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-accent-blue/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {expenseLoading && <Loader className="w-4 h-4 animate-spin" />}
              <span>{expenseToEdit ? 'Save Changes' : 'Commit Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
