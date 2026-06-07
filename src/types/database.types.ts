export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          username: string
          public_id: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          username: string
          public_id?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          username?: string
          public_id?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          is_archived: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      group_members: {
        Row: {
          group_id: string
          profile_id: string
          joined_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          group_id: string
          profile_id: string
          joined_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          group_id?: string
          profile_id?: string
          joined_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      expenses: {
        Row: {
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
        }
        Insert: {
          id?: string
          group_id: string
          title: string
          amount: number
          currency?: string
          paid_by: string
          notes?: string | null
          receipt_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          title?: string
          amount?: number
          currency?: string
          paid_by?: string
          notes?: string | null
          receipt_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      expense_splits: {
        Row: {
          id: string
          expense_id: string
          profile_id: string
          amount: number
          percentage: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          expense_id: string
          profile_id: string
          amount: number
          percentage?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          expense_id?: string
          profile_id?: string
          amount?: number
          percentage?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      settlements: {
        Row: {
          id: string
          group_id: string
          payer_id: string
          payee_id: string
          amount: number
          currency: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          payer_id: string
          payee_id: string
          amount: number
          currency?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          payer_id?: string
          payee_id?: string
          amount?: number
          currency?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          group_id: string
          actor_id: string | null
          action_type: string
          description: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          actor_id?: string | null
          action_type: string
          description: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          actor_id?: string | null
          action_type?: string
          description?: string
          metadata?: Json | null
          created_at?: string
        }
      }
    }
  }
}
