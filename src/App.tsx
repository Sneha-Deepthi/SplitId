import React, { useState } from 'react'
import { LayoutDashboard, Users, Activity as ActivityIcon, User, LogOut, Wallet, Plus } from 'lucide-react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Auth } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { Groups } from './pages/Groups'
import { GroupDetail } from './pages/GroupDetail'
import { Activity } from './pages/Activity'
import { Profile } from './pages/Profile'

type ViewState = 'dashboard' | 'groups' | 'group-detail' | 'activity' | 'profile'

const AppContent: React.FC = () => {
  const { user, signOut, loading } = useAuth()
  
  // SPA Router State
  const [view, setView] = useState<ViewState>('dashboard')
  const [viewParams, setViewParams] = useState<any>({})

  const handleNavigate = (targetView: string, params: any = {}) => {
    setView(targetView as ViewState)
    setViewParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-tr from-accent-blue to-accent-green rounded-xl flex items-center justify-center shadow-lg shadow-accent-blue/20 animate-pulse">
          <Wallet className="text-slate-900 w-5 h-5 stroke-[2.5]" />
        </div>
        <span className="text-xs text-slate-400 font-medium animate-pulse uppercase tracking-wider">
          Syncing secure ledger nodes...
        </span>
      </div>
    )
  }

  // Redirect to Auth if not logged in
  if (!user) {
    return <Auth />
  }

  return (
    <div className="flex flex-col min-h-screen justify-between">
      {/* App Main Shell */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mb-20 md:mb-6">
        
        {/* Header bar */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigate('dashboard')}>
            <div className="w-10 h-10 bg-gradient-to-tr from-accent-blue to-accent-green rounded-xl flex items-center justify-center shadow-md shadow-accent-blue/10">
              <Wallet className="text-slate-900 w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">SplitID</span>
          </div>

          {/* Quick add expense button context-aware */}
          {view === 'group-detail' && (
            <button
              onClick={() => {
                // Dispatches a custom event to open the expense modal inside GroupDetail
                const event = new CustomEvent('open-add-expense-modal')
                window.dispatchEvent(event)
              }}
              className="bg-gradient-to-r from-accent-blue to-accent-blue/80 hover:from-accent-blue hover:to-accent-blue text-slate-950 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-accent-blue/10 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Expense</span>
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Desktop Sidebar Navigation */}
          <aside className="hidden lg:flex flex-col gap-2 glass-panel p-4 rounded-3xl col-span-1">
            <p className="px-4 text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-2">
              Navigation
            </p>
            
            <button
              onClick={() => handleNavigate('dashboard')}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                view === 'dashboard'
                  ? 'text-accent-blue bg-white/5 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleNavigate('groups')}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                view === 'groups' || view === 'group-detail'
                  ? 'text-accent-blue bg-white/5 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Groups</span>
            </button>

            <button
              onClick={() => handleNavigate('activity')}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                view === 'activity'
                  ? 'text-accent-blue bg-white/5 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ActivityIcon className="w-4 h-4" />
              <span>Activity</span>
            </button>

            <button
              onClick={() => handleNavigate('profile')}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                view === 'profile'
                  ? 'text-accent-blue bg-white/5 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>

            <hr className="border-white/5 my-2" />
            
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </aside>

          {/* Router Content Outlet */}
          <main className="col-span-1 lg:col-span-3 space-y-6">
            {view === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
            {view === 'groups' && <Groups onNavigate={handleNavigate} />}
            {view === 'group-detail' && (
              <GroupDetail groupId={viewParams.groupId} onNavigate={handleNavigate} />
            )}
            {view === 'activity' && <Activity />}
            {view === 'profile' && <Profile />}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 glass-panel md:hidden z-40 border-t border-white/10 rounded-t-3xl px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => handleNavigate('dashboard')}
          className={`flex flex-col items-center gap-1 ${
            view === 'dashboard' ? 'text-accent-blue' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium font-sans">Home</span>
        </button>

        <button
          onClick={() => handleNavigate('groups')}
          className={`flex flex-col items-center gap-1 ${
            view === 'groups' || view === 'group-detail' ? 'text-accent-blue' : 'text-slate-400'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium font-sans">Groups</span>
        </button>

        <button
          onClick={() => handleNavigate('activity')}
          className={`flex flex-col items-center gap-1 ${
            view === 'activity' ? 'text-accent-blue' : 'text-slate-400'
          }`}
        >
          <ActivityIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium font-sans">Activity</span>
        </button>

        <button
          onClick={() => handleNavigate('profile')}
          className={`flex flex-col items-center gap-1 ${
            view === 'profile' ? 'text-accent-blue' : 'text-slate-400'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium font-sans">Profile</span>
        </button>
      </nav>

      {/* Footer bar */}
      <footer className="w-full text-center py-4 text-[11px] text-slate-600 font-mono tracking-wider">
        SPLITID LEDGER MODULE // VER 4.26 // PROTECTED CORE
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
