import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export interface UserProfileData {
  user: User;
  stats: {
    tournamentsCreated: number;
    tournamentsParticipated: number;
    totalVotes: number;
    completionRate: number;
    joinDate: string;
  };
  recentActivity: {
    tournaments: Array<{
      id: string;
      name: string;
      status: string;
      lastActivity: string;
      role: 'creator' | 'participant';
    }>;
    votes: Array<{
      id: string;
      tournamentName: string;
      contestantName: string;
      votedAt: string;
      matchupId: string;
    }>;
  };
  createdTournaments?: Array<{
    id: string;
    name: string;
    status: string;
    participantCount: number;
    createdAt: string;
  }>;
}

export interface UserProfileUpdateData {
  username?: string;
  first_name?: string;
  last_name?: string;
}

export class ProfileService {
  // Get comprehensive user profile data
  static async getUserProfile(): Promise<UserProfileData | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile) return null;

      // Get tournament participation stats
      const { data: participationData, error: participationError } = await supabase
        .from('votes')
        .select(`
          id,
          matchups!inner(
            id,
            tournament_id,
            tournaments!inner(id, name, status)
          )
        `)
        .eq('user_id', user.user.id);

      if (participationError) throw participationError;

      // Get tournaments created by user
      const { data: createdTournaments, error: createdError } = await supabase
        .from('tournaments')
        .select(`
          id,
          name,
          status,
          created_at,
          contestants(count)
        `)
        .eq('created_by', user.user.id)
        .order('created_at', { ascending: false });

      if (createdError) throw createdError;

      // Get recent voting activity
      const { data: recentVotes, error: votesError } = await supabase
        .from('votes')
        .select(`
          id,
          created_at,
          matchups!inner(
            id,
            tournaments!inner(id, name)
          ),
          contestants!selected_contestant_id(id, name)
        `)
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (votesError) throw votesError;

      // Calculate stats
      const uniqueTournaments = new Set(
        (participationData || []).map(v => v.matchups?.tournament_id)
      );
      const tournamentsParticipated = uniqueTournaments.size;
      const totalVotes = participationData?.length || 0;
      const tournamentsCreated = createdTournaments?.length || 0;

      // Calculate completion rate (tournaments with votes vs total tournaments available)
      const completionRate = tournamentsParticipated > 0 ? 
        (totalVotes / (tournamentsParticipated * 10)) * 100 : 0; // Rough estimate

      // Format recent activity
      const recentTournamentActivity = [
        ...(createdTournaments || []).slice(0, 5).map(t => ({
          id: t.id,
          name: t.name,
          status: t.status,
          lastActivity: t.created_at,
          role: 'creator' as const
        })),
        ...Array.from(uniqueTournaments).slice(0, 5).map(tId => {
          const vote = participationData?.find(v => v.matchups?.tournament_id === tId);
          return {
            id: tId,
            name: vote?.matchups?.tournaments?.name || 'Unknown Tournament',
            status: vote?.matchups?.tournaments?.status || 'unknown',
            lastActivity: vote?.matchups?.tournaments?.created_at || '',
            role: 'participant' as const
          };
        })
      ].sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
       .slice(0, 8);

      const recentVotesActivity = (recentVotes || []).map(vote => ({
        id: vote.id,
        tournamentName: vote.matchups?.tournaments?.name || 'Unknown Tournament',
        contestantName: vote.contestants?.name || 'Unknown Contestant',
        votedAt: vote.created_at,
        matchupId: vote.matchups?.id || ''
      }));

      return {
        user: profile,
        stats: {
          tournamentsCreated,
          tournamentsParticipated,
          totalVotes,
          completionRate: Math.min(completionRate, 100),
          joinDate: profile.created_at
        },
        recentActivity: {
          tournaments: recentTournamentActivity,
          votes: recentVotesActivity
        },
        createdTournaments: createdTournaments?.map(t => ({
          id: t.id,
          name: t.name,
          status: t.status,
          participantCount: t.contestants?.[0]?.count || 0,
          createdAt: t.created_at
        }))
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch profile');
    }
  }

  // Update user profile information
  static async updateProfile(updates: UserProfileUpdateData): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update profile');
    }
  }

  // Get user's voting history with pagination
  static async getVotingHistory(
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ data: UserProfileData['recentActivity']['votes']; total: number }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('votes')
        .select(`
          id,
          created_at,
          matchups!inner(
            id,
            tournaments!inner(id, name)
          ),
          contestants!selected_contestant_id(id, name)
        `, { count: 'exact' })
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const formattedData = (data || []).map(vote => ({
        id: vote.id,
        tournamentName: vote.matchups?.tournaments?.name || 'Unknown Tournament',
        contestantName: vote.contestants?.name || 'Unknown Contestant',
        votedAt: vote.created_at,
        matchupId: vote.matchups?.id || ''
      }));

      return {
        data: formattedData,
        total: count || 0
      };
    } catch (error) {
      console.error('Error fetching voting history:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch voting history');
    }
  }
}