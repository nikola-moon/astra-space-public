/**
 * Mode démo hors ligne : deux profils fictifs et des scénarios de zones colorées.
 * Les règles reprennent celles du serveur de démonstration (demo_app.py) pour que
 * les deux modes se comportent de la même façon. Toutes les valeurs sont fictives.
 */
import { storage, profileKey } from './storage';
import type {
  FamilyCare,
  FamilyKind,
  HealthSignal,
  MeState,
  ReportCategory,
  ReportResult,
  Session,
  StationAction,
  Topic,
  WorkoutEntry,
} from './types';

export const DEMO_PROFILES = {
  ines: { name: 'Inès Diallo', base: 100, maximum: 110, history: 2 },
  malik: { name: 'Malik Chen', base: 80, maximum: 90, history: 1 },
} as const;
export type DemoProfileId = keyof typeof DEMO_PROFILES;

export type SignalScenario = 'profil' | 'calme' | 'indisponible';

interface DemoSession {
  id: string;
  ended_at: string;
  power_w: number;
  duration_s: number;
  heart_rate_avg_bpm: number;
  rpe: number | null;
  quality: 'valid' | 'suspect';
}

interface DemoDb {
  sessions: DemoSession[];
  program: null | { status: 'pending_approval' | 'approved'; proposed: number; specialist: boolean; decided_at: string | null };
  period: 'work' | 'rest';
  reports: { id: number; category: string; created_at: string }[];
  scenario: SignalScenario;
  stationDown: boolean;
  /** Envois fictifs de la famille : au sol (delivered_at null) puis arrivés à bord. */
  family?: FamilyCare[];
}

const KIND_LABEL: Record<FamilyKind, string> = { friandise: 'une friandise', caresse: 'une caresse', jouet: 'un jouet', carte: 'une carte' };

/** Proches fictifs du mode démo. */
const FAMILY_SAMPLES: Record<DemoProfileId, { sender: string; kind: FamilyKind; message: string }[]> = {
  ines: [
    { sender: 'Lina', kind: 'friandise', message: 'Pour Nova ! On a regardé la station passer hier soir depuis le balcon.' },
    { sender: 'Lina', kind: 'jouet', message: 'Un jouet pour qu’il pense à moi.' },
    { sender: 'Papa', kind: 'carte', message: 'Le jardin fleurit, on t’attend pour les tomates.' },
  ],
  malik: [
    { sender: 'Yan', kind: 'caresse', message: 'Une caresse pour Nova, et une pour toi.' },
    { sender: 'Yan', kind: 'friandise', message: '' },
  ],
};

const ATTENTION: Record<string, string> = {
  specialist_review: 'Au moins une séance demande une revue. Le programme en vigueur est conservé.',
  maintain: 'La cible du plan est maintenue.',
  insufficient_history:
    'Les premières séances sont disponibles. Il faut trois séances comparables pour proposer une progression.',
  progression_for_review: 'Trois séances comparables ont atteint la cible. Un ajustement peut être examiné à bord.',
};

const DAY = 24 * 3600 * 1000;

function makeSession(n: number, power: number, endedAt: Date, rpe: number | null = 4): DemoSession {
  return {
    id: `cevis-${n}`,
    ended_at: endedAt.toISOString(),
    power_w: power,
    duration_s: 1200,
    heart_rate_avg_bpm: 118 + n,
    rpe,
    quality: 'valid',
  };
}

function seed(id: DemoProfileId): DemoDb {
  const p = DEMO_PROFILES[id];
  const sessions: DemoSession[] = [];
  for (let n = 1; n <= p.history; n++) sessions.push(makeSession(n, p.base, new Date(Date.now() - (8 - n) * DAY)));
  return { sessions, program: null, period: 'work', reports: [], scenario: 'profil', stationDown: false };
}

const dbKey = (id: string) => profileKey('demo', id, 'db');

async function load(id: string): Promise<DemoDb> {
  if (!(id in DEMO_PROFILES)) throw new Error('Profil de démonstration inconnu.');
  return (await storage.readJson<DemoDb>(dbKey(id))) ?? seed(id as DemoProfileId);
}

async function save(id: string, db: DemoDb) {
  await storage.writeJson(dbKey(id), db);
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

/** Scénarios de signaux fictifs. Le statut et la zone sont portés par les données, jamais par l'image. */
function signalsFor(id: DemoProfileId, scenario: SignalScenario): HealthSignal[] | null {
  if (scenario === 'indisponible') return null;
  const scenarios: Record<DemoProfileId, HealthSignal[]> = {
    ines: [
      { id: 's-hr', zone: 'coeur', label: 'Fréquence cardiaque de repos', value: 64, unit: 'bpm', device: 'Ceinture cardiaque (fictive)', observed_at: hoursAgo(3), status: 'in_band' },
      { id: 's-knee', zone: 'jambe_gauche', label: 'Couple des extenseurs du genou', value: 182, unit: 'N·m', device: 'Dynamomètre isocinétique (fictif)', observed_at: hoursAgo(26), status: 'review', note: 'Valeur plus basse que la mesure précédente. À examiner par l’équipe à bord.' },
      { id: 's-bmd', zone: 'colonne', label: 'Densité osseuse lombaire, écart à la référence', value: -2.1, unit: '%', device: 'Densitométrie DXA (fictive)', observed_at: hoursAgo(72), status: 'priority', note: 'Priorité déclarée par la station dans ce scénario fictif.' },
      { id: 's-spo2', zone: 'poumons', label: 'Saturation en oxygène', value: null, unit: '%', device: 'Oxymètre de pouls (fictif)', observed_at: null, status: 'unavailable', note: 'Capteur non synchronisé.' },
      { id: 's-sleep', zone: null, label: 'Durée de sommeil déclarée', value: 6.2, unit: 'h', device: 'Journal de bord', observed_at: hoursAgo(9), status: 'review' },
      { id: 's-mass', zone: null, label: 'Masse corporelle', value: 61.8, unit: 'kg', device: 'Dispositif de mesure de masse (fictif)', observed_at: hoursAgo(30), status: 'in_band' },
    ],
    malik: [
      { id: 's-hr', zone: 'coeur', label: 'Fréquence cardiaque de repos', value: 71, unit: 'bpm', device: 'Ceinture cardiaque (fictive)', observed_at: hoursAgo(2), status: 'review', note: 'Hausse par rapport à la semaine précédente. À examiner.' },
      { id: 's-hip', zone: 'bassin', label: 'Densité osseuse de la hanche, écart à la référence', value: -1.2, unit: '%', device: 'Densitométrie DXA (fictive)', observed_at: hoursAgo(96), status: 'in_band' },
      { id: 's-balance', zone: 'tete', label: 'Score du test sensorimoteur', value: null, unit: 'points', device: 'Test sur tablette (fictif)', observed_at: null, status: 'unavailable' },
      { id: 's-calf', zone: 'jambe_droite', label: 'Volume musculaire du mollet (échographie)', value: 412, unit: 'cm³', device: 'Échographe guidé (fictif)', observed_at: hoursAgo(50), status: 'priority', note: 'Priorité déclarée par la station dans ce scénario fictif.' },
      { id: 's-temp', zone: null, label: 'Température cutanée', value: null, unit: '°C', device: 'Capteur porté (fictif)', observed_at: null, status: 'unavailable' },
    ],
  };
  const list = scenarios[id];
  return scenario === 'calme' ? list.map((s) => ({ ...s, status: s.value === null ? 'unavailable' : 'in_band', note: undefined })) : list;
}

function compute(id: DemoProfileId, db: DemoDb): MeState {
  const p = DEMO_PROFILES[id];
  const approved = db.program?.status === 'approved';
  const active = approved ? db.program!.proposed : p.base;
  const sorted = [...db.sessions].sort((a, b) => b.ended_at.localeCompare(a.ended_at));
  const history: WorkoutEntry[] = sorted.map((s) => {
    const expected = approved && db.program!.decided_at && s.ended_at > db.program!.decided_at ? active : p.base;
    let status: WorkoutEntry['status'];
    if (s.quality !== 'valid' || s.rpe === null) status = 'À confirmer';
    else if (s.power_w >= expected && s.duration_s >= 1200 && s.rpe <= 6) status = 'Confirmée';
    else status = 'À examiner';
    return {
      ended_at: s.ended_at,
      power_w: s.power_w,
      target_w: expected,
      duration_s: s.duration_s,
      heart_rate_avg_bpm: s.heart_rate_avg_bpm,
      rpe: s.rpe,
      status,
    };
  });
  const comparable = history.filter((h) => h.target_w === active && h.status !== 'À confirmer').slice(0, 3);
  let candidate = 'insufficient_history';
  if (comparable.length >= 3) {
    if (comparable.some((h) => h.status === 'À examiner')) candidate = 'specialist_review';
    else candidate = Math.min(active + 5, p.maximum) > active ? 'progression_for_review' : 'maintain';
  }
  const count = history.filter((h) => h.status === 'Confirmée').length;
  const age = count >= 5 ? 'Adulte' : count >= 3 ? 'Jeune' : 'Bébé';
  return {
    profile: { id, name: p.name },
    synchronized_at: new Date().toISOString(),
    equipment: 'CEVIS',
    history,
    explanation: approved ? 'Votre programme a été révisé à bord à partir des séances comparables.' : ATTENTION[candidate],
    comparison_count: comparable.length,
    program: {
      status: db.program?.status ?? 'initial',
      power_w: active,
      duration_s: 1200,
      validated_at: approved ? db.program!.decided_at : null,
    },
    companion: {
      name: 'Nova',
      age,
      confirmed_sessions: count,
      next_stage_at: count < 3 ? 3 : count < 5 ? 5 : null,
      period: db.period,
      reminder_allowed: db.period === 'rest',
    },
    reports: [...db.reports].sort((a, b) => b.id - a.id),
    signals: signalsFor(id, db.scenario),
    family: (db.family ?? []).filter((f) => f.delivered_at).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 20),
  };
}

export class DemoStationDown extends Error {}

export const demo = {
  profileName(profileId: string): string {
    const p = DEMO_PROFILES[profileId as DemoProfileId];
    if (!p) throw new Error('Profil fictif indisponible.');
    return p.name;
  },

  async me(s: Session): Promise<MeState> {
    const db = await load(s.profileId);
    if (db.stationDown) throw new DemoStationDown('Coupure de la station simulée.');
    return compute(s.profileId as DemoProfileId, db);
  },

  async discussion(s: Session, topic: Topic) {
    const state = await demo.me(s);
    const last = state.history[0];
    const plan = state.program;
    let answer: string;
    if (topic === 'observations') {
      answer = last
        ? `La dernière séance CEVIS a enregistré ${last.power_w} W, avec une cible de ${last.target_w} W et une durée rapportée de ${Math.floor((last.duration_s ?? 0) / 60)} min. État de suivi · ${last.status}.`
        : 'Aucune séance disponible.';
    } else if (topic === 'adjustment') {
      answer = state.explanation;
      if (plan.status === 'pending_approval') answer += ' La proposition attend une décision à bord. Votre programme actuel reste en vigueur.';
    } else {
      answer = `Votre séance de vélo CEVIS de démonstration est réglée à ${plan.power_w} W pour ${Math.floor((plan.duration_s ?? 0) / 60)} min.`;
    }
    return { answer, mode: 'Réponse locale de démonstration (données fictives)' };
  },

  async report(s: Session, category: ReportCategory): Promise<ReportResult> {
    const db = await load(s.profileId);
    if (db.stationDown) throw new DemoStationDown('Coupure de la station simulée.');
    const existing = db.reports.find((r) => r.category === category);
    if (existing) return { report: existing, already_registered: true };
    const record = { id: db.reports.reduce((m, r) => Math.max(m, r.id), 0) + 1, category, created_at: new Date().toISOString() };
    db.reports.push(record);
    await save(s.profileId, db);
    return { report: record, already_registered: false };
  },

  /** Console de simulation : mêmes actions que `/api/demo/action`, plus les scénarios propres à l'application. */
  async action(s: Session, action: StationAction | 'incomplete' | 'family', sample: 3 | 4 | 5 = 3): Promise<string> {
    const id = s.profileId as DemoProfileId;
    const db = await load(id);
    const state = compute(id, db);
    let message: string;
    if (action === 'family') {
      const pool = FAMILY_SAMPLES[id];
      const pick = pool[(db.family ?? []).length % pool.length];
      const family = db.family ?? [];
      family.push({ id: family.length + 1, ...pick, sent_at: new Date().toISOString(), delivered_at: '' });
      db.family = family;
      message = `${pick.sender} a envoyé ${KIND_LABEL[pick.kind]} depuis la Terre. Il arrivera à la prochaine liaison sol.`;
    } else if (action === 'uplink') {
      const waiting = (db.family ?? []).filter((f) => !f.delivered_at);
      waiting.forEach((f) => (f.delivered_at = new Date().toISOString()));
      message = waiting.length ? `Liaison sol simulée : ${waiting.length} envoi(s) de la famille arrivé(s) à bord.` : 'Liaison sol simulée : aucun envoi en attente.';
    } else if (action === 'work' || action === 'rest') {
      db.period = action;
      message = 'Planning simulé mis à jour.';
    } else if (action === 'incomplete') {
      if (db.sessions.some((x) => x.id === 'cevis-partielle')) message = 'Séance déjà reçue. Le compteur est inchangé.';
      else {
        db.sessions.push({ ...makeSession(9, state.program.power_w ?? 0, new Date(), null), id: 'cevis-partielle' });
        message = 'Séance reçue sans effort ressenti déclaré : elle reste « À confirmer ».';
      }
    } else if (action === 'import') {
      const sid = `cevis-${sample}`;
      if (db.sessions.some((x) => x.id === sid)) message = 'Séance déjà reçue. Le compteur est inchangé.';
      else {
        if (sample > 3 && state.program.status !== 'approved') throw new Error('Validez le programme simulé avant d’importer ses séances de suivi.');
        if (sample === 5 && !db.sessions.some((x) => x.id === 'cevis-4')) throw new Error('Importez d’abord la séance 4.');
        db.sessions.push(makeSession(sample, state.program.power_w ?? 0, new Date()));
        message = `Séance CEVIS ${sample} reçue et associée à ce profil.`;
      }
    } else if (action === 'draft') {
      if (db.program) throw new Error('Un programme de démonstration existe déjà pour ce profil.');
      const comparable = state.history.filter((h) => h.status === 'Confirmée').length;
      if (comparable < 3) throw new Error('Trois séances comparables sont nécessaires pour ce scénario.');
      db.program = { status: 'pending_approval', proposed: Math.min((state.program.power_w ?? 0) + 5, DEMO_PROFILES[id].maximum), specialist: false, decided_at: null };
      message = 'Ajustement calculé à bord. Revue du spécialiste en attente.';
    } else {
      if (!db.program) throw new Error('Calculez d’abord une proposition.');
      if (action === 'specialist') {
        db.program.specialist = true;
        message = 'Revue du spécialiste simulée. Approbation de mission en attente.';
      } else {
        if (db.program.status === 'approved') throw new Error('Program already decided');
        if (!db.program.specialist) throw new Error('La revue du spécialiste doit précéder l’approbation.');
        db.program.status = 'approved';
        db.program.decided_at = new Date().toISOString();
        message = 'Programme simulé approuvé et publié dans l’espace de cet astronaute.';
      }
    }
    await save(id, db);
    return message;
  },

  async setScenario(s: Session, scenario: SignalScenario) {
    const db = await load(s.profileId);
    db.scenario = scenario;
    await save(s.profileId, db);
  },

  async setStationDown(s: Session, down: boolean) {
    const db = await load(s.profileId);
    db.stationDown = down;
    await save(s.profileId, db);
  },

  async getFlags(s: Session) {
    const db = await load(s.profileId);
    return { scenario: db.scenario, stationDown: db.stationDown };
  },

  async reset(s: Session) {
    await save(s.profileId, seed(s.profileId as DemoProfileId));
  },
};
