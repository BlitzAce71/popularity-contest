/**
 * Utility functions for managing application settings
 */

export interface AppSettings {
  siteName: string;
  defaultTournamentFormat: string;
  allowPublicRegistration: boolean;
  requireEmailVerification: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  siteName: 'Popularity Contest',
  defaultTournamentFormat: 'single-elimination',
  allowPublicRegistration: true,
  requireEmailVerification: true,
};

/**
 * Get all settings from localStorage with fallback to defaults
 */
export const getSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem('admin_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return DEFAULT_SETTINGS;
};

/**
 * Get just the site name from settings
 */
export const getSiteName = (): string => {
  return getSettings().siteName;
};

/**
 * Save settings to localStorage
 */
export const saveSettings = (settings: Partial<AppSettings>): void => {
  try {
    const current = getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem('admin_settings', JSON.stringify(updated));
    
    // Dispatch custom event to notify components of settings change
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: updated }));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw new Error('Failed to save settings');
  }
};