import React from 'react';
import { Contestant } from '@/types';
import { Image } from 'lucide-react';

interface BracketViewProps {
  contestants: Contestant[];
  tournament: any;
}

const BracketView: React.FC<BracketViewProps> = ({ contestants, tournament }) => {
  // Guard against undefined contestants
  if (!contestants || !Array.isArray(contestants)) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading bracket data...</p>
      </div>
    );
  }

  // Group contestants by quadrant
  const quadrants = {
    1: contestants.filter(c => c.quadrant === 1).sort((a, b) => a.seed - b.seed),
    2: contestants.filter(c => c.quadrant === 2).sort((a, b) => a.seed - b.seed),
    3: contestants.filter(c => c.quadrant === 3).sort((a, b) => a.seed - b.seed),
    4: contestants.filter(c => c.quadrant === 4).sort((a, b) => a.seed - b.seed),
  };

  const ContestantCard: React.FC<{ contestant: Contestant; position: 'left' | 'right' }> = ({ 
    contestant, 
    position 
  }) => (
    <div className={`flex items-center gap-2 p-2 bg-white border rounded-lg shadow-sm ${
      position === 'right' ? 'flex-row-reverse' : ''
    }`}>
      <div className="flex-shrink-0">
        {contestant.image_url ? (
          <img
            src={contestant.image_url}
            alt={contestant.name}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <Image className="w-4 h-4 text-gray-400" />
          </div>
        )}
      </div>
      <div className={`flex-1 ${position === 'right' ? 'text-right' : ''}`}>
        <div className="font-medium text-sm text-gray-900 truncate">{contestant.name}</div>
        <div className="text-xs text-gray-500">#{contestant.seed}</div>
      </div>
    </div>
  );

  const QuadrantBracket: React.FC<{ 
    quadrant: number; 
    contestants: Contestant[]; 
    title: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  }> = ({ quadrant, contestants, title, position }) => {
    const isLeft = position.includes('left');
    const isTop = position.includes('top');
    
    return (
      <div className={`p-4 ${isLeft ? 'border-r' : 'border-l'} ${isTop ? 'border-b' : 'border-t'} border-gray-200`}>
        <div className={`text-center mb-4 ${isLeft ? 'text-left' : 'text-right'}`}>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{contestants.length} contestants</p>
        </div>
        
        <div className="space-y-3">
          {contestants.map((contestant, index) => (
            <div key={contestant.id} className="relative">
              <ContestantCard 
                contestant={contestant} 
                position={isLeft ? 'left' : 'right'} 
              />
              
              {/* Connection line to next round (improved positioning) */}
              {index % 2 === 0 && index + 1 < contestants.length && (
                <div className="absolute top-1/2 transform -translate-y-1/2" style={{
                  [isLeft ? 'right' : 'left']: '-16px',
                  width: '16px',
                  height: '2px'
                }}>
                  <div className="w-full h-0.5 bg-gray-300"></div>
                  <div className={`absolute ${isLeft ? 'right' : 'left'}-0 top-0 w-0.5 bg-gray-300`} style={{
                    height: '48px',
                    [isTop ? 'top' : 'bottom']: '0'
                  }}></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (contestants.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <div className="text-gray-500 mb-2">No contestants in bracket yet</div>
        <p className="text-sm text-gray-400">Add contestants to see the bracket visualization</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Tournament Banner Image */}
      {tournament.image_url && (
        <div className="relative w-full h-32 overflow-hidden bg-gray-100">
          <img
            src={tournament.image_url}
            alt={tournament.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30"></div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
            <h2 className="text-xl font-semibold text-white">Tournament Bracket</h2>
            <p className="text-sm text-white/90 mt-1">
              {contestants.length} contestants across 4 quadrants
            </p>
          </div>
        </div>
      )}

      {/* Header (for tournaments without banner image) */}
      {!tournament.image_url && (
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">Tournament Bracket</h2>
          <p className="text-sm text-gray-600 mt-1">
            {contestants.length} contestants across 4 quadrants
          </p>
        </div>
      )}
      
      {/* Bracket container with relative positioning for absolute children */}
      <div className="relative min-h-96">
        <div className="grid grid-cols-2 grid-rows-2 h-full">
          {/* Quadrant 1 - Top Left */}
          <QuadrantBracket
            quadrant={1}
            contestants={quadrants[1]}
            title={tournament.quadrant_names?.[0] || "Quadrant 1"}
            position="top-left"
          />
          
          {/* Quadrant 2 - Top Right */}
          <QuadrantBracket
            quadrant={2}
            contestants={quadrants[2]}
            title={tournament.quadrant_names?.[1] || "Quadrant 2"}
            position="top-right"
          />
          
          {/* Quadrant 3 - Bottom Left */}
          <QuadrantBracket
            quadrant={3}
            contestants={quadrants[3]}
            title={tournament.quadrant_names?.[2] || "Quadrant 3"}
            position="bottom-left"
          />
          
          {/* Quadrant 4 - Bottom Right */}
          <QuadrantBracket
            quadrant={4}
            contestants={quadrants[4]}
            title={tournament.quadrant_names?.[3] || "Quadrant 4"}
            position="bottom-right"
          />
        </div>
        
        {/* Center Championship Area - Fixed positioning */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-4 shadow-lg pointer-events-auto z-10">
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-800">Championship</div>
              <div className="text-sm text-yellow-600">Final match here</div>
            </div>
          </div>
        </div>

        {/* Central bracket connection lines */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Horizontal lines connecting quadrants to center */}
          <div className="absolute top-1/2 left-1/4 w-1/4 h-0.5 bg-gray-300 transform -translate-y-0.5"></div>
          <div className="absolute top-1/2 right-1/4 w-1/4 h-0.5 bg-gray-300 transform -translate-y-0.5"></div>
          
          {/* Vertical lines connecting quadrants to center */}
          <div className="absolute left-1/2 top-1/4 w-0.5 h-1/4 bg-gray-300 transform -translate-x-0.5"></div>
          <div className="absolute left-1/2 bottom-1/4 w-0.5 h-1/4 bg-gray-300 transform -translate-x-0.5"></div>
        </div>
      </div>
    </div>
  );
};

export default BracketView;