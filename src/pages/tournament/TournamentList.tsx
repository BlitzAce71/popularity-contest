import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTournaments } from '@/hooks/tournaments/useTournaments';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, Trophy, Users, Calendar, Filter, Search } from 'lucide-react';

const TournamentList: React.FC = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  
  const {
    tournaments,
    loading,
    error,
    page,
    pagination,
    filters,
    updateFilters,
    nextPage,
    prevPage,
    refresh,
  } = useTournaments(1, 12, {
    search: searchTerm,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    isPublic: true,
  });

  // Debug: Log tournament data to see what fields are available
  React.useEffect(() => {
    if (tournaments.length > 0) {
      console.log('🐛 Tournament data:', tournaments[0]);
      console.log('🐛 Image URL field:', tournaments[0].image_url);
    }
  }, [tournaments]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchTerm });
  };

  const handleStatusFilter = (status: typeof statusFilter) => {
    setStatusFilter(status);
    updateFilters({ status: status !== 'all' ? status : undefined });
  };

  if (loading && tournaments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <ErrorMessage
          title="Failed to Load Tournaments"
          message={error}
          onRetry={refresh}
          className="max-w-md mx-auto"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tournaments</h1>
          <p className="text-gray-600 mt-1">
            Participate in popularity contests and vote for your favorites
          </p>
        </div>
        {isAdmin && (
          <Link to="/tournaments/create">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Tournament
            </Button>
          </Link>
        )}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tournaments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
        </form>
        
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value as typeof statusFilter)}
            className="input-field min-w-[140px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {tournaments.length} of {pagination.total} tournaments
        </span>
        {loading && (
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <span>Loading...</span>
          </div>
        )}
      </div>

      {/* Tournament Grid */}
      {tournaments.length === 0 ? (
        <EmptyState
          icon={<Trophy className="w-16 h-16 text-gray-400" />}
          title="No tournaments found"
          description={
            searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Be the first to create a tournament!'
          }
          action={
            isAuthenticated && !searchTerm && statusFilter === 'all'
              ? {
                  label: 'Create Your First Tournament',
                  onClick: () => navigate('/tournaments/create')
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <div key={tournament.id} className="card p-0 hover:shadow-xl transition-shadow overflow-hidden">
              {/* Tournament Image or Placeholder */}
              <div className="relative h-48 w-full">
                {tournament.image_url ? (
                  <>
                    <img
                      src={tournament.image_url}
                      alt={tournament.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                      <div className="flex items-end justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-1">
                            {tournament.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full border bg-white/90 text-gray-800 border-white/20`}
                            >
                              {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                    <div className="text-center">
                      <Trophy className="w-16 h-16 text-primary-400 mx-auto mb-2" />
                      <h3 className="text-xl font-semibold text-primary-700 mb-1">
                        {tournament.name}
                      </h3>
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                            tournament.status
                          )}`}
                        >
                          {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {tournament.bracket_type?.replace('-', ' ') || 'single elimination'}
                  </span>
                </div>

                <p className="text-gray-600 text-sm line-clamp-2">
                  {tournament.description}
                </p>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {tournament.current_contestants || 0}/{tournament.max_contestants}
                  </div>
                  {tournament.tournament_start_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(tournament.tournament_start_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <Link to={`/tournaments/${tournament.id}`}>
                    <Button variant="outline" className="w-full">
                      {tournament.status === 'active' ? 'Vote Now' : 'View Details'}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-8">
          <Button
            variant="outline"
            onClick={prevPage}
            disabled={page === 1 || loading}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            onClick={nextPage}
            disabled={page === pagination.totalPages || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default TournamentList;