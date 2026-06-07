import React, { useEffect, useState } from 'react'
import { ChevronRight, Loader, Archive, Edit2, RotateCcw, AlertTriangle } from 'lucide-react'
import { useGroups } from '../hooks/useGroups'
import { Group } from '../types'

interface GroupsProps {
  onNavigate: (page: string, params?: any) => void
}

export const Groups: React.FC<GroupsProps> = ({ onNavigate }) => {
  const { fetchGroups, updateGroup, toggleArchiveGroup, loading } = useGroups()
  
  const [activeGroups, setActiveGroups] = useState<Group[]>([])
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([])
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active')

  // Edit Group states
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Archive modal states
  const [archivingGroup, setArchivingGroup] = useState<Group | null>(null)

  const loadGroups = async () => {
    const active = await fetchGroups(false)
    const archived = await fetchGroups(true)
    
    setActiveGroups(active)
    
    // Filter out active from the second query to get archived
    const onlyArchived = archived.filter(g => g.is_archived)
    setArchivedGroups(onlyArchived)
  }

  useEffect(() => {
    loadGroups()
  }, [])

  const handleEditInit = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingGroup(group)
    setEditName(group.name)
    setEditDesc(group.description || '')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGroup || !editName.trim()) return

    setSaving(true)
    const success = await updateGroup(editingGroup.id, editName.trim(), editDesc.trim() || null)
    setSaving(false)

    if (success) {
      setEditingGroup(null)
      loadGroups()
    }
  }

  const handleArchiveToggle = async (group: Group, state: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    const success = await toggleArchiveGroup(group.id, state)
    if (success) {
      setArchivingGroup(null)
      loadGroups()
    }
  }

  const groupsList = viewTab === 'active' ? activeGroups : archivedGroups

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">All Connected Spaces</h2>
          <p className="text-xs text-slate-400">View and manage your sharing registries</p>
        </div>
        
        {/* Toggle active / archived views */}
        <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 self-start">
          <button
            onClick={() => setViewTab('active')}
            className={`py-1.5 px-4 text-xs font-medium rounded-lg transition-all ${
              viewTab === 'active' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Active ({activeGroups.length})
          </button>
          <button
            onClick={() => setViewTab('archived')}
            className={`py-1.5 px-4 text-xs font-medium rounded-lg transition-all ${
              viewTab === 'archived' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Archived ({archivedGroups.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel rounded-3xl p-12 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-accent-blue" />
        </div>
      ) : groupsList.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-dashed border-white/10 flex flex-col items-center justify-center">
          <Archive className="w-8 h-8 text-slate-500 mb-2" />
          <p className="text-sm font-medium text-slate-300">
            No {viewTab === 'active' ? 'active' : 'archived'} spaces
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {viewTab === 'active'
              ? 'Click Create Space on your dashboard to start.'
              : 'Archived groups will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupsList.map(group => (
            <div
              key={group.id}
              onClick={() => onNavigate('group-detail', { groupId: group.id })}
              className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent-blue/10 text-accent-blue rounded-xl flex items-center justify-center font-bold text-lg">
                  {group.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-[300px]">
                    {group.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px] sm:max-w-[400px]">
                    {group.description || 'No description provided'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Created {new Date(group.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                {/* Actions */}
                {viewTab === 'active' ? (
                  <>
                    <button
                      onClick={(e) => handleEditInit(group, e)}
                      className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all"
                      title="Edit details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setArchivingGroup(group)
                      }}
                      className="p-2 bg-white/5 hover:bg-rose-500/10 border border-white/5 rounded-xl text-slate-400 hover:text-rose-400 transition-all"
                      title="Archive space"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => handleArchiveToggle(group, false, e)}
                    className="flex items-center gap-1 text-xs bg-white/5 hover:bg-accent-green/20 border border-white/5 px-3 py-2 rounded-xl text-slate-300 hover:text-accent-green font-medium transition-all"
                    title="Restore space"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                )}

                <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Group details modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 md:p-8 transform scale-100 transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white tracking-tight">Edit Space Metadata</h3>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Space Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
                  placeholder="e.g., Iceland Trip 2026"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:outline-none"
                  placeholder="e.g., Rent and utilities"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  disabled={saving}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-gradient-to-r from-accent-blue to-accent-blue/80 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-accent-blue/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {saving && <Loader className="w-4 h-4 animate-spin" />}
                  <span>Commit Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation modal */}
      {archivingGroup && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 md:p-8 transform scale-100 transition-all text-center">
            <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white tracking-tight mb-2">Archive sharing space?</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Are you sure you want to archive <strong>"{archivingGroup.name}"</strong>?
              This hides it from your active dashboard. You can restore it anytime from the archived tab.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setArchivingGroup(null)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleArchiveToggle(archivingGroup, true, e)}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/10 active:scale-95 transition-all"
              >
                Archive Space
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
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
