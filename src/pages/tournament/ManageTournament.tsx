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
  const [editingContestant, setEditingContestant] = useState<any | null>(null);

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

  const handleUpdateContestant = async (contestantData: CreateContestantData, imageFile?: File) => {
    if (!editingContestant) return;
    
    try {
      setLoading(true);
      await ContestantService.updateContestant(editingContestant.id, contestantData, imageFile);
      await fetchContestants();
      onRefresh();
      setEditingContestant(null);
    } catch (error) {
      console.error('Error updating contestant:', error);
      setError(error instanceof Error ? error.message : 'Failed to update contestant');
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
          contestants={contestants}
          tournament={tournament}
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
                    <div className="text-sm text-gray-500">
                      <p>Seed #{contestant.seed || index + 1}</p>
                      <p>{tournament.quadrant_names?.[contestant.quadrant - 1] || `Quadrant ${contestant.quadrant || 1}`}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setEditingContestant(contestant)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Edit contestant"
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

      {/* Edit Contestant Modal */}
      {editingContestant && (
        <EditContestantModal
          contestant={editingContestant}
          tournament={tournament}
          contestants={contestants}
          onSubmit={handleUpdateContestant}
          onCancel={() => setEditingContestant(null)}
          loading={loading}
        />
      )}
    </div>
  );
};

// Add Contestant Form Component
const AddContestantForm: React.FC<{
  onSubmit: (data: CreateContestantData, imageFile?: File) => void;
  onCancel: () => void;
  loading: boolean;
  contestants: any[];
  tournament: any;
}> = ({ onSubmit, onCancel, loading, contestants, tournament }) => {
  // Calculate next available seed for selected quadrant (capped at max seeds per quadrant)
  const getNextSeedForQuadrant = (quadrant: number) => {
    const maxSeedsPerQuadrant = Math.ceil(tournament.max_contestants / 4); // 1/4 of total participants
    const quadrantContestants = contestants.filter(c => c.quadrant === quadrant);
    if (quadrantContestants.length === 0) return 1;
    const usedSeeds = new Set(quadrantContestants.map(c => c.seed));
    let nextSeed = 1;
    while (usedSeeds.has(nextSeed) && nextSeed <= maxSeedsPerQuadrant) {
      nextSeed++;
    }
    // If we've exceeded the max seeds per quadrant, return the max + 1 (will show warning)
    return nextSeed <= maxSeedsPerQuadrant ? nextSeed : maxSeedsPerQuadrant + 1;
  };

  const [formData, setFormData] = useState<CreateContestantData>({
    name: '',
    description: '',
    seed: 1,
    quadrant: 1,
  });
  const [imageFile, setImageFile] = useState<File | undefined>();

  // Update seed when quadrant changes or contestants change
  React.useEffect(() => {
    setFormData(prev => ({ 
      ...prev, 
      seed: getNextSeedForQuadrant(prev.quadrant || 1) 
    }));
  }, [contestants.length, formData.quadrant]);

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
            <p className="text-xs text-gray-500 mt-1">
              {(() => {
                const maxSeedsPerQuadrant = Math.ceil(tournament.max_contestants / 4);
                const nextSeed = getNextSeedForQuadrant(formData.quadrant || 1);
                const seedTaken = contestants.some(c => c.seed === formData.seed && c.quadrant === formData.quadrant);
                const seedTooHigh = formData.seed > maxSeedsPerQuadrant;
                
                if (seedTaken) {
                  return '⚠️ This seed is already taken in this quadrant - will auto-assign next available';
                } else if (seedTooHigh) {
                  return `⚠️ Max seed for this quadrant is ${maxSeedsPerQuadrant} (${tournament.max_contestants} participants ÷ 4 quadrants)`;
                } else if (nextSeed > maxSeedsPerQuadrant) {
                  return `⚠️ This quadrant is full (max ${maxSeedsPerQuadrant} seeds)`;
                } else {
                  return `Next suggested: ${nextSeed} (max ${maxSeedsPerQuadrant} per quadrant)`;
                }
              })()}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Quadrant</label>
            <select
              value={formData.quadrant || 1}
              onChange={(e) => {
                const newQuadrant = parseInt(e.target.value) as 1 | 2 | 3 | 4;
                setFormData({ 
                  ...formData, 
                  quadrant: newQuadrant,
                  seed: getNextSeedForQuadrant(newQuadrant)
                });
              }}
              className="input-field mt-1"
            >
              {(tournament.quadrant_names || ['Region A', 'Region B', 'Region C', 'Region D']).map((name, index) => (
                <option key={index + 1} value={index + 1}>
                  {name} (Quadrant {index + 1})
                </option>
              ))}
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

// Tournament Settings Component
const TournamentSettings: React.FC<{ tournament: any; onRefresh: () => void }> = ({ tournament, onRefresh }) => {
  const navigate = useNavigate();
  const [quadrantNames, setQuadrantNames] = useState<[string, string, string, string]>(
    tournament.quadrant_names || ['Region A', 'Region B', 'Region C', 'Region D']
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveQuadrantNames = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await TournamentService.updateTournament(tournament.id, {
        quadrant_names: quadrantNames
      });
      
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quadrant names');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTournament = async () => {
    const confirmMessage = `Are you sure you want to delete "${tournament.name}"?\n\nThis action cannot be undone. All contestants, matches, and votes will be permanently removed.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    const finalConfirm = window.confirm('This is your final warning. Type "DELETE" in the next prompt to confirm.');
    if (!finalConfirm) return;
    
    const userInput = window.prompt('Type "DELETE" (in capital letters) to confirm deletion:');
    if (userInput !== 'DELETE') {
      alert('Deletion cancelled - you must type "DELETE" exactly.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      await TournamentService.deleteTournament(tournament.id);
      
      // Navigate to tournaments list after successful deletion
      navigate('/tournaments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tournament');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Tournament Settings</h2>
      
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Bracket Quadrant Names</h3>
        <p className="text-sm text-gray-600 mb-6">
          Customize the names of your tournament's four quadrants/regions. These names will be shown 
          when contestants select their quadrant placement.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quadrant 1 (Top Left)
            </label>
            <input
              type="text"
              value={quadrantNames[0]}
              onChange={(e) => setQuadrantNames([e.target.value, quadrantNames[1], quadrantNames[2], quadrantNames[3]])}
              className="input-field"
              placeholder="e.g., Region A, North Division, etc."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quadrant 2 (Top Right)
            </label>
            <input
              type="text"
              value={quadrantNames[1]}
              onChange={(e) => setQuadrantNames([quadrantNames[0], e.target.value, quadrantNames[2], quadrantNames[3]])}
              className="input-field"
              placeholder="e.g., Region B, South Division, etc."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quadrant 3 (Bottom Left)
            </label>
            <input
              type="text"
              value={quadrantNames[2]}
              onChange={(e) => setQuadrantNames([quadrantNames[0], quadrantNames[1], e.target.value, quadrantNames[3]])}
              className="input-field"
              placeholder="e.g., Region C, East Division, etc."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quadrant 4 (Bottom Right)
            </label>
            <input
              type="text"
              value={quadrantNames[3]}
              onChange={(e) => setQuadrantNames([quadrantNames[0], quadrantNames[1], quadrantNames[2], e.target.value])}
              className="input-field"
              placeholder="e.g., Region D, West Division, etc."
            />
          </div>
        </div>

        <Button
          onClick={handleSaveQuadrantNames}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" />
              Saving...
            </>
          ) : (
            'Save Quadrant Names'
          )}
        </Button>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Danger Zone</h3>
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h4 className="text-sm font-medium text-red-800 mb-2">Delete Tournament</h4>
          <p className="text-sm text-red-600 mb-4">
            Once you delete a tournament, there is no going back. This action cannot be undone.
            All contestants, matches, and votes will be permanently removed.
          </p>
          <Button
            onClick={() => handleDeleteTournament()}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Delete Tournament
          </Button>
        </div>
      </div>
    </div>
  );
};

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

// Edit Contestant Modal Component
const EditContestantModal: React.FC<{
  contestant: any;
  tournament: any;
  contestants: any[];
  onSubmit: (data: CreateContestantData, imageFile?: File) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ contestant, tournament, contestants, onSubmit, onCancel, loading }) => {
  // Calculate next available seed for selected quadrant (excluding current contestant, capped at max seeds per quadrant)
  const getNextSeedForQuadrant = (quadrant: number) => {
    const maxSeedsPerQuadrant = Math.ceil(tournament.max_contestants / 4); // 1/4 of total participants
    const quadrantContestants = contestants.filter(c => c.quadrant === quadrant && c.id !== contestant.id);
    if (quadrantContestants.length === 0) return 1;
    const usedSeeds = new Set(quadrantContestants.map(c => c.seed));
    let nextSeed = 1;
    while (usedSeeds.has(nextSeed) && nextSeed <= maxSeedsPerQuadrant) {
      nextSeed++;
    }
    // If we've exceeded the max seeds per quadrant, return the max + 1 (will show warning)
    return nextSeed <= maxSeedsPerQuadrant ? nextSeed : maxSeedsPerQuadrant + 1;
  };

  const [formData, setFormData] = useState<CreateContestantData>({
    name: contestant.name || '',
    description: contestant.description || '',
    seed: contestant.seed || 1,
    quadrant: contestant.quadrant || 1,
  });
  const [imageFile, setImageFile] = useState<File | undefined>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onSubmit(formData, imageFile);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Edit Contestant</h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>

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
                disabled={loading}
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
                disabled={loading}
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
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const maxSeedsPerQuadrant = Math.ceil(tournament.max_contestants / 4);
                    const nextSeed = getNextSeedForQuadrant(formData.quadrant || 1);
                    const seedTaken = contestants.some(c => c.seed === formData.seed && c.quadrant === formData.quadrant && c.id !== contestant.id);
                    const seedTooHigh = formData.seed > maxSeedsPerQuadrant;
                    
                    if (seedTaken) {
                      return `⚠️ Seed ${formData.seed} is already taken in this quadrant`;
                    } else if (seedTooHigh) {
                      return `⚠️ Max seed for this quadrant is ${maxSeedsPerQuadrant} (${tournament.max_contestants} participants ÷ 4 quadrants)`;
                    } else if (nextSeed > maxSeedsPerQuadrant) {
                      return `⚠️ This quadrant is full (max ${maxSeedsPerQuadrant} seeds)`;
                    } else {
                      return `Next available: ${nextSeed} (max ${maxSeedsPerQuadrant} per quadrant)`;
                    }
                  })()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quadrant</label>
                <select
                  value={formData.quadrant || 1}
                  onChange={(e) => {
                    const newQuadrant = parseInt(e.target.value) as 1 | 2 | 3 | 4;
                    setFormData({ 
                      ...formData, 
                      quadrant: newQuadrant,
                      seed: getNextSeedForQuadrant(newQuadrant)
                    });
                  }}
                  className="input-field mt-1"
                  disabled={loading}
                >
                  {(tournament.quadrant_names || ['Region A', 'Region B', 'Region C', 'Region D']).map((name, index) => (
                    <option key={index + 1} value={index + 1}>
                      {name} (Quadrant {index + 1})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Update Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0])}
                className="input-field mt-1"
                disabled={loading}
              />
              {contestant.image_url && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Current image:</p>
                  <img
                    src={contestant.image_url}
                    alt={contestant.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
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
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Update Contestant
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ManageTournament;