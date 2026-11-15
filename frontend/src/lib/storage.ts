import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MeState, Mode, Session } from './types';

/**
 * Tout ce qui est propre à un astronaute est rangé sous une clé
 * `astra.v1.<mode>.<profil>.*` : cache du bilan, photos, rappels, stade vu.
 * Changer de profil ne lit jamais les clés d'un autre profil.
 */
export function profileKey(mode: Mode, profileId: string, name: string) {
  return `astra.v1.${mode}.${profileId}.${name}`;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible : l'application reste utilisable sans cache.
  }
}

const SESSION_KEY = 'astra.v1.session';
const API_URL_KEY = 'astra.v1.apiUrl';

export const storage = {
  loadSession: () => readJson<Session>(SESSION_KEY),
  saveSession: (session: Session) => writeJson(SESSION_KEY, session),
  clearSession: () => AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined),
  clearLegacyStationCache: () =>
    AsyncStorage.multiRemove(['ines', 'malik'].map((id) => profileKey('api', id, 'cache'))).catch(() => undefined),

  loadApiUrl: () => AsyncStorage.getItem(API_URL_KEY).catch(() => null),
  saveApiUrl: (url: string) => AsyncStorage.setItem(API_URL_KEY, url).catch(() => undefined),

  loadCache: (s: Session) => s.mode === 'demo' ? readJson<{ state: MeState; saved_at: string }>(profileKey(s.mode, s.profileId, 'cache')) : Promise.resolve(null),
  saveCache: (s: Session, state: MeState) =>
    s.mode === 'demo' ? writeJson(profileKey(s.mode, s.profileId, 'cache'), { state, saved_at: new Date().toISOString() }) : Promise.resolve(),

  readJson,
  writeJson,
};
