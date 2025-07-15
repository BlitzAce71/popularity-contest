import { useState, useEffect, useCallback } from 'react';
import { SuggestionService } from '@/services/suggestions';
import type { 
  SuggestionWithVoteStatus,
  SubmitSuggestionRequest,
  GetSuggestionsRequest 
} from '@/types';

interface UseSuggestionsOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'votes' | 'newest' | 'oldest' | 'alphabetical';
  status?: 'all' | 'pending' | 'approved' | 'rejected' | 'duplicate';
  search?: string;
}

export const useSuggestions = (
  tournamentId: string,
  options: UseSuggestionsOptions = {}
) => {
  const [suggestions, setSuggestions] = useState<SuggestionWithVoteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const {
    page = 1,
    pageSize = 20,
    sortBy = 'votes',
    status = 'all',
    search
  } = options;

  const fetchSuggestions = useCallback(async () => {
    if (!tournamentId) return;
    
    try {
      setLoading(true);
      setError(null);

      const request: GetSuggestionsRequest = {
        tournament_id: tournamentId,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        status,
        search,
      };

      const response = await SuggestionService.getSuggestions(request);
      setSuggestions(response.data);
      setTotal(response.total);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch suggestions';
      setError(errorMessage);
      setSuggestions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, page, pageSize, sortBy, status, search]);

  const submitSuggestion = async (suggestionData: SubmitSuggestionRequest): Promise<boolean> => {
    try {
      setSubmitting(true);
      setError(null);

      const newSuggestion = await SuggestionService.submitSuggestion(tournamentId, suggestionData);
      
      // Add new suggestion to the list optimistically
      setSuggestions(prev => [newSuggestion, ...prev]);
      setTotal(prev => prev + 1);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit suggestion';
      setError(errorMessage);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const updateSuggestionInList = useCallback((suggestionId: string, updates: Partial<SuggestionWithVoteStatus>) => {
    setSuggestions(prev => 
      prev.map(suggestion => 
        suggestion.id === suggestionId 
          ? { ...suggestion, ...updates }
          : suggestion
      )
    );
  }, []);

  const removeSuggestionFromList = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.filter(suggestion => suggestion.id !== suggestionId));
    setTotal(prev => Math.max(0, prev - 1));
  }, []);

  const refresh = useCallback(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return {
    suggestions,
    loading,
    error,
    total,
    submitting,
    submitSuggestion,
    updateSuggestionInList,
    removeSuggestionFromList,
    refresh,
    clearError,
  };
};