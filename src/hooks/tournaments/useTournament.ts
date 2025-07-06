import { useState, useEffect } from 'react';
import { TournamentService } from '@/services/tournaments';
import { ContestantService } from '@/services/contestants';
import { Tournament, TournamentStats, Contestant, BracketData, VoteCounts, VotingStatus } from '@/types';

export const useTournament = (tournamentId: string | undefined) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTournament = async () => {
    if (!tournamentId) {
      setTournament(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await TournamentService.getTournament(tournamentId);
      setTournament(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournament');
      setTournament(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournament();
  }, [tournamentId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!tournamentId) return;

    const unsubscribe = TournamentService.subscribeTo(tournamentId, () => {
      fetchTournament(); // Refetch on updates
    });

    return unsubscribe;
  }, [tournamentId]);

  const refresh = () => {
    fetchTournament();
  };

  return {
    tournament,
    loading,
    error,
    refresh,
  };
};

export const useTournamentStats = (tournamentId: string | undefined) => {
  const [stats, setStats] = useState<TournamentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!tournamentId) {
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await TournamentService.getTournamentStats(tournamentId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournament stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [tournamentId]);

  const refresh = () => {
    fetchStats();
  };

  return {
    stats,
    loading,
    error,
    refresh,
  };
};

export const useBracketData = (tournamentId: string | undefined) => {
  const [bracketData, setBracketData] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBracketData = async () => {
    if (!tournamentId) {
      setBracketData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await TournamentService.getBracketData(tournamentId);
      setBracketData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bracket data');
      setBracketData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBracketData();
  }, [tournamentId]);

  const refresh = () => {
    fetchBracketData();
  };

  return {
    bracketData,
    loading,
    error,
    refresh,
  };
};

export const useTournamentContestants = (tournamentId: string | undefined) => {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContestants = async () => {
    if (!tournamentId) {
      setContestants([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await ContestantService.getContestants(tournamentId);
      setContestants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contestants');
      setContestants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContestants();
  }, [tournamentId]);

  const refresh = () => {
    fetchContestants();
  };

  return {
    contestants,
    loading,
    error,
    refresh,
  };
};

export const useTournamentManagement = (tournamentId: string | undefined) => {
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkPermissions = async () => {
    if (!tournamentId) {
      setCanManage(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await TournamentService.canManageTournament(tournamentId);
      setCanManage(result);
    } catch (err) {
      setCanManage(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPermissions();
  }, [tournamentId]);

  const startTournament = async (): Promise<boolean> => {
    if (!tournamentId || !canManage) return false;

    try {
      await TournamentService.startTournament(tournamentId);
      return true;
    } catch (err) {
      console.error('Failed to start tournament:', err);
      return false;
    }
  };

  const updateTournamentStatus = async (
    status: 'draft' | 'registration' | 'active' | 'completed' | 'cancelled'
  ): Promise<boolean> => {
    if (!tournamentId || !canManage) return false;

    try {
      await TournamentService.updateTournamentStatus(tournamentId, status);
      return true;
    } catch (err) {
      console.error('Failed to update tournament status:', err);
      return false;
    }
  };

  const deleteTournament = async (): Promise<boolean> => {
    if (!tournamentId || !canManage) return false;

    try {
      await TournamentService.deleteTournament(tournamentId);
      return true;
    } catch (err) {
      console.error('Failed to delete tournament:', err);
      return false;
    }
  };

  return {
    canManage,
    loading,
    startTournament,
    updateTournamentStatus,
    deleteTournament,
    refresh: checkPermissions,
  };
};