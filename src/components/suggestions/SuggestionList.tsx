import React, { useState, useMemo } from 'react';
import SuggestionCard from './SuggestionCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import { Search, Filter, RefreshCw, ChevronDown, TrendingUp, Clock, AlphabeticalSort, CheckCircle } from 'lucide-react';
import type { SuggestionWithVoteStatus } from '@/types';

interface SuggestionListProps {
  suggestions: SuggestionWithVoteStatus[];
  loading: boolean;
  error: string | null;
  total: number;
  onVote: (suggestionId: string) => Promise<void>;
  onRefresh: () => void;
  onLoadMore?: () => void;
  isVotingLoading: (suggestionId: string) => boolean;
  canVote?: boolean;
  showAdminStatus?: boolean;
  hasMore?: boolean;
  className?: string;
}

type SortOption = 'votes' | 'newest' | 'oldest' | 'alphabetical';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'duplicate';

const SuggestionList: React.FC<SuggestionListProps> = ({
  suggestions,
  loading,
  error,
  total,
  onVote,
  onRefresh,
  onLoadMore,
  isVotingLoading,
  canVote = true,
  showAdminStatus = false,
  hasMore = false,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('votes');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const sortOptions = [
    { value: 'votes' as const, label: 'Most Votes', icon: TrendingUp },
    { value: 'newest' as const, label: 'Newest', icon: Clock },
    { value: 'oldest' as const, label: 'Oldest', icon: Clock },
    { value: 'alphabetical' as const, label: 'A-Z', icon: AlphabeticalSort },
  ];

  const statusOptions = [
    { value: 'all' as const, label: 'All Status' },
    { value: 'pending' as const, label: 'Pending' },
    { value: 'approved' as const, label: 'Approved' },
    { value: 'rejected' as const, label: 'Rejected' },
    { value: 'duplicate' as const, label: 'Duplicate' },
  ];

  // Filter and sort suggestions
  const filteredAndSortedSuggestions = useMemo(() => {
    let filtered = suggestions;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(suggestion =>
        suggestion.name.toLowerCase().includes(query) ||
        (suggestion.description && suggestion.description.toLowerCase().includes(query)) ||
        suggestion.suggested_by_user.username.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(suggestion => suggestion.status === statusFilter);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'votes':
          return b.vote_count - a.vote_count;
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return sorted;
  }, [suggestions, searchQuery, sortBy, statusFilter]);

  const currentSortOption = sortOptions.find(option => option.value === sortBy);

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={onRefresh} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Search and Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search suggestions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter (for admin view) */}
          {showAdminStatus && (
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          Showing {filteredAndSortedSuggestions.length} of {total} suggestions
          {searchQuery && (
            <span> matching "{searchQuery}"</span>
          )}
          {statusFilter !== 'all' && (
            <span> • {statusOptions.find(opt => opt.value === statusFilter)?.label}</span>
          )}
        </div>
        {currentSortOption && (
          <div className="flex items-center gap-1">
            <currentSortOption.icon className="w-4 h-4" />
            <span>Sorted by {currentSortOption.label}</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && suggestions.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">Loading suggestions...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAndSortedSuggestions.length === 0 && suggestions.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions yet</h3>
          <p className="text-gray-600">Be the first to suggest a contestant for this tournament!</p>
        </div>
      )}

      {/* No Results State */}
      {!loading && filteredAndSortedSuggestions.length === 0 && suggestions.length > 0 && (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No matching suggestions</h3>
          <p className="text-gray-600">
            Try adjusting your search or filter criteria
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-4"
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Suggestions Grid */}
      {filteredAndSortedSuggestions.length > 0 && (
        <div className="space-y-4">
          {filteredAndSortedSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onVote={onVote}
              isVotingLoading={isVotingLoading(suggestion.id)}
              canVote={canVote}
              showAdminStatus={showAdminStatus}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && onLoadMore && (
        <div className="text-center pt-6">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Loading...</span>
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}

      {/* Loading More Indicator */}
      {loading && suggestions.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="md" />
          <span className="ml-2 text-gray-600">Loading more suggestions...</span>
        </div>
      )}
    </div>
  );
};

export default SuggestionList;