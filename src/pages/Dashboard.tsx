import React, { useEffect, useState } from 'react'
import { Copy, Plus, Loader, Archive } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroups'
import { useExpenses } from '../hooks/useExpenses'
import { useSettlements } from '../hooks/useSettlements'
import { Group } from '../types'
import { formatCurrency } from '../lib/utils'

interface GroupWithBalances extends Group {
  userBalances: Record<string, number>
}

interface DashboardProps {
  onNavigate: (page: string, params?: any) => void
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth()
  const { fetchGroups, createGroup, loading: groupsLoading } = useGroups()
  const { fetchExpenses } = useExpenses()
  const { fetchSettlements } = useSettlements()

  const [groups, setGroups] = useState<GroupWithBalances[]>([])
  const [totalOwed, setTotalOwed] = useState<Record<string, number>>({})
  const [totalOwe, setTotalOwe] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState(false)
  
  // Group creation state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const loadDashboardData = async () => {
    if (!user) return
    const activeGroups = await fetchGroups(false)
    const groupsWithBalances: GroupWithBalances[] = []

    const tempOwed: Record<string, number> = {}
    const tempOwe: Record<string, number> = {}

    for (const group of activeGroups) {
      // Fetch expenses & settlements to calculate current user's balance
      const expenses = await fetchExpenses(group.id)
      const settlements = await fetchSettlements(group.id)

      const userBalances: Record<string, number> = {}

      // Add paid expenses
      expenses.forEach(exp => {
        const currency = exp.currency
        if (!userBalances[currency]) userBalances[currency] = 0

        if (exp.paid_by === user.id) {
          userBalances[currency] += exp.amount
        }

        const userSplit = exp.splits?.find(s => s.profile_id === user.id)
        if (userSplit) {
          userBalances[currency] -= userSplit.amount
        }
      })

      // Adjust settlements
      settlements.forEach(settle => {
        const currency = settle.currency
        if (!userBalances[currency]) userBalances[currency] = 0

        if (settle.payer_id === user.id) {
          userBalances[currency] += settle.amount
        }
        if (settle.payee_id === user.id) {
          userBalances[currency] -= settle.amount
        }
      })

      // Round balances
      Object.keys(userBalances).forEach(cur => {
        userBalances[cur] = Math.round(userBalances[cur] * 100) / 100
        
        const bal = userBalances[cur]
        if (bal > 0.005) {
          tempOwed[cur] = (tempOwed[cur] || 0) + bal
        } else if (bal < -0.005) {
          tempOwe[cur] = (tempOwe[cur] || 0) + Math.abs(bal)
        }
      })

      groupsWithBalances.push({
        ...group,
        userBalances
      })
    }

    setGroups(groupsWithBalances)
    setTotalOwed(tempOwed)
    setTotalOwe(tempOwe)
  }

  useEffect(() => {
    loadDashboardData()
  }, [user])

  const handleCopyId = () => {
    if (!user) return
    navigator.clipboard.writeText(user.public_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    setCreating(true)
    const group = await createGroup(newGroupName.trim(), newGroupDesc.trim() || null)
    setCreating(false)

    if (group) {
      setNewGroupName('')
      setNewGroupDesc('')
      setShowCreateModal(false)
      loadDashboardData()
      // Go to group detail
      onNavigate('group-detail', { groupId: group.id })
    }
  }

  const renderBalanceText = (balances: Record<string, number>) => {
    const activeBalances = Object.entries(balances).filter(([_, val]) => Math.abs(val) > 0.005)
    if (activeBalances.length === 0) return 'Settled'

    return activeBalances
      .map(([currency, val]) => formatCurrency(val, currency))
      .join(' & ')
  }

  const renderGroupStatus = (group: GroupWithBalances) => {
    const activeBalances = Object.entries(group.userBalances).filter(([_, val]) => Math.abs(val) > 0.005)
    if (activeBalances.length === 0) {
      return <span className="text-xs text-slate-400">Settled</span>
    }

    const items = activeBalances.map(([currency, val]) => {
      if (val > 0) {
        return (
          <span key={currency} className="text-xs font-semibold text-accent-green block">
            You are owed {formatCurrency(val, currency)}
          </span>
        )
      } else {
        return (
          <span key={currency} className="text-xs font-semibold text-accent-blue block">
            You owe {formatCurrency(Math.abs(val), currency)}
          </span>
        )
      }
    })

    return <div className="text-right">{items}</div>
  }

  const isUserOwed = Object.values(totalOwed).some(val => val > 0.005)
  const isUserOwe = Object.values(totalOwe).some(val => val > 0.005)

  return (
    <div className="space-y-6">
      {/* Top Banner stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* User Card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between min-h-[140px]">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Welcome Back</span>
            <h2 className="text-2xl font-bold text-white mt-1">{user?.name}</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">@{user?.username}</p>
          </div>
          <div className="mt-4 flex items-center justify-between bg-black/20 px-3 py-2 rounded-xl border border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Public Routing ID</span>
              <span className="text-xs font-mono text-accent-blue font-medium">{user?.public_id}</span>
            </div>
            <button
              onClick={handleCopyId}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Copy Public ID"
            >
              {copied ? (
                <span className="text-[10px] text-accent-green font-sans font-medium">Copied!</span>
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* You Are Owed card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-accent-green/5 rounded-full blur-2xl pointer-events-none group-hover:bg-accent-green/10 transition-all"></div>
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full bg-accent-green ${isUserOwed ? 'animate-pulse' : ''}`}></span>
              You are owed
            </span>
            <h2 className="text-3xl font-bold text-accent-green mt-2 truncate">
              {isUserOwed ? renderBalanceText(totalOwed) : '$0.00'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-4">Across active sharing circles</p>
        </div>

        {/* You Owe card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-accent-blue/5 rounded-full blur-2xl pointer-events-none group-hover:bg-accent-blue/10 transition-all"></div>
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-blue"></span>
              You owe
            </span>
            <h2 className="text-3xl font-bold text-accent-blue mt-2 truncate">
              {isUserOwe ? renderBalanceText(totalOwe) : '$0.00'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-4">Repayments due</p>
        </div>
      </div>

      {/* Active spaces section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white tracking-tight">Active Spaces / Groups</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Space</span>
            </button>
            <span className="text-xs text-slate-400">{groups.length} Total</span>
          </div>
        </div>

        {groupsLoading ? (
          <div className="glass-panel rounded-3xl p-12 flex items-center justify-center">
            <Loader className="w-8 h-8 animate-spin text-accent-blue" />
          </div>
        ) : groups.length === 0 ? (
          <div className="glass-panel rounded-3xl p-10 text-center flex flex-col items-center justify-center border border-dashed border-white/10">
            <Archive className="w-8 h-8 text-slate-500 mb-2" />
            <p className="text-sm font-medium text-slate-300">No active sharing spaces</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">Create a space to split expenses with friends</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-accent-blue text-slate-950 text-xs font-bold px-4 py-2 rounded-xl hover:bg-accent-blue/90 transition-all active:scale-95"
            >
              Create New Space
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div
                key={group.id}
                onClick={() => onNavigate('group-detail', { groupId: group.id })}
                className="glass-card rounded-2xl p-5 cursor-pointer flex flex-col justify-between min-h-[160px]"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-white truncate max-w-[170px] hover:text-accent-blue transition-colors">
                      {group.name}
                    </h4>
                    <span className="text-[10px] bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-medium px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 truncate max-w-[220px]">
                    {group._count?.group_members} members {group.description ? `• ${group.description}` : ''}
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Status</span>
                  {renderGroupStatus(group)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Network Integrity Info Box */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Network Integrity Sync
          </span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green"></span>
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          SplitID nodes are fully sync\'d with the premium ledger network. Transactions and settlements are protected using row-level policies. Search is indexed via immutable public SIDs.
        </p>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 md:p-8 transform scale-100 transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white tracking-tight">Create Sharing Space</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Space / Group Name</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
                  placeholder="e.g., Iceland Trip 2026, Apartment 4B"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Description (Optional)</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={e => setNewGroupDesc(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
                  placeholder="e.g., Travel plans, Rent and utilities"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-gradient-to-r from-accent-blue to-accent-blue/80 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-accent-blue/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {creating && <Loader className="w-4 h-4 animate-spin" />}
                  <span>Initialize Ledger</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline Close Icon helper for modal
const X: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)
