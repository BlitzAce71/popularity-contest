import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileService } from '@/services/profile';
import { ChevronLeft, ChevronRight, Calendar, Trophy } from 'lucide-react';

interface VotingHistoryItem {
  id: string;
  tournamentName: string;
  contestantName: string;
  votedAt: string;
  matchupId: string;
}

const VotingHistory: React.FC = () => {
  const [votes, setVotes] = useState<VotingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVotes, setTotalVotes] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    loadVotingHistory();
  }, [currentPage]);

  const loadVotingHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, total } = await ProfileService.getVotingHistory(currentPage, pageSize);
      setVotes(data);
      setTotalVotes(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voting history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(totalVotes / pageSize);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Voting History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Voting History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadVotingHistory}
              className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
            >
              Try Again
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Voting History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {votes.length > 0 ? (
          <>
            <div className="space-y-3">
              {votes.map((vote) => (
                <div key={vote.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{vote.contestantName}</div>
                      <div className="text-sm text-gray-500">
                        in {vote.tournamentName}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {formatDate(vote.votedAt)}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalVotes)} of {totalVotes} votes
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No voting history yet</p>
            <p className="text-gray-400 text-sm">
              Your votes will appear here once you start participating in tournaments
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VotingHistory;