/** Formats français écrits à la main : ne dépend pas des données Intl du moteur JavaScript. */
const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Date inconnue';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date inconnue';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Date inconnue';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date inconnue';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function minutes(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  return `${Math.round(seconds / 60)} min`;
}

/** Une mesure manquante s'affiche « À confirmer ». */
export function measure(value: number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'À confirmer';
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
  return unit ? `${text} ${unit}` : text;
}

export const EXERCISE_LABEL: Record<string, string> = { cycling: 'Vélo', CEVIS: 'Vélo ergomètre CEVIS' };

export const PROGRAM_STATUS: Record<string, string> = {
  initial: 'Plan initial du spécialiste',
  pending_approval: 'Proposition en attente de décision à bord',
  approved: 'Programme ajusté validé à bord',
  rejected: 'Proposition refusée à bord',
};
