import React, { useState, useEffect } from 'react';
import { VotingService } from '@/services/voting';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  X,
  Image
} from 'lucide-react';

interface TieBreakerPanelProps {
  tournamentId: string;
  className?: string;
}

interface TieBreakingOpportunity {
  matchupId: string;
  contestant1: any;
  contestant2: any;
  contestant1Votes: number;
  contestant2Votes: number;
  voteDifference: number;
  hasAdminVote: boolean;
}

const TieBreakerPanel: React.FC<TieBreakerPanelProps> = ({ tournamentId, className = '' }) => {
  const { isAdmin } = useAuth();
  const [opportunities, setOpportunities] = useState<TieBreakingOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await VotingService.getTieBreakingOpportunities(tournamentId);
      setOpportunities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tie-breaking opportunities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchOpportunities();
      
      // Refresh every 30 seconds for live updates
      const interval = setInterval(fetchOpportunities, 30000);
      return () => clearInterval(interval);
    }
  }, [tournamentId, isAdmin]);

  const handleTieBreaker = async (matchupId: string, selectedContestantId: string) => {
    try {
      setSubmitting(matchupId);
      setError(null);
      
      await VotingService.submitAdminTieBreaker(matchupId, selectedContestantId, 1);
      await fetchOpportunities(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit tie-breaker vote');
    } finally {
      setSubmitting(null);
    }
  };

  const handleRemoveTieBreaker = async (matchupId: string) => {
    try {
      setSubmitting(matchupId);
      setError(null);
      
      await VotingService.removeAdminTieBreaker(matchupId);
      await fetchOpportunities(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tie-breaker vote');
    } finally {
      setSubmitting(null);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-red-600" />
        <h3 className="text-lg font-semibold text-red-800">Admin Tie-Breaking Panel</h3>
      </div>

      <p className="text-sm text-red-600 mb-4">
        Break ties in matchups with equal votes (vote difference = 0). Your admin vote will be clearly marked and logged.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
          <span className="ml-2 text-gray-600">Loading tie-breaking opportunities...</span>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-green-700 font-medium">No tied matchups</p>
          <p className="text-sm text-green-600 mt-1">All active matchups have winners or different vote counts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opportunity) => (
            <div
              key={opportunity.matchupId}
              className="bg-white border border-red-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {opportunity.voteDifference === 0 ? 'Tied Matchup' : `Close Matchup (${opportunity.voteDifference} vote difference)`}
                  </span>
                </div>
                {opportunity.hasAdminVote && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">Admin vote cast</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Contestant 1 */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    {opportunity.contestant1.image_url ? (
                      <img
                        src={opportunity.contestant1.image_url}
                        alt={opportunity.contestant1.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <Image className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{opportunity.contestant1.name}</div>
                    <div className="text-lg font-bold text-blue-600">
                      {opportunity.contestant1Votes} votes
                    </div>
                  </div>
                </div>

                {/* Contestant 2 */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    {opportunity.contestant2.image_url ? (
                      <img
                        src={opportunity.contestant2.image_url}
                        alt={opportunity.contestant2.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <Image className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{opportunity.contestant2.name}</div>
                    <div className="text-lg font-bold text-blue-600">
                      {opportunity.contestant2Votes} votes
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {opportunity.hasAdminVote ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveTieBreaker(opportunity.matchupId)}
                    disabled={submitting === opportunity.matchupId}
                    className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
                  >
                    {submitting === opportunity.matchupId ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    Remove Tie-Breaker
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleTieBreaker(opportunity.matchupId, opportunity.contestant1.id)}
                      disabled={submitting === opportunity.matchupId}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      {submitting === opportunity.matchupId ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                      Vote for {opportunity.contestant1.name}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleTieBreaker(opportunity.matchupId, opportunity.contestant2.id)}
                      disabled={submitting === opportunity.matchupId}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      {submitting === opportunity.matchupId ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                      Vote for {opportunity.contestant2.name}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TieBreakerPanel;