import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config';

export interface AppSettings {
  hideOutOfStock: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  hideOutOfStock: false,
};

const SETTINGS_KEY = 'app_settings';
const SETTINGS_TIMESTAMP_KEY = 'app_settings_timestamp';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Load settings from localStorage
export const loadSettingsFromLocal = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
  }
  return DEFAULT_SETTINGS;
};

// Save settings to localStorage with timestamp
export const saveSettingsToLocal = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(SETTINGS_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
};

// Check if cached settings are still valid (less than 1 hour old)
const isCacheValid = (): boolean => {
  try {
    const timestamp = localStorage.getItem(SETTINGS_TIMESTAMP_KEY);
    if (!timestamp) return false;
    
    const cacheAge = Date.now() - parseInt(timestamp);
    return cacheAge < CACHE_DURATION;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
};

// Load settings with caching logic
export const loadSettings = async (forceRefresh: boolean = false): Promise<AppSettings> => {
  // If not forcing refresh and cache is valid, use local settings
  if (!forceRefresh && isCacheValid()) {
    console.log('🔄 Using cached settings (less than 1 hour old)');
    return loadSettingsFromLocal();
  }

  // Cache is invalid or refresh forced, load from Firebase
  try {
    console.log('🔍 Loading settings from Firebase...');
    const settingsRef = doc(db, 'settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      console.log('📄 Found existing settings in Firebase');
      const firebaseSettings = settingsSnap.data() as AppSettings;
      // Merge with defaults to ensure all fields exist
      const mergedSettings = { ...DEFAULT_SETTINGS, ...firebaseSettings };
      // Save to localStorage with timestamp
      saveSettingsToLocal(mergedSettings);
      console.log('✅ Settings loaded and cached:', mergedSettings);
      return mergedSettings;
    } else {
      console.log('📄 No settings found in Firebase, will create default');
      // Create default settings in Firebase
      const defaultSettings = DEFAULT_SETTINGS;
      await setDoc(settingsRef, defaultSettings);
      saveSettingsToLocal(defaultSettings);
      console.log('✅ Created default settings in Firebase and cached');
      return defaultSettings;
    }
  } catch (error) {
    console.error('❌ Error loading settings from Firebase:', error);
    
    // Fallback to localStorage if Firebase fails
    console.log('⚠️ Falling back to cached localStorage settings');
    return loadSettingsFromLocal();
  }
};

// Load settings from Firebase (legacy function - kept for backward compatibility)
export const loadSettingsFromFirebase = async (): Promise<AppSettings> => {
  return loadSettings(true); // Force refresh when called directly
};

// Sync settings to Firebase (manual sync)
export const syncSettingsToFirebase = async (settings: AppSettings): Promise<{ isNew: boolean }> => {
  try {
    console.log('🔄 Starting global settings sync to Firebase...');
    console.log('⚙️ Settings to sync:', settings);
    
    const settingsRef = doc(db, 'settings', 'global');
    console.log('📄 Using global settings document');

    const settingsSnap = await getDoc(settingsRef);
    const isNew = !settingsSnap.exists();
    console.log('🆕 Is new document:', isNew);
    
    await setDoc(settingsRef, settings, { merge: true });
    console.log('✅ Global settings synced to Firebase successfully');
    
    // Also save to localStorage with new timestamp to refresh cache
    saveSettingsToLocal(settings);
    console.log('💾 Settings cached locally with updated timestamp');
    
    return { isNew };
  } catch (error) {
    console.error('❌ Error syncing settings to Firebase:', error);
    console.error('📊 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code || 'Unknown code',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    throw error;
  }
};
export const settingsService = {
  loadSettingsFromLocal,
  saveSettingsToLocal,
  loadSettings,
  loadSettingsFromFirebase,
  syncSettingsToFirebase,
};
