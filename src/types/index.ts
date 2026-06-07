import { Database } from './database.types'

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type GroupRow = Database['public']['Tables']['groups']['Row']
export type GroupMemberRow = Database['public']['Tables']['group_members']['Row']
export type ExpenseRow = Database['public']['Tables']['expenses']['Row']
export type ExpenseSplitRow = Database['public']['Tables']['expense_splits']['Row']
export type SettlementRow = Database['public']['Tables']['settlements']['Row']
export type ActivityLogRow = Database['public']['Tables']['activity_logs']['Row']

export interface Profile {
  id: string
  name: string
  email: string
  username: string
  public_id: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  name: string
  description: string | null
  is_archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  members?: Profile[]
  _count?: {
    group_members: number
  }
}

export interface GroupMember {
  group_id: string
  profile_id: string
  joined_at: string
  profile: Profile
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  profile_id: string
  amount: number
  percentage: number | null
  profile?: Profile
}

export interface Expense {
  id: string
  group_id: string
  title: string
  amount: number
  currency: string
  paid_by: string
  notes: string | null
  receipt_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  payer?: Profile
  splits?: ExpenseSplit[]
}

export interface Settlement {
  id: string
  group_id: string
  payer_id: string
  payee_id: string
  amount: number
  currency: string
  created_by: string | null
  created_at: string
  updated_at: string
  payer?: Profile
  payee?: Profile
}

export interface ActivityLog {
  id: string
  group_id: string
  actor_id: string | null
  action_type: string
  description: string
  metadata: any
  created_at: string
  actor?: Profile
}

export interface DebtTransfer {
  fromId: string
  fromName: string
  fromUsername: string
  toId: string
  toName: string
  toUsername: string
  amount: number
  currency: string
}

export interface BalanceSummary {
  profileId: string
  name: string
  username: string
  publicId: string
  netBalance: number
  currencyBalances: Record<string, number>
}
