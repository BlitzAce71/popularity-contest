import { supabase } from '@/lib/supabase';
import { Tournament, CreateTournamentData, FilterOptions, SortOptions, PaginatedResponse } from '@/types';

export class TournamentService {
  // Get tournaments with filtering, sorting, and pagination
  static async getTournaments(
    page: number = 1,
    pageSize: number = 10,
    filters?: FilterOptions,
    sort?: SortOptions
  ): Promise<PaginatedResponse<Tournament>> {
    try {
      let query = supabase
        .from('tournaments')
        .select('*, users!created_by(username, avatar_url)', { count: 'exact' });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.bracketType) {
        query = query.eq('bracket_type', filters.bracketType);
      }
      if (filters?.isPublic !== undefined) {
        query = query.eq('is_public', filters.isPublic);
      }
      if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Apply sorting
      if (sort) {
        query = query.order(sort.field, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch tournaments');
    }
  }

  // Get single tournament with full details
  static async getTournament(id: string): Promise<Tournament> {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          users!created_by(username, avatar_url),
          contestants(*),
          rounds(
            *,
            matchups(
              *,
              contestant1:contestants!contestant1_id(*),
              contestant2:contestants!contestant2_id(*),
              winner:contestants!winner_id(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Tournament not found');

      return data;
    } catch (error) {
      console.error('Error fetching tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch tournament');
    }
  }

  // Create new tournament
  static async createTournament(tournamentData: CreateTournamentData): Promise<Tournament> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tournaments')
        .insert([
          {
            name: tournamentData.title,
            description: tournamentData.description,
            image_url: tournamentData.imageUrl,
            start_date: tournamentData.startDate,
            end_date: tournamentData.endDate,
            max_contestants: tournamentData.maxParticipants,
            bracket_type: tournamentData.bracketType,
            is_public: tournamentData.isPublic,
            size: tournamentData.maxParticipants, // For now, size = max_contestants
            created_by: user.user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create tournament');
    }
  }

  // Update tournament
  static async updateTournament(
    id: string,
    updates: Partial<CreateTournamentData>
  ): Promise<Tournament> {
    try {
      const updateData: Record<string, any> = {};

      if (updates.title) updateData.name = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
      if (updates.startDate) updateData.start_date = updates.startDate;
      if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
      if (updates.maxParticipants) {
        updateData.max_contestants = updates.maxParticipants;
        updateData.size = updates.maxParticipants;
      }
      if (updates.bracketType) updateData.bracket_type = updates.bracketType;
      if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;

      const { data, error } = await supabase
        .from('tournaments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update tournament');
    }
  }

  // Delete tournament
  static async deleteTournament(id: string): Promise<void> {
    try {
      const { error } = await supabase.from('tournaments').delete().eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete tournament');
    }
  }

  // Get tournament statistics
  static async getTournamentStats(id: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_tournament_stats', {
        tournament_uuid: id,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching tournament stats:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch tournament stats');
    }
  }

  // Get bracket visualization data
  static async getBracketData(id: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_bracket_data', {
        tournament_uuid: id,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch bracket data');
    }
  }

  // Start tournament (generate bracket)
  static async startTournament(id: string): Promise<void> {
    try {
      // First check if tournament can start
      const { data: canStart, error: checkError } = await supabase.rpc('can_start_tournament', {
        tournament_uuid: id,
      });

      if (checkError) throw checkError;
      if (!canStart) throw new Error('Tournament cannot be started yet');

      // Generate bracket
      const { error } = await supabase.rpc('generate_single_elimination_bracket', {
        tournament_uuid: id,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error starting tournament:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to start tournament');
    }
  }

  // Update tournament status
  static async updateTournamentStatus(
    id: string,
    status: 'draft' | 'registration' | 'active' | 'completed' | 'cancelled'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating tournament status:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update tournament status');
    }
  }

  // Get user's tournaments
  static async getUserTournaments(userId: string): Promise<Tournament[]> {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user tournaments:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch user tournaments');
    }
  }

  // Check if user can manage tournament
  static async canManageTournament(tournamentId: string): Promise<boolean> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      // Check if user is admin
      const { data: userProfile } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.user.id)
        .single();

      if (userProfile?.is_admin) return true;

      // Check if user created the tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('created_by')
        .eq('id', tournamentId)
        .single();

      return tournament?.created_by === user.user.id;
    } catch (error) {
      console.error('Error checking tournament permissions:', error);
      return false;
    }
  }

  // Subscribe to tournament changes
  static subscribeTo(
    tournamentId: string,
    callback: (payload: any) => void
  ): () => void {
    const subscription = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchups',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }
}