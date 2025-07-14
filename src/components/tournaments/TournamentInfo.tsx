import React from 'react';
import type { Tournament } from '@/types';
import { useTournamentContestants } from '@/hooks/tournaments/useTournament';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { 
  Calendar, 
  Users, 
  Trophy, 
  Clock, 
  User,
  Image as ImageIcon 
} from 'lucide-react';

interface TournamentInfoProps {
  tournament: Tournament;
}

const TournamentInfo: React.FC<TournamentInfoProps> = ({ tournament }) => {
  const { contestants, loading: contestantsLoading } = useTournamentContestants(tournament.id);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusDescription = () => {
    switch (tournament.status) {
      case 'draft':
        return 'Tournament is being set up by the organizer.';
      case 'registration':
        return 'Registration is open for new contestants.';
      case 'active':
        return 'Tournament is currently running with active voting.';
      case 'completed':
        return 'Tournament has finished with all matches completed.';
      case 'cancelled':
        return 'Tournament has been cancelled.';
      default:
        return 'Unknown status.';
    }
  };

  return (
    <div className="space-y-8">
      {/* Tournament Details */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tournament Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-500">Format</div>
                <div className="text-gray-900 capitalize">
                  {tournament.bracket_type?.replace('-', ' ') || 'Single elimination'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-500">Participants</div>
                <div className="text-gray-900">
                  {tournament.current_contestants || 0} / {tournament.max_contestants} contestants
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-500">Status</div>
                <div className="text-gray-900 capitalize">{tournament.status}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {getStatusDescription()}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-500">Created by</div>
                <div className="text-gray-900">
                  {tournament.users?.username || 'Unknown'}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {tournament.created_at && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-500">Created</div>
                  <div className="text-gray-900">{formatDate(tournament.created_at)}</div>
                </div>
              </div>
            )}


            {tournament.end_date && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    {tournament.status === 'completed' ? 'Completed' : 'Scheduled to end'}
                  </div>
                  <div className="text-gray-900">{formatDate(tournament.end_date)}</div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-500">Visibility</div>
                <div className="text-gray-900">
                  {tournament.is_public ? 'Public' : 'Private'}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {tournament.is_public 
                    ? 'Anyone can view and participate' 
                    : 'Only invited users can participate'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tournament Description */}
      {tournament.description && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">{tournament.description}</p>
          </div>
        </div>
      )}

      {/* Tournament Image */}
      {tournament.image_url && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tournament Image</h3>
          <div className="max-w-md">
            <img
              src={tournament.image_url}
              alt={tournament.name}
              className="w-full h-64 object-cover rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Contestants List */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Contestants ({contestants.length})
        </h3>
        
        {contestantsLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : contestants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contestants
              .sort((a, b) => {
                // Sort by quadrant first, then by seed (both ascending)
                if (a.quadrant !== b.quadrant) {
                  return (a.quadrant || 1) - (b.quadrant || 1);
                }
                return (a.seed || 0) - (b.seed || 0);
              })
              .map((contestant) => (
              <div key={contestant.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                {contestant.image_url ? (
                  <img
                    src={contestant.image_url}
                    alt={contestant.name}
                    className="w-12 h-12 object-cover rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">
                    {contestant.name}
                  </div>
                  {contestant.seed && (
                    <div className="text-sm text-gray-500">
                      Seed #{contestant.seed}
                    </div>
                  )}
                  {contestant.description && (
                    <div className="text-sm text-gray-600 truncate">
                      {contestant.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No contestants added yet.</p>
          </div>
        )}
      </div>

      {/* Rules & Information */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rules & Information</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex gap-2">
            <span className="font-medium">Format:</span>
            <span>
              {tournament.bracket_type === 'single-elimination' && 
                'Single elimination - lose once and you\'re out.'
              }
              {tournament.bracket_type === 'double-elimination' && 
                'Double elimination - contestants have two chances.'
              }
              {tournament.bracket_type === 'round-robin' && 
                'Round robin - everyone plays everyone else.'
              }
            </span>
          </div>
          
          <div className="flex gap-2">
            <span className="font-medium">Voting:</span>
            <span>Each user can vote once per matchup.</span>
          </div>
          
          <div className="flex gap-2">
            <span className="font-medium">Advancement:</span>
            <span>The contestant with the most votes in each matchup advances.</span>
          </div>
          
          {tournament.allow_ties && (
            <div className="flex gap-2">
              <span className="font-medium">Ties:</span>
              <span>Tie votes are allowed and will be handled by tournament rules.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentInfo;