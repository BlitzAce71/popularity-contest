import { useState, useCallback } from 'react';
import { SuggestionService } from '@/services/suggestions';
import type { 
  ModerateSuggestionRequest,
  BulkModerationRequest,
  BulkModerationResponse,
  SuggestionAnalytics
} from '@/types';

export const useSuggestionModeration = (tournamentId: string) => {
  const [moderating, setModerating] = useState<string | null>(null);
  const [bulkModerating, setBulkModerating] = useState(false);
  const [analytics, setAnalytics] = useState<SuggestionAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Moderate a single suggestion
  const moderateSuggestion = async (
    request: ModerateSuggestionRequest,
    onSuccess?: () => void
  ): Promise<boolean> => {
    try {
      setModerating(request.suggestion_id);
      setError(null);

      await SuggestionService.moderateSuggestion(request);
      
      if (onSuccess) {
        onSuccess();
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to moderate suggestion';
      setError(errorMessage);
      return false;
    } finally {
      setModerating(null);
    }
  };

  // Approve a suggestion
  const approveSuggestion = async (
    suggestionId: string,
    adminNotes?: string,
    onSuccess?: () => void
  ): Promise<boolean> => {
    return moderateSuggestion({
      suggestion_id: suggestionId,
      status: 'approved',
      admin_notes: adminNotes,
    }, onSuccess);
  };

  // Reject a suggestion
  const rejectSuggestion = async (
    suggestionId: string,
    adminNotes?: string,
    onSuccess?: () => void
  ): Promise<boolean> => {
    return moderateSuggestion({
      suggestion_id: suggestionId,
      status: 'rejected',
      admin_notes: adminNotes,
    }, onSuccess);
  };

  // Mark suggestion as duplicate
  const markAsDuplicate = async (
    suggestionId: string,
    adminNotes?: string,
    onSuccess?: () => void
  ): Promise<boolean> => {
    return moderateSuggestion({
      suggestion_id: suggestionId,
      status: 'duplicate',
      admin_notes: adminNotes,
    }, onSuccess);
  };

  // Bulk moderate suggestions
  const bulkModerate = async (
    request: BulkModerationRequest,
    onSuccess?: (result: BulkModerationResponse) => void
  ): Promise<BulkModerationResponse | null> => {
    try {
      setBulkModerating(true);
      setError(null);

      const result = await SuggestionService.bulkModerateSuggestions(request);
      
      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk moderate suggestions';
      setError(errorMessage);
      return null;
    } finally {
      setBulkModerating(false);
    }
  };

  // Bulk approve suggestions
  const bulkApprove = async (
    suggestionIds: string[],
    adminNotes?: string,
    onSuccess?: (result: BulkModerationResponse) => void
  ): Promise<BulkModerationResponse | null> => {
    return bulkModerate({
      suggestion_ids: suggestionIds,
      action: 'approve',
      admin_notes: adminNotes,
    }, onSuccess);
  };

  // Bulk reject suggestions
  const bulkReject = async (
    suggestionIds: string[],
    adminNotes?: string,
    onSuccess?: (result: BulkModerationResponse) => void
  ): Promise<BulkModerationResponse | null> => {
    return bulkModerate({
      suggestion_ids: suggestionIds,
      action: 'reject',
      admin_notes: adminNotes,
    }, onSuccess);
  };

  // Bulk delete suggestions
  const bulkDelete = async (
    suggestionIds: string[],
    onSuccess?: (result: BulkModerationResponse) => void
  ): Promise<BulkModerationResponse | null> => {
    return bulkModerate({
      suggestion_ids: suggestionIds,
      action: 'delete',
    }, onSuccess);
  };

  // Load suggestion analytics
  const loadAnalytics = useCallback(async (): Promise<SuggestionAnalytics | null> => {
    if (!tournamentId) return null;

    try {
      setAnalyticsLoading(true);
      setError(null);

      const analyticsData = await SuggestionService.getSuggestionAnalytics(tournamentId);
      setAnalytics(analyticsData);
      return analyticsData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(errorMessage);
      return null;
    } finally {
      setAnalyticsLoading(false);
    }
  }, [tournamentId]);

  // Refresh analytics
  const refreshAnalytics = useCallback(() => {
    return loadAnalytics();
  }, [loadAnalytics]);

  // Check if currently moderating a specific suggestion
  const isModerating = useCallback((suggestionId: string): boolean => {
    return moderating === suggestionId;
  }, [moderating]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check if any moderation action is in progress
  const isAnyModerationInProgress = useCallback((): boolean => {
    return moderating !== null || bulkModerating;
  }, [moderating, bulkModerating]);

  return {
    // State
    moderating,
    bulkModerating,
    analytics,
    analyticsLoading,
    error,

    // Single moderation actions
    moderateSuggestion,
    approveSuggestion,
    rejectSuggestion,
    markAsDuplicate,

    // Bulk moderation actions
    bulkModerate,
    bulkApprove,
    bulkReject,
    bulkDelete,

    // Analytics
    loadAnalytics,
    refreshAnalytics,

    // Utility functions
    isModerating,
    isAnyModerationInProgress,
    clearError,
  };
};