import { useState, useEffect } from 'react';
import { AdminService } from '@/services/admin';
import { AdminDashboardData, User } from '@/types';

export const useAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdminStatus = async () => {
    try {
      setLoading(true);
      const adminStatus = await AdminService.isAdmin();
      setIsAdmin(adminStatus);
    } catch (err) {
      console.error('Error checking admin status:', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, []);

  return {
    isAdmin,
    loading,
    refresh: checkAdminStatus,
  };
};

export const useAdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await AdminService.getDashboardData();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const refresh = () => {
    fetchDashboardData();
  };

  return {
    dashboardData,
    loading,
    error,
    refresh,
  };
};

export const useTournamentAdmin = (tournamentId: string | undefined) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advanceToNextRound = async (): Promise<boolean> => {
    if (!tournamentId) return false;

    try {
      setLoading(true);
      setError(null);

      await AdminService.advanceToNextRound(tournamentId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance tournament');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetBracket = async (): Promise<boolean> => {
    if (!tournamentId) return false;

    try {
      setLoading(true);
      setError(null);

      await AdminService.resetTournamentBracket(tournamentId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset bracket');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const finalizeMatchup = async (matchupId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      await AdminService.finalizeMatchup(matchupId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize matchup');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const overrideWinner = async (matchupId: string, winnerId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      await AdminService.overrideMatchupWinner(matchupId, winnerId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to override winner');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    advanceToNextRound,
    resetBracket,
    finalizeMatchup,
    overrideWinner,
    clearError,
  };
};

export const useRoundAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockRound = async (roundId: string, locked: boolean = true): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      await AdminService.lockRound(roundId, locked);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${locked ? 'lock' : 'unlock'} round`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unlockRound = async (roundId: string): Promise<boolean> => {
    return lockRound(roundId, false);
  };

  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    lockRound,
    unlockRound,
    clearError,
  };
};

export const useUserAdmin = (page: number = 1, pageSize: number = 20, search?: string) => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, total: totalCount } = await AdminService.getAllUsers(page, pageSize, search);
      setUsers(data);
      setTotal(totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, search]);

  const updateUserAdminStatus = async (userId: string, isAdmin: boolean): Promise<boolean> => {
    try {
      setUpdating(true);
      setError(null);

      await AdminService.updateUserAdminStatus(userId, isAdmin);
      
      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, isAdmin } : user
      ));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      setUpdating(true);
      setError(null);

      await AdminService.deleteUser(userId);
      
      // Remove from local state
      setUsers(prev => prev.filter(user => user.id !== userId));
      setTotal(prev => prev - 1);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const refresh = () => {
    fetchUsers();
  };

  const clearError = () => {
    setError(null);
  };

  return {
    users,
    total,
    loading,
    updating,
    error,
    updateUserAdminStatus,
    deleteUser,
    refresh,
    clearError,
  };
};

export const useAdminVoting = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const castAdminVote = async (
    matchupId: string,
    selectedContestantId: string,
    weight: number = 5
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      await AdminService.castAdminVote(matchupId, selectedContestantId, weight);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cast admin vote');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    castAdminVote,
    clearError,
  };
};

export const useMatchupAnalysis = (matchupId: string | undefined) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    if (!matchupId) {
      setAnalysis(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await AdminService.getMatchupVoteAnalysis(matchupId);
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vote analysis');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [matchupId]);

  const refresh = () => {
    fetchAnalysis();
  };

  return {
    analysis,
    loading,
    error,
    refresh,
  };
};

export const useSystemStats = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await AdminService.getSystemStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch system stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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

export const useDataExport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportTournament = async (tournamentId: string): Promise<any | null> => {
    try {
      setLoading(true);
      setError(null);

      const data = await AdminService.exportTournamentData(tournamentId);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export tournament data');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const downloadAsJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    exportTournament,
    downloadAsJson,
    clearError,
  };
};

export const useDataCleanup = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ cleaned: number; details: string[] } | null>(null);

  const cleanupOrphanedData = async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const cleanupResults = await AdminService.cleanupOrphanedData();
      setResults(cleanupResults);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup data');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults(null);
    setError(null);
  };

  return {
    loading,
    error,
    results,
    cleanupOrphanedData,
    clearResults,
  };
};