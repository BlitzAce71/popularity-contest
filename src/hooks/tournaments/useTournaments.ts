import { useState, useEffect } from 'react';
import { TournamentService } from '@/services/tournaments';
import { Tournament, FilterOptions, SortOptions, PaginatedResponse, CreateTournamentData } from '@/types';

export const useTournaments = (
  initialPage: number = 1,
  initialPageSize: number = 10,
  initialFilters?: FilterOptions,
  initialSort?: SortOptions
) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState<FilterOptions>(initialFilters || {});
  const [sort, setSort] = useState<SortOptions>(initialSort || { field: 'created_at', direction: 'desc' });
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
  });

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response: PaginatedResponse<Tournament> = await TournamentService.getTournaments(
        page,
        pageSize,
        filters,
        sort
      );

      setTournaments(response.data);
      setPagination({
        total: response.count,
        totalPages: response.totalPages,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournaments');
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, [page, pageSize, filters, sort]);

  const updateFilters = (newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to first page when filters change
  };

  const updateSort = (newSort: SortOptions) => {
    setSort(newSort);
    setPage(1); // Reset to first page when sort changes
  };

  const nextPage = () => {
    if (page < pagination.totalPages) {
      setPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (page > 1) {
      setPage(prev => prev - 1);
    }
  };

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

  const refresh = () => {
    fetchTournaments();
  };

  return {
    tournaments,
    loading,
    error,
    page,
    pageSize,
    filters,
    sort,
    pagination,
    updateFilters,
    updateSort,
    setPageSize,
    nextPage,
    prevPage,
    goToPage,
    refresh,
  };
};

export const useCreateTournament = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTournament = async (tournamentData: CreateTournamentData): Promise<Tournament | null> => {
    try {
      setLoading(true);
      setError(null);

      const tournament = await TournamentService.createTournament(tournamentData);
      return tournament;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    createTournament,
    loading,
    error,
  };
};

export const useUserTournaments = (userId?: string) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserTournaments = async () => {
    if (!userId) {
      setTournaments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await TournamentService.getUserTournaments(userId);
      setTournaments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user tournaments');
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserTournaments();
  }, [userId]);

  const refresh = () => {
    fetchUserTournaments();
  };

  return {
    tournaments,
    loading,
    error,
    refresh,
  };
};