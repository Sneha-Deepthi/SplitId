import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { Settlement, ActivityLog } from '../types'

export const useSettlements = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSettlements = async (groupId: string): Promise<Settlement[]> => {
    if (!user) return []
    setLoading(true)
    setError(null)
    try {
      const { data, error: settleErr } = await supabase
        .from('settlements')
        .select('*, payer:profiles!settlements_payer_id_fkey(*), payee:profiles!settlements_payee_id_fkey(*)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })

      if (settleErr) throw settleErr

      return (data || []).map((s: any) => ({
        ...s,
        amount: Number(s.amount),
        payer: s.payer,
        payee: s.payee
      }))
    } catch (e: any) {
      console.error('Error in fetchSettlements:', e)
      setError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }

  const recordSettlement = async (
    groupId: string,
    payerId: string,
    payeeId: string,
    amount: number,
    currency: string
  ): Promise<boolean> => {
    if (!user) return false
    setLoading(true)
    setError(null)
    try {
      const { data: settleData, error: settleErr } = await supabase
        .from('settlements')
        .insert({
          group_id: groupId,
          payer_id: payerId,
          payee_id: payeeId,
          amount,
          currency,
          created_by: user.id
        })
        .select('*, payer:profiles!settlements_payer_id_fkey(*), payee:profiles!settlements_payee_id_fkey(*)')
        .single()

      if (settleErr) throw settleErr

      // Log activity
      const formattedAmount = `${amount} ${currency}`
      await supabase.from('activity_logs').insert({
        group_id: groupId,
        actor_id: user.id,
        action_type: 'settle',
        description: `${settleData.payer?.name || 'User'} settled ${formattedAmount} to ${settleData.payee?.name || 'User'}`
      })

      return true
    } catch (e: any) {
      console.error('Error in recordSettlement:', e)
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteSettlement = async (
    groupId: string,
    settlementId: string,
    payerName: string,
    payeeName: string,
    amount: number,
    currency: string
  ): Promise<boolean> => {
    if (!user) return false
    setLoading(true)
    setError(null)
    try {
      const { error: deleteErr } = await supabase
        .from('settlements')
        .delete()
        .eq('id', settlementId)

      if (deleteErr) throw deleteErr

      // Log activity
      const formattedAmount = `${amount} ${currency}`
      await supabase.from('activity_logs').insert({
        group_id: groupId,
        actor_id: user.id,
        action_type: 'delete_settlement',
        description: `${user.name} deleted the settlement of ${formattedAmount} from ${payerName} to ${payeeName}`
      })

      return true
    } catch (e: any) {
      console.error('Error in deleteSettlement:', e)
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const fetchActivityLogs = async (groupId?: string): Promise<ActivityLog[]> => {
    if (!user) return []
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('activity_logs')
        .select('*, actor:profiles(*)')
        .order('created_at', { ascending: false })

      if (groupId) {
        query = query.eq('group_id', groupId)
      } else {
        // Fetch global activity logs where user is member of the group
        const { data: memberRows, error: memberErr } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('profile_id', user.id)

        if (memberErr) throw memberErr
        if (!memberRows || memberRows.length === 0) return []

        const groupIds = memberRows.map(row => row.group_id)
        query = query.in('group_id', groupIds)
      }

      const { data, error: logsErr } = await query

      if (logsErr) throw logsErr

      return data as ActivityLog[]
    } catch (e: any) {
      console.error('Error in fetchActivityLogs:', e)
      setError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    fetchSettlements,
    recordSettlement,
    deleteSettlement,
    fetchActivityLogs
  }
}
