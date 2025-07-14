import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTournament } from '@/hooks/tournaments/useTournament';
import { useAuth } from '@/contexts/AuthContext';
import { ContestantService } from '@/services/contestants';
import { TournamentService } from '@/services/tournaments';
import { AdminService } from '@/services/admin';
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
  Image,
  FastForward,
  AlertTriangle
} from 'lucide-react';
import { CreateContestantData } from '@/types';

const ManageTournament: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'contestants' | 'settings'>('settings');
  const [showAddContestant, setShowAddContestant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [forceAdvancing, setForceAdvancing] = useState(false);

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
        <Link to={`/tournaments/${tournament?.slug}`}>
          <Button variant="outline">Back to Tournament</Button>
        </Link>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    console.log(`🔄 handleStatusChange called with status: ${newStatus}`);
    console.log(`🔄 Tournament ID: ${id}`);
    console.log(`🔄 Current tournament status: ${tournament?.status}`);
    
    if (!id) {
      console.log('❌ No tournament ID, returning early');
      return;
    }
    
    try {
      console.log('🔄 Setting status loading to true');
      setStatusLoading(true);
      
      // If we're starting the tournament (draft -> active), generate the bracket first
      if (newStatus === 'active' && tournament?.status === 'draft') {
        console.log('🔄 Starting tournament - calling TournamentService.startTournament');
        await TournamentService.startTournament(id);
        console.log('✅ TournamentService.startTournament completed');
        
        // Explicitly update the status to active after starting the tournament
        console.log('🔄 Updating tournament status to active');
        await TournamentService.updateTournamentStatus(id, 'active');
        console.log('✅ Tournament status updated to active');
      } else {
        console.log(`🔄 Updating tournament status to ${newStatus}`);
        await TournamentService.updateTournamentStatus(id, newStatus as any);
        console.log(`✅ Tournament status updated to ${newStatus}`);
      }
      
      // Refresh and verify the change took effect
      console.log('🔄 Refreshing tournament data');
      refresh();
      
      // Check if the status actually changed after a brief delay
      setTimeout(async () => {
        try {
          const updatedTournament = await TournamentService.getTournament(id);
          if (updatedTournament.status !== newStatus) {
            console.error('Tournament status change failed - possible authentication issue');
            alert('Failed to update tournament status. Please make sure you are logged in and have permission to manage this tournament.');
          }
        } catch (verifyError) {
          console.error('Error verifying status change:', verifyError);
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error updating tournament status:', error);
      alert(`Failed to update tournament status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('🔄 Setting status loading to false');
      setStatusLoading(false);
    }
  };

  const handleForceAdvanceRound = async () => {
    if (!id || !user?.is_admin) return;
    
    const confirmMessage = `Force advance to next round?\n\nThis will:\n• Declare winners for all active matchups based on current vote leaders\n• Automatically resolve any ties (ties go to first contestant)\n• Advance the tournament to the next round\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      setForceAdvancing(true);
      
      const result = await AdminService.forceAdvanceRound(id);
      
      if (result.success) {
        alert(`Round advanced successfully!\n\n• ${result.winnersDeclared} winners declared\n• ${result.tiesResolved} ties resolved\n\n${result.message}`);
        refresh();
      } else {
        throw new Error(result.error || 'Failed to advance round');
      }
    } catch (error) {
      console.error('Error force advancing round:', error);
      alert(`Failed to advance round: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setForceAdvancing(false);
    }
  };

  const handleGenerateDummyContestants = async () => {
    if (!id || !tournament) return;
    
    const confirmMessage = `Generate ${tournament.max_contestants} dummy contestants?\n\nThis will create contestants named A1, A2, B1, B2, etc. based on your quadrant names.\n\nThis action will clear any existing contestants first.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      setLoading(true);
      
      // Use default quadrant names since we might not have them stored
      const quadrantNames: [string, string, string, string] = ['A', 'B', 'C', 'D'];
      
      await ContestantService.generateDummyContestants(
        id,
        tournament.max_contestants,
        quadrantNames
      );
      
      alert(`Successfully generated ${tournament.max_contestants} dummy contestants!`);
      refresh();
    } catch (error) {
      console.error('Error generating dummy contestants:', error);
      alert(`Failed to generate contestants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusActions = () => {
    switch (tournament.status) {
      case 'draft':
      case 'registration':
        return (
          <Button 
            onClick={(e) => {
              console.log('🖱️🖱️🖱️ START TOURNAMENT BUTTON CLICKED!!! 🖱️🖱️🖱️');
              console.log('🖱️ Event object:', e);
              console.log('🖱️ Button element:', e.target);
              console.log(`🖱️ Button disabled state: ${statusLoading || (tournament.current_contestants || 0) < 2}`);
              console.log(`🖱️ statusLoading: ${statusLoading}`);
              console.log(`🖱️ current_contestants: ${tournament.current_contestants}`);
              e.preventDefault();
              e.stopPropagation();
              console.log('🖱️ About to call handleStatusChange');
              handleStatusChange('active');
            }}
            onMouseDown={() => console.log('🖱️ Mouse down on Start Tournament button')}
            onMouseUp={() => console.log('🖱️ Mouse up on Start Tournament button')}
            disabled={statusLoading || (tournament.current_contestants || 0) < 2}
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start Tournament
          </Button>
        );
      case 'active':
        return (
          <div className="flex items-center gap-2">
            {user?.is_admin && (
              <Button 
                onClick={handleForceAdvanceRound}
                disabled={forceAdvancing || loading}
                variant="outline"
                className="flex items-center gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                {forceAdvancing ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Advancing...
                  </>
                ) : (
                  <>
                    <FastForward className="w-4 h-4" />
                    Force Advance Round
                  </>
                )}
              </Button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tournament Banner Image */}
      {tournament.image_url && (
        <div className="relative w-full h-48 md:h-64 overflow-hidden rounded-lg bg-gray-100">
          <img
            src={tournament.image_url}
            alt={tournament.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30"></div>
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Manage Tournament</h1>
                <p className="text-white/90 text-lg">{tournament.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full border bg-white/90 text-gray-800 border-white/20`}>
                  {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                </span>
                {getStatusActions()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header (for tournaments without banner image) */}
      {!tournament.image_url && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/tournaments/${tournament?.slug}`}
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
        </>
      )}

      {/* Navigation (for tournaments with banner image) */}
      {tournament.image_url && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/tournaments/${tournament?.slug}`}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Tournament
            </Link>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'settings', label: 'Settings', icon: Settings },
              { id: 'contestants', label: 'Contestants', icon: Users },
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
          
          {/* Vote Button */}
          {tournament.status === 'active' && (
            <Link to={`/tournaments/${tournament?.slug}`}>
              <Button variant="outline" className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Vote on Tournament
              </Button>
            </Link>
          )}
        </div>
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
              onGenerateDummyContestants={handleGenerateDummyContestants}
            />
          )}
          {activeTab === 'settings' && (
            <TournamentSettings 
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
  onGenerateDummyContestants: () => void;
}> = ({ tournament, onRefresh, showAddForm, onToggleAddForm, onGenerateDummyContestants }) => {
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
          
          <Button
            onClick={onGenerateDummyContestants}
            variant="outline"
            className="flex items-center gap-2"
            disabled={loading}
          >
            <Users className="w-4 h-4" />
            Generate Dummy Contestants
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
          {contestants
            .sort((a, b) => {
              // Sort by quadrant first, then by seed (both ascending)
              if (a.quadrant !== b.quadrant) {
                return (a.quadrant || 1) - (b.quadrant || 1);
              }
              return (a.seed || 0) - (b.seed || 0);
            })
            .map((contestant, index) => (
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
  // Calculate next available seed and quadrant globally (across all quadrants)
  const getNextAvailableSeedAndQuadrant = () => {
    const maxSeedsPerQuadrant = Math.ceil(tournament.max_contestants / 4);
    
    // For each seed level (1, 2, 3, etc.), check all quadrants before moving to next seed
    for (let seed = 1; seed <= maxSeedsPerQuadrant; seed++) {
      for (let quadrant = 1; quadrant <= 4; quadrant++) {
        const isSlotTaken = contestants.some(c => c.seed === seed && c.quadrant === quadrant);
        if (!isSlotTaken) {
          return { seed, quadrant };
        }
      }
    }
    
    // All slots are full, return next available (will show warning)
    return { seed: maxSeedsPerQuadrant + 1, quadrant: 1 };
  };

  // Calculate next available seed for selected quadrant (capped at max seeds per quadrant)
  const getNextSeedForQuadrant = (quadrant: number) => {
    const maxSeedsPerQuadrant = Math.ceil(tournament.max_contestants / 4);
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

  const [formData, setFormData] = useState<CreateContestantData>(() => {
    const nextAvailable = getNextAvailableSeedAndQuadrant();
    return {
      name: '',
      description: '',
      seed: nextAvailable.seed,
      quadrant: nextAvailable.quadrant,
    };
  });
  const [imageFile, setImageFile] = useState<File | undefined>();

  // Update seed and quadrant when contestants change
  React.useEffect(() => {
    const nextAvailable = getNextAvailableSeedAndQuadrant();
    setFormData(prev => ({ 
      ...prev, 
      seed: nextAvailable.seed,
      quadrant: nextAvailable.quadrant
    }));
  }, [contestants.length]);

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
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Seed *</label>
              <button
                type="button"
                onClick={() => {
                  const nextAvailable = getNextAvailableSeedAndQuadrant();
                  setFormData(prev => ({ 
                    ...prev, 
                    seed: nextAvailable.seed,
                    quadrant: nextAvailable.quadrant
                  }));
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Use next available
              </button>
            </div>
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
                const nextAvailable = getNextAvailableSeedAndQuadrant();
                const nextSeedInQuadrant = getNextSeedForQuadrant(formData.quadrant || 1);
                const seedTaken = contestants.some(c => c.seed === formData.seed && c.quadrant === formData.quadrant);
                const seedTooHigh = formData.seed > maxSeedsPerQuadrant;
                const isCurrentSeedNextAvailable = formData.seed === nextAvailable.seed && formData.quadrant === nextAvailable.quadrant;
                
                if (seedTaken) {
                  return '⚠️ This seed is already taken in this quadrant - will auto-assign next available';
                } else if (seedTooHigh) {
                  return `⚠️ Max seed for this quadrant is ${maxSeedsPerQuadrant} (${tournament.max_contestants} participants ÷ 4 quadrants)`;
                } else if (nextSeedInQuadrant > maxSeedsPerQuadrant) {
                  return `⚠️ This quadrant is full (max ${maxSeedsPerQuadrant} seeds)`;
                } else if (isCurrentSeedNextAvailable) {
                  return `✅ Next available globally: Seed ${nextAvailable.seed}, ${tournament.quadrant_names?.[nextAvailable.quadrant - 1] || `Quadrant ${nextAvailable.quadrant}`}`;
                } else {
                  return `Next in this quadrant: ${nextSeedInQuadrant} | Next globally: Seed ${nextAvailable.seed}, ${tournament.quadrant_names?.[nextAvailable.quadrant - 1] || `Quadrant ${nextAvailable.quadrant}`}`;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | undefined>();
  
  // Form state for all editable fields
  const [formData, setFormData] = useState({
    name: tournament.name || '',
    description: tournament.description || '',
    image_url: tournament.image_url || '',
    start_date: tournament.start_date ? tournament.start_date.split('T')[0] : '',
    end_date: tournament.end_date ? tournament.end_date.split('T')[0] : '',
    max_contestants: tournament.max_contestants || 16,
    bracket_type: tournament.bracket_type || 'single-elimination',
    is_public: tournament.is_public ?? true,
    quadrant_names: tournament.quadrant_names || ['Region A', 'Region B', 'Region C', 'Region D']
  });

  // Reset form data when tournament changes
  React.useEffect(() => {
    setFormData({
      name: tournament.name || '',
      description: tournament.description || '',
      image_url: tournament.image_url || '',
      start_date: tournament.start_date ? tournament.start_date.split('T')[0] : '',
      end_date: tournament.end_date ? tournament.end_date.split('T')[0] : '',
      max_contestants: tournament.max_contestants || 16,
      bracket_type: tournament.bracket_type || 'single-elimination',
      is_public: tournament.is_public ?? true,
      quadrant_names: tournament.quadrant_names || ['Region A', 'Region B', 'Region C', 'Region D']
    });
  }, [tournament]);

  const handleSaveTournament = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Prepare update data
      const updateData: any = {
        name: formData.name,
        description: formData.description,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        max_contestants: formData.max_contestants,
        bracket_type: formData.bracket_type,
        is_public: formData.is_public,
        quadrant_names: formData.quadrant_names
      };

      // Handle image upload if a new file is selected
      if (imageFile) {
        // For now, just include the image URL field - image upload would need additional implementation
        // This would typically involve uploading to storage service and getting URL
        console.log('Image file selected:', imageFile.name);
        // updateData.image_url = await uploadImageToStorage(imageFile);
      } else if (formData.image_url !== tournament.image_url) {
        updateData.image_url = formData.image_url || null;
      }
      
      await TournamentService.updateTournament(tournament.id, updateData);
      
      setImageFile(undefined);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tournament');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      name: tournament.name || '',
      description: tournament.description || '',
      image_url: tournament.image_url || '',
      start_date: tournament.start_date ? tournament.start_date.split('T')[0] : '',
      end_date: tournament.end_date ? tournament.end_date.split('T')[0] : '',
      max_contestants: tournament.max_contestants || 16,
      bracket_type: tournament.bracket_type || 'single-elimination',
      is_public: tournament.is_public ?? true,
      quadrant_names: tournament.quadrant_names || ['Region A', 'Region B', 'Region C', 'Region D']
    });
    setImageFile(undefined);
    setError(null);
  };

  const handleResetTournament = async () => {
    const confirmMessage = `Are you sure you want to reset "${tournament.name}"?\n\nThis will:\n• Delete all votes and voting results\n• Delete the tournament bracket\n• Reset tournament status to registration\n• Keep all contestants\n\nYou can restart the tournament after resetting.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      setLoading(true);
      setError(null);
      
      await TournamentService.resetTournament(tournament.id);
      
      // Refresh the tournament data
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset tournament');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTournament = async () => {
    const confirmMessage = `Are you sure you want to delete "${tournament.name}"?\n\nThis action cannot be undone. All contestants, matches, and votes will be permanently removed.`;
    
    if (!window.confirm(confirmMessage)) return;
    
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

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
        
        <div className="space-y-6">
          {/* Tournament Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tournament Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="Enter tournament name"
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Describe your tournament..."
              disabled={loading}
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tournament Image URL
            </label>
            <div className="space-y-3">
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="input-field"
                placeholder="https://example.com/image.jpg"
                disabled={loading}
              />
              <div className="text-sm text-gray-500">
                <p>Or upload a new image:</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0])}
                  className="input-field mt-1"
                  disabled={loading}
                />
                {imageFile && (
                  <p className="text-green-600 mt-1">New image selected: {imageFile.name}</p>
                )}
              </div>
              {formData.image_url && (
                <div className="flex items-center gap-3 mt-3 p-3 bg-gray-50 rounded-lg">
                  <img
                    src={formData.image_url}
                    alt="Tournament"
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div>
                    <p className="text-gray-900 font-medium">Current image</p>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{formData.image_url}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="input-field"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date (optional)
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="input-field"
                disabled={loading}
              />
            </div>
          </div>

          {/* Tournament Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Contestants *
              </label>
              <input
                type="number"
                value={formData.max_contestants}
                onChange={(e) => setFormData({ ...formData, max_contestants: parseInt(e.target.value) || 16 })}
                className="input-field"
                min="4"
                max="128"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bracket Type *
              </label>
              <select
                value={formData.bracket_type}
                onChange={(e) => setFormData({ ...formData, bracket_type: e.target.value })}
                className="input-field"
                disabled={loading}
              >
                <option value="single-elimination">Single Elimination</option>
                <option value="double-elimination">Double Elimination</option>
                <option value="round-robin">Round Robin</option>
              </select>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visibility
            </label>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                disabled={loading}
              />
              <label className="ml-2 block text-sm text-gray-700">
                Make this tournament public (visible to all users)
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            Reset Changes
          </Button>
          <Button
            onClick={handleSaveTournament}
            disabled={loading || !formData.name.trim() || !formData.description.trim()}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Bracket Quadrant Names</h3>
        <p className="text-sm text-gray-600 mb-6">
          Customize the names of your tournament's four quadrants/regions. These names will be shown 
          when contestants select their quadrant placement.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quadrant 1 (Top Left)
            </label>
            <input
              type="text"
              value={formData.quadrant_names[0]}
              onChange={(e) => setFormData({ 
                ...formData, 
                quadrant_names: [e.target.value, formData.quadrant_names[1], formData.quadrant_names[2], formData.quadrant_names[3]] 
              })}
              className="input-field"
              placeholder="e.g., Region A, North Division, etc."
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quadrant 2 (Top Right)
            </label>
            <input
              type="text"
              value={formData.quadrant_names[1]}
              onChange={(e) => setFormData({ 
                ...formData, 
                quadrant_names: [formData.quadrant_names[0], e.target.value, formData.quadrant_names[2], formData.quadrant_names[3]] 
              })}
              className="input-field"
              placeholder="e.g., Region B, South Division, etc."
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quadrant 3 (Bottom Left)
            </label>
            <input
              type="text"
              value={formData.quadrant_names[2]}
              onChange={(e) => setFormData({ 
                ...formData, 
                quadrant_names: [formData.quadrant_names[0], formData.quadrant_names[1], e.target.value, formData.quadrant_names[3]] 
              })}
              className="input-field"
              placeholder="e.g., Region C, East Division, etc."
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quadrant 4 (Bottom Right)
            </label>
            <input
              type="text"
              value={formData.quadrant_names[3]}
              onChange={(e) => setFormData({ 
                ...formData, 
                quadrant_names: [formData.quadrant_names[0], formData.quadrant_names[1], formData.quadrant_names[2], e.target.value] 
              })}
              className="input-field"
              placeholder="e.g., Region D, West Division, etc."
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Danger Zone</h3>
        
        {/* Reset Tournament Section */}
        {(tournament.status === 'active' || tournament.status === 'completed') && (
          <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50 mb-4">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">Reset Tournament</h4>
            <p className="text-sm text-yellow-700 mb-4">
              Reset the tournament to start over. This will delete all votes and the bracket, 
              but keep all contestants. The tournament status will be changed back to registration.
              You can then restart the tournament when ready.
            </p>
            <Button
              onClick={() => handleResetTournament()}
              variant="outline"
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Tournament'}
            </Button>
          </div>
        )}

        {/* Delete Tournament Section */}
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
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Tournament'}
          </Button>
        </div>
      </div>
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
                  className="input-field mt-1 bg-gray-100"
                  min="1"
                  max="999"
                  required
                  disabled={true}
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">
                  Seed cannot be edited after contestant creation
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