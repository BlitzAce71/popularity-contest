import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTournament } from '@/hooks/tournaments/useTournament';
import { useAuth } from '@/contexts/AuthContext';
import { ContestantService } from '@/services/contestants';
import { TournamentService } from '@/services/tournaments';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorRecovery from '@/components/ui/ErrorRecovery';
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  Trophy, 
  Settings,
  Edit,
  Trash2,
  Play,
  Pause,
  Upload,
  Download,
  GripVertical,
  Image
} from 'lucide-react';
import BracketView from '@/components/tournament/BracketView';
import { CreateContestantData } from '@/types';

const ManageTournament: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'contestants' | 'settings' | 'bracket'>('contestants');
  const [showAddContestant, setShowAddContestant] = useState(false);
  const [loading, setLoading] = useState(false);

  const { tournament, loading: tournamentLoading, error: tournamentError, refresh } = useTournament(id);

  // Permission check
  const canManage = user?.id === tournament?.created_by || user?.is_admin;

  if (tournamentLoading && !tournament) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (tournamentError) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Error: {tournamentError}</div>
        <Button onClick={refresh} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Tournament Not Found</h2>
        <p className="mt-2 text-gray-600">
          The tournament you're looking for doesn't exist.
        </p>
        <Link to="/tournaments" className="mt-4 inline-block">
          <Button>Back to Tournaments</Button>
        </Link>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Access Denied</div>
        <p className="text-gray-600 mb-4">
          You don't have permission to manage this tournament.
        </p>
        <Link to={`/tournaments/${id}`}>
          <Button variant="outline">Back to Tournament</Button>
        </Link>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    
    try {
      setLoading(true);
      await TournamentService.updateTournamentStatus(id, newStatus as any);
      refresh();
    } catch (error) {
      console.error('Error updating tournament status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusActions = () => {
    switch (tournament.status) {
      case 'draft':
        return (
          <Button 
            onClick={() => handleStatusChange('registration')}
            disabled={loading || (tournament.current_contestants || 0) < 2}
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Open Registration
          </Button>
        );
      case 'registration':
        return (
          <div className="flex gap-2">
            <Button 
              onClick={() => handleStatusChange('active')}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Tournament
            </Button>
            <Button 
              onClick={() => handleStatusChange('draft')}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              Back to Draft
            </Button>
          </div>
        );
      case 'active':
        return (
          <Button 
            onClick={() => handleStatusChange('completed')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Trophy className="w-4 h-4" />
            Complete Tournament
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/tournaments/${id}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Tournament
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Tournament</h1>
          <p className="text-gray-600 mt-1">{tournament.name}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-sm font-medium rounded-full border ${
            tournament.status === 'active' 
              ? 'bg-green-100 text-green-800 border-green-200'
              : tournament.status === 'registration'
              ? 'bg-blue-100 text-blue-800 border-blue-200'
              : tournament.status === 'completed'
              ? 'bg-gray-100 text-gray-800 border-gray-200'
              : 'bg-yellow-100 text-yellow-800 border-yellow-200'
          }`}>
            {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
          </span>
          {getStatusActions()}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'contestants', label: 'Contestants', icon: Users },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'bracket', label: 'Bracket', icon: Trophy },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <ErrorRecovery>
        <div className="min-h-96">
          {activeTab === 'contestants' && (
            <ContestantManagement 
              tournament={tournament}
              onRefresh={refresh}
              showAddForm={showAddContestant}
              onToggleAddForm={setShowAddContestant}
            />
          )}
          {activeTab === 'settings' && (
            <TournamentSettings 
              tournament={tournament}
              onRefresh={refresh}
            />
          )}
          {activeTab === 'bracket' && (
            <BracketManagement 
              tournament={tournament}
              onRefresh={refresh}
            />
          )}
        </div>
      </ErrorRecovery>
    </div>
  );
};

// Contestant Management Component
const ContestantManagement: React.FC<{
  tournament: any;
  onRefresh: () => void;
  showAddForm: boolean;
  onToggleAddForm: (show: boolean) => void;
}> = ({ tournament, onRefresh, showAddForm, onToggleAddForm }) => {
  const [contestants, setContestants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingContestant, setEditingContestant] = useState<string | null>(null);
  const [editSeed, setEditSeed] = useState<number>(1);

  const fetchContestants = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ContestantService.getContestants(tournament.id);
      setContestants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contestants');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchContestants();
  }, [tournament.id]);

  const handleAddContestant = async (contestantData: CreateContestantData, imageFile?: File) => {
    try {
      setLoading(true);
      await ContestantService.createContestant(tournament.id, contestantData, imageFile);
      await fetchContestants();
      onRefresh();
      onToggleAddForm(false);
    } catch (error) {
      console.error('Error adding contestant:', error);
      setError(error instanceof Error ? error.message : 'Failed to add contestant');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContestant = async (contestantId: string) => {
    if (!window.confirm('Are you sure you want to delete this contestant?')) return;
    
    try {
      setLoading(true);
      await ContestantService.deleteContestant(contestantId);
      await fetchContestants();
      onRefresh();
    } catch (error) {
      console.error('Error deleting contestant:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete contestant');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSeed = async (contestantId: string, newSeed: number) => {
    try {
      setLoading(true);
      await ContestantService.updateContestantSeeds(tournament.id, [{ id: contestantId, seed: newSeed }]);
      await fetchContestants();
      onRefresh();
      setEditingContestant(null);
    } catch (error) {
      console.error('Error updating contestant seed:', error);
      setError(error instanceof Error ? error.message : 'Failed to update seed');
    } finally {
      setLoading(false);
    }
  };


  if (loading && contestants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Contestants</h2>
          <p className="text-gray-600">
            {contestants.length}/{tournament.max_contestants} contestants added
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => onToggleAddForm(!showAddForm)}
            className="flex items-center gap-2"
            disabled={contestants.length >= tournament.max_contestants}
          >
            <Plus className="w-4 h-4" />
            Add Contestant
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Add Contestant Form */}
      {showAddForm && (
        <AddContestantForm
          onSubmit={handleAddContestant}
          onCancel={() => onToggleAddForm(false)}
          loading={loading}
        />
      )}

      {/* Contestants List */}
      {contestants.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contestants yet</h3>
          <p className="text-gray-600 mb-4">
            Add contestants to your tournament to get started.
          </p>
          <Button 
            onClick={() => onToggleAddForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Contestant
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contestants.map((contestant, index) => (
            <div key={contestant.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {contestant.image_url ? (
                      <img
                        src={contestant.image_url}
                        alt={contestant.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                        <Image className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{contestant.name}</h3>
                    {editingContestant === contestant.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          value={editSeed}
                          onChange={(e) => setEditSeed(parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1 text-xs border rounded"
                          min="1"
                          max="999"
                        />
                        <button
                          onClick={() => handleUpdateSeed(contestant.id, editSeed)}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingContestant(null)}
                          className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        <p>Seed #{contestant.seed || index + 1}</p>
                        <p>Quadrant {contestant.quadrant || 1}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      setEditingContestant(contestant.id);
                      setEditSeed(contestant.seed || 1);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Edit seed position"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteContestant(contestant.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {contestant.description && (
                <p className="text-sm text-gray-600">{contestant.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Add Contestant Form Component
const AddContestantForm: React.FC<{
  onSubmit: (data: CreateContestantData, imageFile?: File) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState<CreateContestantData>({
    name: '',
    description: '',
    seed: 1,
    quadrant: 1,
  });
  const [imageFile, setImageFile] = useState<File | undefined>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onSubmit(formData, imageFile);
    }
  };

  return (
    <div className="card p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Contestant</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input-field mt-1"
            placeholder="Enter contestant name"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="input-field mt-1"
            rows={3}
            placeholder="Optional description..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Seed *</label>
            <input
              type="number"
              value={formData.seed}
              onChange={(e) => setFormData({ ...formData, seed: parseInt(e.target.value) || 1 })}
              className="input-field mt-1"
              min="1"
              max="999"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Quadrant</label>
            <select
              value={formData.quadrant || 1}
              onChange={(e) => setFormData({ ...formData, quadrant: parseInt(e.target.value) as 1 | 2 | 3 | 4 })}
              className="input-field mt-1"
            >
              <option value={1}>Quadrant 1 (Top Left)</option>
              <option value={2}>Quadrant 2 (Top Right)</option>
              <option value={3}>Quadrant 3 (Bottom Left)</option>
              <option value={4}>Quadrant 4 (Bottom Right)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Note: Quadrant assignment coming soon</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0])}
            className="input-field mt-1"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !formData.name.trim()}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Contestant
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

// Placeholder components for other tabs
const TournamentSettings: React.FC<{ tournament: any; onRefresh: () => void }> = ({ tournament }) => (
  <div className="space-y-6">
    <h2 className="text-xl font-semibold text-gray-900">Tournament Settings</h2>
    <div className="card p-6">
      <p className="text-gray-600">Tournament settings will be implemented here.</p>
    </div>
  </div>
);

const BracketManagement: React.FC<{ tournament: any; onRefresh: () => void }> = ({ tournament, onRefresh }) => {
  const [contestants, setContestants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContestants = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ContestantService.getContestants(tournament.id);
      setContestants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contestants');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchContestants();
  }, [tournament.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <Button onClick={fetchContestants} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Bracket Visualization</h2>
          <p className="text-gray-600">
            Visual representation of tournament bracket with {contestants.length} contestants
          </p>
        </div>
      </div>
      
      <BracketView contestants={contestants} tournament={tournament} />
    </div>
  );
};

export default ManageTournament;