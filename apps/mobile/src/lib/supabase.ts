import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

/**
 * Supabase session storage backed by the device keychain/keystore.
 *
 * Note: SecureStore warns above ~2048 bytes. Typical Supabase sessions fit,
 * but if a session ever fails to persist on-device, swap this for a
 * LargeSecureStore wrapper (AES via expo-crypto + AsyncStorage) or
 * AsyncStorage. Tracked as a Phase 2 follow-up to verify on a real device.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — see apps/mobile/.env.example.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native; OAuth redirects are handled
    // explicitly via expo-web-browser + exchangeCodeForSession.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Keep tokens fresh only while the app is foregrounded (Supabase RN guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
