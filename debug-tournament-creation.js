// Debug script to trace tournament creation
// Run this in browser console when creating a tournament

// Override console.log to capture all messages
const originalLog = console.log;
const logs = [];

console.log = function(...args) {
  logs.push(args.join(' '));
  originalLog.apply(console, args);
};

// Function to show all logged data related to tournament creation
window.showTournamentLogs = function() {
  console.group('Tournament Creation Debug Logs');
  logs.forEach(log => {
    if (log.includes('tournament') || log.includes('quadrant') || log.includes('📝') || log.includes('🚀') || log.includes('📤')) {
      originalLog(log);
    }
  });
  console.groupEnd();
};

// Function to inspect tournament data before submission
window.inspectTournamentData = function(data) {
  originalLog('=== TOURNAMENT DATA INSPECTION ===');
  originalLog('Raw form data:', data);
  originalLog('Quadrant names array:', [
    data.quadrant_1_name,
    data.quadrant_2_name, 
    data.quadrant_3_name,
    data.quadrant_4_name
  ]);
  originalLog('Final tournament data quadrant_names:', data.quadrant_names);
};

originalLog('Debug script loaded. Use showTournamentLogs() and inspectTournamentData() functions.');