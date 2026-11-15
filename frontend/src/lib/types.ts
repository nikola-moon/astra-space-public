/**
 * Contrat de données de l'espace astronaute.
 * Les champs suivent la réponse de `GET /api/me` du serveur de démonstration FastAPI.
 * `signals` est optionnel : le serveur actuel ne l'expose pas encore.
 */

export type Mode = 'api' | 'demo';

export type ZoneId =
  | 'tete'
  | 'coeur'
  | 'poumons'
  | 'colonne'
  | 'bassin'
  | 'bras_droit'
  | 'bras_gauche'
  | 'jambe_droite'
  | 'jambe_gauche';

/** Statut d'un signal de santé tel que déclaré par le serveur. */
export type SignalStatus = 'unavailable' | 'review' | 'priority' | 'in_band';

export interface HealthSignal {
  id: string;
  zone: ZoneId | null;
  label: string;
  value: number | null;
  unit: string | null;
  device: string | null;
  observed_at: string | null;
  status: SignalStatus;
  note?: string;
}

export type WorkoutStatus = 'Confirmée' | 'À examiner' | 'À confirmer';

export interface WorkoutEntry {
  ended_at: string;
  power_w: number | null;
  target_w: number | null;
  duration_s: number | null;
  heart_rate_avg_bpm: number | null;
  rpe: number | null;
  status: WorkoutStatus | string;
}

export type ProgramStatus = 'initial' | 'pending_approval' | 'approved' | 'rejected' | string;

export interface ProgramInfo {
  status: ProgramStatus;
  power_w: number | null;
  duration_s: number | null;
  validated_at: string | null;
}

export type Stage = 'Bébé' | 'Jeune' | 'Adulte';

export interface CompanionInfo {
  name: string;
  age: Stage | string;
  confirmed_sessions: number;
  next_stage_at: number | null;
  period: 'work' | 'rest' | string;
  reminder_allowed: boolean;
}

export interface ReportRecord {
  id: number | string;
  category: string;
  created_at: string;
}

export interface MeState {
  profile: { id: string; name: string };
  synchronized_at: string;
  equipment: string;
  history: WorkoutEntry[];
  explanation: string;
  comparison_count: number;
  program: ProgramInfo;
  companion: CompanionInfo;
  reports: ReportRecord[];
  /** Absent si la station ne fournit pas de signaux localisés. */
  signals?: HealthSignal[] | null;
  /** Attentions envoyées par la famille, arrivées à bord après une liaison sol. */
  family?: FamilyCare[];
}

export type FamilyKind = 'friandise' | 'caresse' | 'jouet' | 'carte';

export interface FamilyCare {
  id: number | string;
  sender: string;
  kind: FamilyKind;
  message: string;
  sent_at: string;
  delivered_at: string;
}

export type Topic = 'observations' | 'adjustment' | 'plan';

export type DiscussionReply = {
  answer: string;
  mode: string;
  follow_up?: { question: string; topic: Topic };
};

export const TOPICS: { topic: Topic; label: string }[] = [
  { topic: 'observations', label: 'Qu’a mesuré l’appareil ?' },
  { topic: 'adjustment', label: 'Pourquoi cet ajustement ?' },
  { topic: 'plan', label: 'Quel est mon programme ?' },
];

/** Motifs acceptés par `POST /api/me/report`. */
export const REPORT_CATEGORIES = [
  'Gêne signalée après une séance',
  'Appareil indisponible',
  'Demande de contact à bord',
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export interface ReportResult {
  report: ReportRecord;
  already_registered: boolean;
}

export type StationAction = 'import' | 'draft' | 'specialist' | 'approve' | 'work' | 'rest' | 'uplink';

export interface Session {
  mode: Mode;
  profileId: string;
  name: string;
}

export type LinkState = 'connected' | 'unreachable' | 'session_expired' | 'demo' | 'loading';
