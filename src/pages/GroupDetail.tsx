import React, { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Plus,
  Users,
  Search,
  AlertCircle,
  FileText,
  Trash2,
  Edit,
  DollarSign,
  Loader,
  RefreshCw,
  Send,
  History
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroups'
import { useExpenses } from '../hooks/useExpenses'
import { useSettlements } from '../hooks/useSettlements'
import { Group, Profile, Expense, Settlement, ActivityLog, DebtTransfer } from '../types'
import { AddExpenseModal } from '../components/AddExpenseModal'
import { SettleModal } from '../components/SettleModal'
import { calculateBalances, formatCurrency, formatRelativeTime } from '../lib/utils'

interface GroupDetailProps {
  groupId: string
  onNavigate: (page: string, params?: any) => void
}

export const GroupDetail: React.FC<GroupDetailProps> = ({ groupId, onNavigate }) => {
  const { user } = useAuth()
  const { fetchGroupDetail, addMemberByPublicId, loading: groupLoading } = useGroups()
  const { fetchExpenses, deleteExpense, loading: expensesLoading } = useExpenses()
  const { fetchSettlements, deleteSettlement, fetchActivityLogs, loading: settleLoading } = useSettlements()

  const [group, setGroup] = useState<Group | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [simplifiedDebts, setSimplifiedDebts] = useState<DebtTransfer[]>([])
  const [userBalances, setUserBalances] = useState<Record<string, number>>({})

  // Tab management
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements'>('expenses')

  // Modals state
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null)
  
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [settlePayerId, setSettlePayerId] = useState('')
  const [settlePayeeId, setSettlePayeeId] = useState('')
  const [settleAmount, setSettleAmount] = useState(0)
  const [settleCurrency, setSettleCurrency] = useState('USD')

  // Member management states
  const [newMemberPublicId, setNewMemberPublicId] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [memberSuccess, setMemberSuccess] = useState(false)

  const loadAllDetails = async () => {
    if (!user) return
    
    // Fetch group core
    const details = await fetchGroupDetail(groupId)
    if (!details) {
      onNavigate('dashboard')
      return
    }
    setGroup(details)

    // Fetch expenses & settlements
    const exps = await fetchExpenses(groupId)
    const setls = await fetchSettlements(groupId)
    setExpenses(exps)
    setSettlements(setls)

    // Calculate simplified debts
    if (details.members) {
      const debts = calculateBalances(details.members, exps, setls)
      setSimplifiedDebts(debts)
    }

    // Calculate personal net balance per currency
    const personalBalances: Record<string, number> = {}
    exps.forEach(exp => {
      const currency = exp.currency
      if (!personalBalances[currency]) personalBalances[currency] = 0

      if (exp.paid_by === user.id) {
        personalBalances[currency] += exp.amount
      }

      const userSplit = exp.splits?.find(s => s.profile_id === user.id)
      if (userSplit) {
        personalBalances[currency] -= userSplit.amount
      }
    })

    setls.forEach(settle => {
      const currency = settle.currency
      if (!personalBalances[currency]) personalBalances[currency] = 0

      if (settle.payer_id === user.id) {
        personalBalances[currency] += settle.amount
      }
      if (settle.payee_id === user.id) {
        personalBalances[currency] -= settle.amount
      }
    })

    Object.keys(personalBalances).forEach(cur => {
      personalBalances[cur] = Math.round(personalBalances[cur] * 100) / 100
    })

    setUserBalances(personalBalances)

    // Fetch group activity logs
    const logs = await fetchActivityLogs(groupId)
    setActivityLogs(logs)
  }

  useEffect(() => {
    loadAllDetails()

    const handleOpenModal = () => {
      setExpenseToEdit(null)
      setShowExpenseModal(true)
    }

    window.addEventListener('open-add-expense-modal', handleOpenModal)
    return () => {
      window.removeEventListener('open-add-expense-modal', handleOpenModal)
    }
  }, [groupId, user])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setMemberError(null)
    setMemberSuccess(false)
    if (!newMemberPublicId.trim()) return

    setAddingMember(true)
    const success = await addMemberByPublicId(groupId, newMemberPublicId.trim())
    setAddingMember(false)

    if (success) {
      setNewMemberPublicId('')
      setMemberSuccess(true)
      loadAllDetails()
      setTimeout(() => setMemberSuccess(false), 3000)
    } else {
      setMemberError('Failed to add member. Double check the public ID.')
    }
  }

  const handleDeleteExpense = async (expense: Expense) => {
    if (confirm(`Are you sure you want to delete "${expense.title}"?`)) {
      const success = await deleteExpense(groupId, expense.id, expense.title)
      if (success) {
        loadAllDetails()
      }
    }
  }

  const handleDeleteSettlement = async (s: Settlement) => {
    if (confirm('Delete this settlement entry?')) {
      const success = await deleteSettlement(
        groupId,
        s.id,
        s.payer?.name || 'User',
        s.payee?.name || 'User',
        s.amount,
        s.currency
      )
      if (success) {
        loadAllDetails()
      }
    }
  }

  const triggerSettleUp = (debt: DebtTransfer) => {
    setSettlePayerId(debt.fromId)
    setSettlePayeeId(debt.toId)
    setSettleAmount(debt.amount)
    setSettleCurrency(debt.currency)
    setShowSettleModal(true)
  }

  const renderGroupPool = () => {
    const poolTotals: Record<string, number> = {}
    expenses.forEach(e => {
      poolTotals[e.currency] = (poolTotals[e.currency] || 0) + e.amount
    })

    const currencies = Object.keys(poolTotals)
    if (currencies.length === 0) return '0.00'

    return currencies
      .map(cur => formatCurrency(poolTotals[cur], cur))
      .join(' & ')
  }

  const renderNetShare = () => {
    const active = Object.entries(userBalances).filter(([_, val]) => Math.abs(val) > 0.005)
    if (active.length === 0) return 'Settled'

    return active
      .map(([cur, val]) => {
        const sign = val > 0 ? '+' : ''
        return `${sign}${formatCurrency(val, cur)}`
      })
      .join(' & ')
  }

  const isNetOwed = Object.values(userBalances).some(val => val > 0.005)

  if (groupLoading && !group) {
    return (
      <div className="glass-panel rounded-3xl p-12 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{group?.name}</h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
              Premium Ledger Registry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setExpenseToEdit(null)
              setShowExpenseModal(true)
            }}
            className="bg-accent-blue text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-accent-blue/90 transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-accent-blue/10"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl">
          <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">Group Pool Balance</span>
          <span className="text-2xl font-bold text-white mt-1 truncate block">{renderGroupPool()}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl">
          <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">Your Net Share</span>
          <span
            className={`text-2xl font-bold mt-1 truncate block ${
              isNetOwed ? 'text-accent-green' : 'text-accent-blue'
            }`}
          >
            {renderNetShare()}
          </span>
        </div>
        <div className="glass-panel p-5 rounded-2xl">
          <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">Stability index</span>
          <span className="text-2xl font-bold text-accent-green mt-1">98.2%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Expense/Repayments ledger */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-5 rounded-3xl">
            {/* Tab switchers */}
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
              <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`py-1.5 px-3 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'expenses' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Expense Ledger
                </button>
                <button
                  onClick={() => setActiveTab('settlements')}
                  className={`py-1.5 px-3 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'settlements' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Repayments Log
                </button>
              </div>

              <span className="text-xs text-slate-500">
                {activeTab === 'expenses' ? `${expenses.length} entries` : `${settlements.length} settles`}
              </span>
            </div>

            {/* List views */}
            {activeTab === 'expenses' ? (
              expensesLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader className="w-6 h-6 animate-spin text-accent-blue" />
                </div>
              ) : expenses.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No expenses logged. Click Add Expense.</p>
              ) : (
                <div className="space-y-3">
                  {expenses.map(exp => {
                    const isPayer = exp.paid_by === user?.id
                    const userSplit = exp.splits?.find(s => s.profile_id === user?.id)
                    const splitVal = userSplit ? userSplit.amount : 0

                    return (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group/item"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white">{exp.title}</h4>
                            <p className="text-xs text-slate-400">
                              Paid by <span className="text-slate-200">{exp.payer?.name}</span> • Split{' '}
                              {exp.splits?.length || 0} ways
                            </p>
                            {exp.notes && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5 max-w-[200px] truncate">
                                "{exp.notes}"
                              </p>
                            )}
                            {exp.receipt_url && (
                              <a
                                href={exp.receipt_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-accent-blue hover:underline inline-flex items-center gap-0.5 mt-0.5"
                              >
                                <span>View receipt document</span>
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-sm font-semibold text-white block">
                              {formatCurrency(exp.amount, exp.currency)}
                            </span>
                            <span className={`text-[10px] ${isPayer ? 'text-accent-green' : 'text-slate-400'}`}>
                              {isPayer
                                ? `You get: ${formatCurrency(exp.amount - splitVal, exp.currency)}`
                                : `Your share: ${formatCurrency(splitVal, exp.currency)}`}
                            </span>
                          </div>

                          <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setExpenseToEdit(exp)
                                setShowExpenseModal(true)
                              }}
                              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                              title="Edit expense"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              className="p-1.5 bg-white/5 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400"
                              title="Delete expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : settleLoading ? (
              <div className="py-8 flex items-center justify-center">
                <Loader className="w-6 h-6 animate-spin text-accent-blue" />
              </div>
            ) : settlements.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No repayment logs found.</p>
            ) : (
              <div className="space-y-3">
                {settlements.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group/item"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent-green/10 text-accent-green flex items-center justify-center shrink-0">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Repayment Settlement</h4>
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-200">{s.payer?.name}</span> paid{' '}
                          <span className="text-slate-200">{s.payee?.name}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(s.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-accent-green">
                        {formatCurrency(s.amount, s.currency)}
                      </span>

                      {/* delete settlement */}
                      <button
                        onClick={() => handleDeleteSettlement(s)}
                        className="p-1.5 opacity-0 group-hover/item:opacity-100 bg-white/5 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400 transition-all shrink-0"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column - Space Members, Settlements logic, and activity */}
        <div className="space-y-4">
          {/* Members list & Invite panel */}
          <div className="glass-panel p-5 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Space Members</h3>

            <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
              {group?.members?.map(member => {
                // Total user net balance across currencies inside this group
                const activeBalances = Object.entries(userBalances).filter(([_, val]) => Math.abs(val) > 0.005)
                const isCurrent = member.id === user?.id

                // Calculate this specific member's balance in USD or other currencies
                // Let's compute this dynamically
                const memberBals: Record<string, number> = {}
                expenses.forEach(e => {
                  if (e.paid_by === member.id) {
                    memberBals[e.currency] = (memberBals[e.currency] || 0) + e.amount
                  }
                  const split = e.splits?.find(s => s.profile_id === member.id)
                  if (split) {
                    memberBals[e.currency] = (memberBals[e.currency] || 0) - split.amount
                  }
                })

                settlements.forEach(s => {
                  if (s.payer_id === member.id) {
                    memberBals[s.currency] = (memberBals[s.currency] || 0) + s.amount
                  }
                  if (s.payee_id === member.id) {
                    memberBals[s.currency] = (memberBals[s.currency] || 0) - s.amount
                  }
                })

                const memberActiveBals = Object.entries(memberBals)
                  .map(([cur, val]) => {
                    const rounded = Math.round(val * 100) / 100
                    if (Math.abs(rounded) < 0.005) return null
                    const sign = rounded > 0 ? '+' : ''
                    return `${sign}${formatCurrency(rounded, cur)}`
                  })
                  .filter(Boolean)

                return (
                  <div key={member.id} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 max-w-[150px]">
                      <div className="w-7 h-7 rounded-full bg-accent-blue/20 flex items-center justify-center text-xs text-white border border-accent-blue/30 shrink-0 font-bold uppercase">
                        {member.name.substring(0, 2)}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-white block truncate">
                          {member.name} {isCurrent && '(You)'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">@{member.username}</span>
                      </div>
                    </div>

                    <span className="font-mono text-slate-400 text-right">
                      {memberActiveBals.length > 0 ? memberActiveBals.join(', ') : 'Settled'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Invite Form */}
            <form onSubmit={handleAddMember} className="pt-2 border-t border-white/5 space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Add member by Public ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newMemberPublicId}
                  onChange={e => setNewMemberPublicId(e.target.value)}
                  className="flex-1 glass-input rounded-xl px-3 py-2 text-xs focus:outline-none placeholder-slate-600 font-mono"
                  placeholder="SID-XXXXXX"
                />
                <button
                  type="submit"
                  disabled={addingMember}
                  className="bg-white/10 hover:bg-white/20 px-3 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 shrink-0 flex items-center justify-center"
                >
                  {addingMember ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
                </button>
              </div>

              {memberError && (
                <p className="text-[10px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {memberError}
                </p>
              )}
              {memberSuccess && (
                <p className="text-[10px] text-accent-green">Member added to the ledger space.</p>
              )}
            </form>
          </div>

          {/* Settle debts panel */}
          <div className="glass-panel p-5 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Ledger Balances (Simplified)</h3>

            {simplifiedDebts.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">All balances settled. No debt transfers required.</p>
            ) : (
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                {simplifiedDebts.map((debt, idx) => {
                  const involved = debt.fromId === user?.id || debt.toId === user?.id
                  const youOwe = debt.fromId === user?.id

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col p-2.5 rounded-xl border border-white/5 bg-white/5 space-y-2 ${
                        involved ? 'border-accent-blue/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="text-slate-300">
                          <span className="font-semibold text-white">
                            {debt.fromId === user?.id ? 'You' : debt.fromName}
                          </span>{' '}
                          owes{' '}
                          <span className="font-semibold text-white">
                            {debt.toId === user?.id ? 'You' : debt.toName}
                          </span>
                        </div>
                        <span className="font-bold text-white">
                          {formatCurrency(debt.amount, debt.currency)}
                        </span>
                      </div>

                      {involved && (
                        <button
                          onClick={() => triggerSettleUp(debt)}
                          className="w-full py-1 px-3 bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue rounded-lg text-[10px] font-semibold transition-all active:scale-95 text-center block"
                        >
                          {youOwe ? 'Record Repayment Sent' : 'Record Repayment Received'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Group Activity feed */}
          <div className="glass-panel p-5 rounded-3xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Activity Log</h3>
              <History className="w-4 h-4 text-slate-500" />
            </div>

            {activityLogs.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2">No activity recorded.</p>
            ) : (
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                {activityLogs.slice(0, 5).map(log => (
                  <div key={log.id} className="border-l border-white/10 pl-2.5 py-0.5 text-[11px]">
                    <p className="text-slate-300 leading-normal">{log.description}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {formatRelativeTime(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Modal */}
      <AddExpenseModal
        isOpen={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false)
          setExpenseToEdit(null)
        }}
        groupId={groupId}
        members={group?.members || []}
        expenseToEdit={expenseToEdit}
        onSave={loadAllDetails}
      />

      {/* Settle Repayment Modal */}
      <SettleModal
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        groupId={groupId}
        members={group?.members || []}
        defaultPayerId={settlePayerId}
        defaultPayeeId={settlePayeeId}
        defaultAmount={settleAmount}
        defaultCurrency={settleCurrency}
        onSave={loadAllDetails}
      />
    </div>
  )
}
