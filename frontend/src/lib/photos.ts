/**
 * Galerie des proches, conservée sur l'appareil et séparée par profil.
 * Mobile : fichiers copiés dans le dossier Documents de l'application, sous photos/<mode>_<profil>/.
 * Web (prévisualisation) : image compressée stockée en data URI dans le stockage du navigateur.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { profileKey, storage } from './storage';
import type { Session } from './types';

export interface Photo {
  id: string;
  uri: string;
  added_at: string;
}

const MAX_PHOTOS = 24;
const MAX_WEB_BYTES = 1_500_000;

const indexKey = (s: Session) => profileKey(s.mode, s.profileId, 'photos');

export async function listPhotos(s: Session): Promise<Photo[]> {
  return (await storage.readJson<Photo[]>(indexKey(s))) ?? [];
}

async function photoDir(s: Session) {
  const { Directory, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.document, 'photos', `${s.mode}_${s.profileId}`);
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/** Ouvre la photothèque. Retourne null si l'utilisateur annule. */
export async function addPhoto(s: Session): Promise<Photo | null> {
  const current = await listPhotos(s);
  if (current.length >= MAX_PHOTOS) throw new Error(`La galerie est limitée à ${MAX_PHOTOS} photos par profil.`);
  const isWeb = Platform.OS === 'web';
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: isWeb ? 0.6 : 0.85,
    base64: isWeb,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let uri: string;
  if (isWeb) {
    if (!asset.base64) throw new Error('Image illisible.');
    if (asset.base64.length > MAX_WEB_BYTES) throw new Error('Image trop lourde pour la prévisualisation web.');
    uri = `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  } else {
    const { File } = await import('expo-file-system');
    const dir = await photoDir(s);
    const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const dest = new File(dir, `${id}.${ext}`);
    await new File(asset.uri).copy(dest);
    uri = dest.uri;
  }
  const photo: Photo = { id, uri, added_at: new Date().toISOString() };
  await storage.writeJson(indexKey(s), [photo, ...current]);
  return photo;
}

export async function removePhoto(s: Session, id: string): Promise<void> {
  const current = await listPhotos(s);
  const target = current.find((p) => p.id === id);
  if (target && Platform.OS !== 'web') {
    try {
      const { File } = await import('expo-file-system');
      const file = new File(target.uri);
      if (file.exists) file.delete();
    } catch {
      // Fichier déjà absent : on retire quand même l'entrée de la galerie.
    }
  }
  await storage.writeJson(indexKey(s), current.filter((p) => p.id !== id));
}
