import React, { useEffect, useState } from 'react'
import { Loader, Activity as ActivityIcon, RefreshCw } from 'lucide-react'
import { useSettlements } from '../hooks/useSettlements'
import { ActivityLog } from '../types'
import { formatRelativeTime } from '../lib/utils'

export const Activity: React.FC = () => {
  const { fetchActivityLogs, loading } = useSettlements()
  const [logs, setLogs] = useState<ActivityLog[]>([])

  const loadLogs = async () => {
    const data = await fetchActivityLogs()
    setLogs(data)
  }

  useEffect(() => {
    loadLogs()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Global Activity Feed</h2>
          <p className="text-xs text-slate-400">Ledger audit log sync across all connected circles</p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
          title="Refresh Log Node"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-accent-blue" />
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-dashed border-white/10 flex flex-col items-center justify-center">
          <ActivityIcon className="w-8 h-8 text-slate-500 mb-2" />
          <p className="text-sm font-medium text-slate-300">No activities recorded yet</p>
          <p className="text-xs text-slate-500 mt-1">Actions in your sharing groups will appear in this feed.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Registry Logs
            </span>
            <span className="text-xs text-slate-500 font-mono">
              VERIFIED LEDGER // {logs.length} RECORDS
            </span>
          </div>

          <div className="space-y-4">
            {logs.map((log) => {
              const initials = log.actor?.name?.substring(0, 2).toUpperCase() || 'ID'
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 leading-normal font-medium">
                      {log.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">
                        {formatRelativeTime(log.created_at)}
                      </span>
                      <span className="text-[10px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">
                        {log.action_type}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
