/**
 * Soins de Nova : mécanique de compagnon virtuel (nourrir, nettoyer, changer la vue, dormir),
 * réécrite pour ASTRA à partir du principe du jeu « Hey Fox! » (dépôt paulclindo/fox-game,
 * sans licence : ni son code ni ses images ne sont repris).
 *
 * Différences volontaires avec l'original, pour un compagnon de soutien :
 * - Nova ne meurt jamais et ne perd jamais son stade. Un besoin oublié le rend seulement demandeur.
 * - Le temps est réel (heures), calculé à partir d'horodatages : rien ne tourne en arrière-plan.
 * - En mode démo, le temps de Nova est accéléré (1 minute réelle = 1 heure) pour la présentation.
 */
import { profileKey, storage } from './storage';
import type { FamilyCare, FamilyKind, Mode, Session } from './types';

export type PortholeView = 'terre' | 'aurore' | 'etoiles';
export const VIEWS: { id: PortholeView; label: string }[] = [
  { id: 'terre', label: 'la Terre de jour' },
  { id: 'aurore', label: 'une aurore polaire' },
  { id: 'etoiles', label: 'la nuit étoilée' },
];

export interface PetData {
  hatchedAt: string | null;
  lastFedAt: string;
  /** Moment prévu de la prochaine « litière » après un repas. */
  litterAt: string | null;
  litter: number;
  /** Depuis quand la litière est sale (pour l'attitude « besoin d'attention »). */
  dirtySince: string | null;
  view: PortholeView;
  /** Mode démo uniquement : force la nuit pour montrer le sommeil. */
  demoNight?: boolean;
  /** Attentions de la famille déjà appliquées à Nova (chacune ne compte qu'une fois). */
  appliedFamily?: string[];
}

const FAMILY_TEXT: Record<FamilyKind, string> = {
  friandise: 'une friandise pour Nova',
  caresse: 'une caresse pour Nova',
  jouet: 'un jouet pour Nova',
  carte: 'une carte',
};

/**
 * Applique les attentions de la famille arrivées à bord.
 * Friandise : Nova est nourri. Caresse et jouet : réaction joyeuse. Carte : message seulement.
 */
export function applyFamily(raw: PetData, mode: Mode, family: FamilyCare[], now = Date.now()) {
  const applied = new Set(raw.appliedFamily ?? []);
  const fresh = family.filter((f) => !applied.has(String(f.id))).sort((a, b) => Number(a.id) - Number(b.id));
  if (!fresh.length) return null;
  let data: PetData = { ...raw, appliedFamily: [...applied, ...fresh.map((f) => String(f.id))].slice(-100) };
  if (fresh.some((f) => f.kind === 'friandise') && data.hatchedAt) {
    const iso = new Date(now).toISOString();
    data = { ...data, lastFedAt: iso, litterAt: data.litterAt ?? new Date(now + LITTER_AFTER / scale(mode)).toISOString() };
  }
  const last = fresh[fresh.length - 1];
  const others = fresh.length > 1 ? ` (+${fresh.length - 1} autre${fresh.length > 2 ? 's' : ''})` : '';
  const announce = `${last.sender} t’envoie ${FAMILY_TEXT[last.kind]} depuis la Terre${others}.`;
  const reaction: 'pet' | 'play' | 'idle' = fresh.some((f) => f.kind === 'jouet') ? 'play' : last.kind === 'carte' ? 'idle' : 'pet';
  return { data, announce, reaction };
}

const HOUR = 3600 * 1000;
const HUNGER_AFTER = 4 * HOUR;
const SNACK_FROM = 0.5; // on peut nourrir Nova dès que sa jauge de faim passe sous 50 %
const LITTER_AFTER = 1.5 * HOUR;
const NEEDY_AFTER = 6 * HOUR;
const MAX_LITTER = 3;

const scale = (mode: Mode) => (mode === 'demo' ? 60 : 1);

export type Phase = 'egg' | 'sleeping' | 'hungry' | 'dirty' | 'idle';

export interface PetStatus {
  phase: Phase;
  /** 1 = rassasié, 0 = a faim. */
  food: number;
  /** 1 = propre, 0 = litière pleine. */
  clean: number;
  litter: number;
  asleep: boolean;
  /** Un besoin attend depuis longtemps : Nova baisse les oreilles (sans aucune pénalité). */
  needy: boolean;
  message: string;
}

export function isNight(data: PetData, mode: Mode, now = new Date()) {
  if (mode === 'demo' && data.demoNight !== undefined) return data.demoNight;
  const h = now.getHours();
  return h >= 22 || h < 6;
}

/** Fait apparaître la litière prévue si son heure est passée. */
function settle(data: PetData, _mode: Mode, now: number): PetData {
  if (data.litterAt && now >= Date.parse(data.litterAt)) {
    return {
      ...data,
      litter: Math.min(MAX_LITTER, data.litter + 1),
      litterAt: null,
      dirtySince: data.dirtySince ?? new Date(Date.parse(data.litterAt)).toISOString(),
    };
  }
  return data;
}

export function status(raw: PetData, mode: Mode, now = Date.now()): PetStatus {
  const data = settle(raw, mode, now);
  const k = scale(mode);
  const fedFor = (now - Date.parse(data.lastFedAt)) * k;
  const food = Math.max(0, Math.min(1, 1 - fedFor / HUNGER_AFTER));
  const clean = Math.max(0, 1 - data.litter / MAX_LITTER);
  const asleep = !!data.hatchedAt && isNight(data, mode, new Date(now));
  const dirtyFor = data.dirtySince ? (now - Date.parse(data.dirtySince)) * k : 0;
  const needy = fedFor > HUNGER_AFTER + NEEDY_AFTER || dirtyFor > NEEDY_AFTER;

  let phase: Phase = 'idle';
  let message = 'Nova est bien installé près du hublot.';
  if (!data.hatchedAt) {
    phase = 'egg';
    message = 'Une capsule vient d’arriver à bord. Appuie sur le bouton central pour l’ouvrir.';
  } else if (asleep) {
    phase = 'sleeping';
    message = 'Chut… Nova dort. Il se réveillera avec la journée de bord.';
  } else if (food === 0) {
    phase = 'hungry';
    message = needy ? 'Nova a vraiment faim et t’attend près de sa gamelle.' : 'Nova a faim.';
  } else if (data.litter > 0) {
    phase = 'dirty';
    message = needy ? 'La litière déborde un peu, Nova aimerait un coup de main.' : 'La litière a besoin d’être nettoyée.';
  }
  return { phase, food, clean, litter: data.litter, asleep, needy, message };
}

export type PetAction = 'feed' | 'clean' | 'view' | 'hatch';
export type Effect = 'eat' | 'celebrate' | 'none';

/** Applique une action et renvoie le nouvel état, la réaction et la phrase de Nova. */
export function act(raw: PetData, mode: Mode, action: PetAction, now = Date.now()): { data: PetData; effect: Effect; message: string } {
  const data = settle(raw, mode, now);
  const st = status(data, mode, now);
  const iso = new Date(now).toISOString();
  if (!data.hatchedAt) {
    if (action !== 'hatch') return { data, effect: 'none', message: 'La capsule est encore fermée.' };
    return { data: { ...data, hatchedAt: iso, lastFedAt: iso }, effect: 'celebrate', message: 'Bienvenue à bord, Nova !' };
  }
  if (action === 'view') {
    const i = VIEWS.findIndex((v) => v.id === data.view);
    const next = VIEWS[(i + 1) % VIEWS.length];
    return { data: { ...data, view: next.id }, effect: 'none', message: `Le hublot montre ${next.label}.` };
  }
  if (st.asleep) return { data, effect: 'none', message: 'Nova dort. On s’occupera de lui à son réveil.' };
  if (action === 'feed') {
    if (st.food > SNACK_FROM) return { data, effect: 'none', message: 'Nova n’a pas faim pour l’instant.' };
    const litterAt = data.litterAt ?? new Date(now + LITTER_AFTER / scale(mode)).toISOString();
    return { data: { ...data, lastFedAt: iso, litterAt }, effect: 'eat', message: 'Miam ! Nova se régale.' };
  }
  if (action === 'clean') {
    if (data.litter === 0) return { data, effect: 'none', message: 'Tout est déjà propre.' };
    return { data: { ...data, litter: 0, dirtySince: null }, effect: 'celebrate', message: 'Litière propre ! Nova fait la fête.' };
  }
  return { data, effect: 'none', message: st.message };
}

const key = (s: Session) => profileKey(s.mode, s.profileId, 'pet');

export function freshPet(): PetData {
  const iso = new Date().toISOString();
  return { hatchedAt: null, lastFedAt: iso, litterAt: null, litter: 0, dirtySince: null, view: 'terre' };
}

export async function loadPet(s: Session): Promise<PetData> {
  return (await storage.readJson<PetData>(key(s))) ?? freshPet();
}

export async function savePet(s: Session, data: PetData) {
  await storage.writeJson(key(s), data);
}

/** Outils de la console de démonstration. */
export const petDemo = {
  async makeHungry(s: Session) {
    const d = await loadPet(s);
    await savePet(s, { ...d, lastFedAt: new Date(Date.now() - (HUNGER_AFTER + HOUR) / scale(s.mode)).toISOString() });
  },
  async addLitter(s: Session) {
    const d = await loadPet(s);
    await savePet(s, { ...d, litter: Math.min(MAX_LITTER, d.litter + 1), dirtySince: d.dirtySince ?? new Date().toISOString() });
  },
  async toggleNight(s: Session) {
    const d = await loadPet(s);
    await savePet(s, { ...d, demoNight: !isNight(d, s.mode) });
  },
  async reset(s: Session) {
    await savePet(s, freshPet());
  },
};
