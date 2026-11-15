import type { SignalStatus } from '../lib/types';

/** Identité ASTRA : fond clair, encre marine, accents froids. Les couleurs d'alerte sont réservées à la santé. */
export const colors = {
  bg: '#F2F4F8',
  card: '#FFFFFF',
  ink: '#0E1A2B',
  inkSoft: '#33425A',
  muted: '#64748B',
  line: '#E2E8F0',
  navy: '#14213D',
  accent: '#3E8ED0',
  accentSoft: '#DCEBF8',
  chartBar: '#A9D3F0',
  chartBarStrong: '#3E8ED0',
  white: '#FFFFFF',
};

export const statusStyle: Record<SignalStatus, { color: string; soft: string; text: string; label: string; short: string }> = {
  unavailable: { color: '#9AA4B2', soft: '#EEF1F5', text: '#4B5563', label: 'Donnée indisponible', short: 'Indisponible' },
  review: { color: '#E0A100', soft: '#FFF4D6', text: '#7A5200', label: 'Mesure à examiner', short: 'À examiner' },
  priority: { color: '#D64545', soft: '#FDE4E4', text: '#9B1C1C', label: 'Priorité déclarée par la station', short: 'Priorité' },
  in_band: { color: '#3E8ED0', soft: '#DCEBF8', text: '#1D4E7A', label: 'Dans la plage configurée', short: 'Dans la plage' },
};

export const radius = { card: 22, pill: 999, small: 12 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const type = {
  hero: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -1, color: colors.ink },
  big: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, color: colors.ink },
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.ink },
  section: { fontSize: 17, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.inkSoft, lineHeight: 21 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.muted, textTransform: 'uppercase' as const, letterSpacing: 0.6 },
};
