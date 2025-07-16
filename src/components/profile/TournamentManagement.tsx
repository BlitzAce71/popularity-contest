import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, Calendar, ExternalLink, Settings } from 'lucide-react';

interface Tournament {
  id: string;
  name: string;
  status: string;
  participantCount: number;
  createdAt: string;
}

interface TournamentManagementProps {
  tournaments: Tournament[];
  onRefresh: () => void;
}

const TournamentManagement: React.FC<TournamentManagementProps> = ({ tournaments, onRefresh }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'registration':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'active':
        return 'Currently running';
      case 'completed':
        return 'Finished';
      case 'draft':
        return 'In development';
      case 'registration':
        return 'Accepting participants';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Tournaments</h2>
          <p className="text-gray-600">Manage tournaments you've created</p>
        </div>
        <Link 
          to="/tournaments/create"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <Trophy className="w-4 h-4" />
          Create Tournament
        </Link>
      </div>

      {/* Tournaments Grid */}
      {tournaments.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <Card key={tournament.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{tournament.name}</CardTitle>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(tournament.status)}`}>
                    {tournament.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{tournament.participantCount} participants</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Created {formatDate(tournament.createdAt)}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {getStatusDescription(tournament.status)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <Link 
                    to={`/tournaments/${tournament.id}`}
                    className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 text-center"
                  >
                    <ExternalLink className="w-4 h-4 inline mr-1" />
                    View
                  </Link>
                  <Link 
                    to={`/tournaments/${tournament.id}/manage`}
                    className="flex-1 bg-primary-600 text-white px-3 py-2 rounded text-sm hover:bg-primary-700 text-center"
                  >
                    <Settings className="w-4 h-4 inline mr-1" />
                    Manage
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tournaments yet</h3>
            <p className="text-gray-500 mb-6">
              Create your first tournament to get started
            </p>
            <Link 
              to="/tournaments/create"
              className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 inline-flex items-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              Create Your First Tournament
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats Summary */}
      {tournaments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tournament Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{tournaments.length}</div>
                <div className="text-sm text-gray-500">Total Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {tournaments.filter(t => t.status === 'active').length}
                </div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {tournaments.filter(t => t.status === 'completed').length}
                </div>
                <div className="text-sm text-gray-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {tournaments.reduce((sum, t) => sum + t.participantCount, 0)}
                </div>
                <div className="text-sm text-gray-500">Total Participants</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TournamentManagement;