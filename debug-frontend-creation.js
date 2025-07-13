// Add this debugging code temporarily to CreateTournament.tsx 
// to see what the service is actually returning

// Around line 104, after const newTournament = await Promise.race([createPromise, timeoutPromise]);
// Add these console.log statements:

console.log('🔍 DEBUG: Full newTournament object:', newTournament);
console.log('🔍 DEBUG: newTournament.id:', newTournament?.id);
console.log('🔍 DEBUG: newTournament.slug:', newTournament?.slug);
console.log('🔍 DEBUG: newTournament.name:', newTournament?.name);
console.log('🔍 DEBUG: Object.keys(newTournament):', Object.keys(newTournament || {}));

// Then check if slug exists before using it:
if (newTournament?.slug) {
  console.log('✅ Using slug for navigation:', newTournament.slug);
  navigate(`/tournaments/${newTournament.slug}`);
} else {
  console.log('⚠️ No slug found, falling back to ID:', newTournament?.id);
  navigate(`/tournaments/${newTournament?.id}`);
}