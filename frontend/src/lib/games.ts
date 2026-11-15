/**
 * Les 5 jeux de Nova, chacun rattaché à des travaux publiés.
 * Ce sont des activités de détente : elles ne constituent ni un soin ni une mesure de santé,
 * et elles n'ajoutent aucune séance au dossier d'entraînement.
 */
import { profileKey, storage } from './storage';
import type { MeState, Session, Stage } from './types';

export type GameId = 'souffle' | 'regard' | 'mandala' | 'constellations' | 'assemblage';

export interface Source {
  label: string;
  url: string;
}

export interface GameInfo {
  id: GameId;
  title: string;
  pitch: string;
  minutes: string;
  icon: 'leaf-outline' | 'eye-outline' | 'color-palette-outline' | 'sparkles-outline' | 'grid-outline';
  /** Stade de Nova à partir duquel le jeu est proposé. */
  unlock: Stage;
  why: string;
  caution: string;
  sources: Source[];
}

export const GAMES: GameInfo[] = [
  {
    id: 'souffle',
    title: 'Souffle avec Nova',
    pitch: 'Respire au rythme de Nova : 5 s d’inspiration, 5 s d’expiration.',
    minutes: '2 min',
    icon: 'leaf-outline',
    unlock: 'Bébé',
    why: 'La respiration lente (moins de 10 cycles par minute) est associée à une hausse de la variabilité cardiaque et à un état plus calme. L’entraînement à la variabilité cardiaque est associé à une baisse du stress et de l’anxiété ressentis.',
    caution: 'Ici, sans capteur : c’est une respiration guidée, pas un biofeedback. Arrêter en cas de vertige.',
    sources: [
      { label: 'Zaccaro et al., 2018, Frontiers in Human Neuroscience — revue systématique sur la respiration lente', url: 'https://www.frontiersin.org/articles/10.3389/fnhum.2018.00353/full' },
      { label: 'Goessl, Curtiss & Hofmann, 2017, Psychological Medicine — méta-analyse, biofeedback de variabilité cardiaque', url: 'https://open.bu.edu/handle/2144/26911' },
    ],
  },
  {
    id: 'mandala',
    title: 'Mandala orbital',
    pitch: 'Colorie un mandala structuré, à ton rythme.',
    minutes: 'Libre',
    icon: 'color-palette-outline',
    unlock: 'Bébé',
    why: 'Colorier un mandala (un motif structuré) a réduit l’anxiété davantage que le dessin libre dans deux études expérimentales.',
    caution: 'Petites études menées avec des étudiants : effet prometteur, non démontré en mission.',
    sources: [
      { label: 'Curry & Kasser, 2005, Art Therapy 22(2) — Can coloring mandalas reduce anxiety?', url: 'https://stresshumain.ca/wp-content/uploads/2015/12/ColoringReduceAnxiety.pdf' },
      { label: 'van der Vennet & Serice, 2012, Art Therapy — réplication', url: 'https://informahealthcare.com/doi/abs/10.1080/07421656.2012.680047' },
    ],
  },
  {
    id: 'regard',
    title: 'Le regard de Nova',
    pitch: 'Parmi les Nova grognons, trouve vite celui qui est apaisé.',
    minutes: '2 min',
    icon: 'eye-outline',
    unlock: 'Jeune',
    why: 'Chercher le visage positif parmi des visages menaçants reprend le principe de la modification du biais attentionnel. Une version ludique sur mobile a réduit l’anxiété ressentie et la réactivité au stress chez des adultes anxieux.',
    caution: 'Effet mesuré à court terme ; l’effet sur le biais attentionnel n’est apparu qu’après 45 min de jeu.',
    sources: [
      { label: 'Dennis & O’Toole, 2014, Clinical Psychological Science 2(5) — Mental Health on the Go', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4447237' },
    ],
  },
  {
    id: 'constellations',
    title: 'Constellations',
    pitch: 'Échange deux étoiles voisines pour aligner trois formes identiques. Sans chrono.',
    minutes: 'Libre',
    icon: 'sparkles-outline',
    unlock: 'Jeune',
    why: 'Les jeux « casual » d’association ont amélioré l’humeur et réduit des marqueurs de stress dans un essai randomisé. Seule la version sans limite de temps réduisait le stress physiologique, d’où l’absence de chrono ici. Deux revues jugent ces jeux prometteurs contre le stress et l’anxiété.',
    caution: 'Essai initial financé par un éditeur de jeux ; les revues appellent à des études plus solides.',
    sources: [
      { label: 'Russoniello, O’Brien & Parks, 2009, Stud. Health Technol. Inform. — EEG, HRV and psychological correlates (essai randomisé)', url: 'https://pubmed.ncbi.nlm.nih.gov/19592761/' },
      { label: 'Pine et al., 2020, Games for Health Journal — revue systématique des jeux casual', url: 'https://pubmed.ncbi.nlm.nih.gov/32053021/' },
      { label: 'Pallavicini et al., 2021, JMIR Mental Health — revue systématique, jeux commerciaux et stress', url: 'https://mental.jmir.org/2021/8/e28150' },
    ],
  },
  {
    id: 'assemblage',
    title: 'Assemblage de la station',
    pitch: 'Place les modules sur la grille ; une ligne ou une colonne pleine se libère.',
    minutes: 'Libre',
    icon: 'grid-outline',
    unlock: 'Adulte',
    why: 'Les jeux de placement de pièces sollicitent fortement l’attention visuospatiale. Ce type de tâche a réduit les souvenirs intrusifs après un film éprouvant, puis aux urgences dans un essai pilote.',
    caution: 'Les études portent sur les souvenirs intrusifs après un événement, pas sur le bien-être général ; ce n’est pas un traitement.',
    sources: [
      { label: 'Holmes et al., 2009, PLoS ONE — tâche visuospatiale et flashbacks', url: 'https://doaj.org/article/f4e7fa369b04443683f317ab413886cf' },
      { label: 'Iyadurai et al., 2018, Molecular Psychiatry 23 — essai pilote aux urgences', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5822451' },
    ],
  },
];

const STAGE_ORDER: Stage[] = ['Bébé', 'Jeune', 'Adulte'];

export interface Access {
  allowed: boolean;
  /** Ce que Nova dit pour expliquer sa décision. */
  reason: string;
}

/**
 * Nova autorise un jeu quand :
 * 1. la station indique une plage de repos (même règle que les rappels) ;
 * 2. son stade a débloqué ce jeu (les séances confirmées ouvrent de nouveaux jeux).
 * Une séance « à confirmer » ne retire jamais un jeu déjà débloqué.
 */
export function gameAccess(state: MeState | null, game: GameInfo): Access {
  if (!state) return { allowed: false, reason: 'Nova attend la station pour savoir si c’est l’heure de la pause.' };
  const stage = (STAGE_ORDER.includes(state.companion.age as Stage) ? state.companion.age : 'Bébé') as Stage;
  if (STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(game.unlock)) {
    return { allowed: false, reason: `Nova te proposera ce jeu au stade ${game.unlock}.` };
  }
  if (!state.companion.reminder_allowed) {
    return { allowed: false, reason: 'Nova se concentre avec toi pendant le travail. On jouera à ta prochaine pause.' };
  }
  return { allowed: true, reason: 'Nova est d’accord : c’est ta pause.' };
}

export interface GameStats {
  plays: number;
  best: number | null;
}

const statsKey = (s: Session) => profileKey(s.mode, s.profileId, 'games');

export async function loadStats(s: Session): Promise<Partial<Record<GameId, GameStats>>> {
  return (await storage.readJson<Partial<Record<GameId, GameStats>>>(statsKey(s))) ?? {};
}

/** `higherIsBetter` : vrai pour un score, faux pour un temps de réaction. */
export async function recordPlay(s: Session, id: GameId, score: number | null, higherIsBetter = true) {
  const all = await loadStats(s);
  const prev = all[id] ?? { plays: 0, best: null };
  let best = prev.best;
  if (score !== null) best = best === null ? score : higherIsBetter ? Math.max(best, score) : Math.min(best, score);
  all[id] = { plays: prev.plays + 1, best };
  await storage.writeJson(statsKey(s), all);
}
