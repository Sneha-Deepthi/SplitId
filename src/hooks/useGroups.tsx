import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { Group, Profile } from '../types'

export const useGroups = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGroups = async (includeArchived = false): Promise<Group[]> => {
    if (!user) return []
    setLoading(true)
    setError(null)
    try {
      // Get all group IDs this user belongs to
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('profile_id', user.id)

      if (memberErr) throw memberErr
      if (!memberRows || memberRows.length === 0) return []

      const groupIds = memberRows.map(row => row.group_id)

      // Query the actual groups details
      let query = supabase
        .from('groups')
        .select('*, group_members(profile_id)')
        .in('id', groupIds)

      if (!includeArchived) {
        query = query.eq('is_archived', false)
      }

      const { data: groupsData, error: groupsErr } = await query

      if (groupsErr) throw groupsErr

      // Format count of members
      const groupsList: Group[] = groupsData.map((g: any) => ({
        ...g,
        _count: {
          group_members: g.group_members?.length || 0
        }
      }))

      return groupsList
    } catch (e: any) {
      console.error('Error in fetchGroups:', e)
      setError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }

  const fetchGroupDetail = async (groupId: string): Promise<Group | null> => {
    if (!user) return null
    setLoading(true)
    setError(null)
    try {
      // 1. Get Group details
      const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (groupErr) throw groupErr

      // 2. Get Group members (profiles)
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members')
        .select('joined_at, profiles(*)')
        .eq('group_id', groupId)

      if (memberErr) throw memberErr

      const members: Profile[] = memberRows
        .map((m: any) => m.profiles)
        .filter(Boolean)

      return {
        ...groupData,
        members
      } as Group
    } catch (e: any) {
      console.error('Error in fetchGroupDetail:', e)
      setError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const createGroup = async (name: string, description: string | null): Promise<any> => {
    if (!user) return null
    setLoading(true)
    setError(null)
    try {
      // 1. Create the group
      const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .insert({
          name,
          description,
          created_by: user.id
        })
        .select()
        .single()

      if (groupErr) throw groupErr

      // 2. Add creator as first member
      const { error: memberErr } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          profile_id: user.id
        })

      if (memberErr) throw memberErr

      // 3. Log activity
      await supabase.from('activity_logs').insert({
        group_id: groupData.id,
        actor_id: user.id,
        action_type: 'create_group',
        description: `${user.name} created group "${name}"`
      })

      return groupData
    } catch (e: any) {
      console.error('Error in createGroup:', e)
      setError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const updateGroup = async (groupId: string, name: string, description: string | null): Promise<boolean> => {
    if (!user) return false
    setLoading(true)
    setError(null)
    try {
      const { error: groupErr } = await supabase
        .from('groups')
        .update({
          name,
          description,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId)

      if (groupErr) throw groupErr

      // Log activity
      await supabase.from('activity_logs').insert({
        group_id: groupId,
        actor_id: user.id,
        action_type: 'edit_group',
        description: `${user.name} updated group details`
      })

      return true
    } catch (e: any) {
      console.error('Error in updateGroup:', e)
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const toggleArchiveGroup = async (groupId: string, isArchived: boolean): Promise<boolean> => {
    if (!user) return false
    setLoading(true)
    setError(null)
    try {
      const { error: groupErr } = await supabase
        .from('groups')
        .update({
          is_archived: isArchived,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId)

      if (groupErr) throw groupErr

      // Log activity
      await supabase.from('activity_logs').insert({
        group_id: groupId,
        actor_id: user.id,
        action_type: isArchived ? 'archive_group' : 'unarchive_group',
        description: `${user.name} ${isArchived ? 'archived' : 'restored'} this group`
      })

      return true
    } catch (e: any) {
      console.error('Error in toggleArchiveGroup:', e)
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const addMemberByPublicId = async (groupId: string, publicId: string): Promise<boolean> => {
    if (!user) return false
    setLoading(true)
    setError(null)
    try {
      // 1. Search for user profile with the given public_id
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('public_id', publicId.trim())
        .single()

      if (profileErr || !profileData) {
        throw new Error('User with this Public ID not found.')
      }

      // 2. Check if user is already a member
      const { data: existingMember, error: memberCheckErr } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('profile_id', profileData.id)
        .maybeSingle()

      if (memberCheckErr) throw memberCheckErr
      if (existingMember) {
        throw new Error('User is already a member of this group.')
      }

      // 3. Add user to the group
      const { error: addErr } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          profile_id: profileData.id
        })

      if (addErr) throw addErr

      // 4. Log activity
      await supabase.from('activity_logs').insert({
        group_id: groupId,
        actor_id: user.id,
        action_type: 'add_member',
        description: `${user.name} added ${profileData.name} to the group`
      })

      return true
    } catch (e: any) {
      console.error('Error in addMemberByPublicId:', e)
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const searchProfileByUsernameOrPublicId = async (query: string): Promise<Profile[] | null> => {
    if (!user) return null
    setError(null)
    try {
      // Query profiles by public_id or username
      const cleanQuery = query.trim()
      const { data, error: searchErr } = await supabase
        .from('profiles')
        .select('*')
        .or(`public_id.eq.${cleanQuery},username.eq.${cleanQuery}`)

      if (searchErr) throw searchErr
      return data as Profile[]
    } catch (e: any) {
      console.error('Error in searchProfileByUsernameOrPublicId:', e)
      setError(e.message)
      return null
    }
  }

  return {
    loading,
    error,
    fetchGroups,
    fetchGroupDetail,
    createGroup,
    updateGroup,
    toggleArchiveGroup,
    addMemberByPublicId,
    searchProfileByUsernameOrPublicId
  }
}
