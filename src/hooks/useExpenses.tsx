import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { Expense, ExpenseSplit } from '../types'

export const useExpenses = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchExpenses = async (groupId: string): Promise<Expense[]> => {
    if (!user) return []
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch expenses
      const { data: expensesData, error: expErr } = await supabase
        .from('expenses')
        .select('*, payer:profiles!expenses_paid_by_fkey(*)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })

      if (expErr) throw expErr

      // 2. Fetch all splits for these expenses
      const expenseIds = expensesData.map(e => e.id)
      if (expenseIds.length === 0) return []

      const { data: splitsData, error: splitsErr } = await supabase
        .from('expense_splits')
        .select('*, profile:profiles(*)')
        .in('expense_id', expenseIds)

      if (splitsErr) throw splitsErr

      // 3. Map splits to expenses
      const expensesList: Expense[] = (expensesData || []).map((exp: any) => {
        const splits = (splitsData || [])
          .filter((split: any) => split.expense_id === exp.id)
          .map((split: any) => ({
            id: split.id,
            expense_id: split.expense_id,
            profile_id: split.profile_id,
            amount: Number(split.amount),
            percentage: split.percentage ? Number(split.percentage) : null,
            profile: split.profile
          }))

        return {
          ...exp,
          amount: Number(exp.amount),
          payer: exp.payer,
          splits
        }
      })

      return expensesList
    } catch (e: any) {
      console.error('Error in fetchExpenses:', e)
      setError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!user) return null
    setLoading(true)
    setError(null)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}_receipt.${fileExt}`
      
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(fileName, file)

      if (uploadErr) throw uploadErr

      const { data } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName)

      return data.publicUrl
    } catch (e: any) {
      console.error('Error in uploadReceipt:', e)
      setError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const addExpense = async (
    groupId: string,
    title: string,
    amount: number,
    currency: string,
    paidBy: string,
    notes: string | null,
    receiptUrl: string | null,
    splits: { profileId: string; amount: number; percentage?: number }[]
  ): Promise<boolean> => {
    if (!user) return false
    setLoading(true)
    setError(null)
    try {
      // 1. Insert expense row
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          title,
          amount,
          currency,
          paid_by: paidBy,
          notes,
          receipt_url: receiptUrl,
          created_by: user.id
        })
        .select()
        .single()

      if (expErr) throw expErr

      // 2. Insert expense split rows
      const splitsPayload = splits.map(split => ({
        expense_id: expData.id,
        profile_id: split.profileId,
        amount: split.amount,
        percentage: split.percentage || null
      }))

      const { error: splitsErr } = await supabase
        .from('expense_splits')
        .insert(splitsPayload)

      if (splitsErr) throw splitsErr

      // 3. Log activity
      const formattedAmount = `${amount} ${currency}`
      await supabase.from('activity_logs').insert({
        group_id: groupId,
        actor_id: user.id,
        action_type: 'add_expense',
        description: `${user.name} added expense "${title}" of ${formattedAmount}`
      })

      return true
    } catch (e: any) {
      console.error('Error in addExpense:', e)
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const updateExpense = async (
    groupId: string,
    expenseId: string,
    title: string,
    amount: number,
    currency: string,
    paidBy: string,
    notes: string | null,
    receiptUrl: string | null,
    splits: { profileId: string; amount: number; percentage?: number }[]
  ): Promise<boolean> => {
    if (!user) return false
    setLoading(true)
    setError(null)
    try {
      // 1. Update expense row
      const { error: expErr } = await supabase
        .from('expenses')
        .update({
          title,
          amount,
          currency,
          paid_by: paidBy,
          notes,
          receipt_url: receiptUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', expenseId)

      if (expErr) throw expErr

      // 2. Delete old split rows
      const { error: deleteSplitsErr } = await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId)

      if (deleteSplitsErr) throw deleteSplitsErr

      // 3. Insert new split rows
      const splitsPayload = splits.map(split => ({
        expense_id: expenseId,
        profile_id: split.profileId,
        amount: split.amount,
        percentage: split.percentage || null
      }))

      const { error: splitsErr } = await supabase
        .from('expense_splits')
        .insert(splitsPayload)

      if (splitsErr) throw splitsErr

      // 4. Log activity
      const formattedAmount = `${amount} ${currency}`
      await supabase.from('activity_logs').insert({
        group_id: groupId,
        actor_id: user.id,
        action_type: 'edit_expense',
        description: `${user.name} updated expense "${title}" to ${formattedAmount}`
      })

      return true
    } catch (e: any) {
      console.error('Error in updateExpense:', e)
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteExpense = async (groupId: string, expenseId: string, title: string): Promise<boolean> => {
    if (!user) return false
    setLoading(true)
    setError(null)
    try {
      const { error: deleteErr } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)

      if (deleteErr) throw deleteErr

      // Log activity
      await supabase.from('activity_logs').insert({
        group_id: groupId,
        actor_id: user.id,
        action_type: 'delete_expense',
        description: `${user.name} deleted expense "${title}"`
      })

      return true
    } catch (e: any) {
      console.error('Error in deleteExpense:', e)
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    fetchExpenses,
    uploadReceipt,
    addExpense,
    updateExpense,
    deleteExpense
  }
}
