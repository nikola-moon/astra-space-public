import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatDateTime, formatTime } from '../lib/format';
import type { LinkState, Session } from '../lib/types';
import { colors, radius, space, type } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        <Text style={type.section} accessibilityRole="header">
          {title}
        </Text>
        {hint ? <Text style={type.small}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Chip({ label, color = colors.inkSoft, bg = colors.bg, icon, dashed }: {
  label: string;
  color?: string;
  bg?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  dashed?: boolean;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: dashed ? color : bg, borderStyle: dashed ? 'dashed' : 'solid' }]}>
      {icon ? <Ionicons name={icon} size={13} color={color} /> : null}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, accessibilityHint }: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  const fg = variant === 'primary' ? colors.white : colors.navy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.navy },
        variant === 'secondary' && { backgroundColor: colors.accentSoft },
        variant === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const LINK_LABEL: Record<LinkState, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  connected: { label: 'Station connectée', color: '#1F7A4D', icon: 'radio' },
  unreachable: { label: 'Station injoignable', color: '#7A5200', icon: 'cloud-offline' },
  session_expired: { label: 'Session expirée', color: '#7A5200', icon: 'lock-closed' },
  demo: { label: 'Mode démo · données fictives', color: colors.accent, icon: 'flask' },
  loading: { label: 'Connexion…', color: colors.muted, icon: 'sync' },
};

/** En-tête commun : astronaute, liaison avec la station, dernière synchronisation. */
export function Header({ session, link, stateTime, fromCache, right }: {
  session: Session;
  link: LinkState;
  stateTime: string | null;
  fromCache: boolean;
  right?: ReactNode;
}) {
  const l = LINK_LABEL[link];
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={type.small}>Astronaute</Text>
        <Text style={type.big} numberOfLines={1}>
          {session.name}
        </Text>
        <View style={styles.headerMeta}>
          <View style={[styles.linkPill, { borderColor: l.color }]} accessibilityLabel={`Liaison : ${l.label}`}>
            <Ionicons name={l.icon} size={13} color={l.color} />
            <Text style={[styles.linkText, { color: l.color }]}>{l.label}</Text>
          </View>
          <Text style={type.small}>
            {fromCache ? 'Dernier bilan ' : 'Synchro '}
            {stateTime ? formatTime(stateTime) : '—'}
          </Text>
        </View>
      </View>
      {right}
    </View>
  );
}

export function OfflineBanner({ message, stateTime, hasData }: { message: string | null; stateTime: string | null; hasData: boolean }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={20} color="#7A5200" />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: '#7A5200', fontWeight: '700' }]}>
          {hasData ? `Dernier bilan disponible · ${formatDateTime(stateTime)}` : 'Aucun bilan enregistré sur ce téléphone'}
        </Text>
        <Text style={[type.small, { color: '#7A5200' }]}>
          {message ?? 'Station injoignable.'} Synchronisation en attente : les nouvelles séances apparaîtront au retour de la liaison.
        </Text>
      </View>
    </View>
  );
}

export function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  const missing = value === 'À confirmer';
  return (
    <View style={{ flex: 1, minWidth: 90 }}>
      <Text style={type.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
        <Text style={missing ? [type.body, { fontWeight: '700', color: colors.muted }] : [type.big]}>{value}</Text>
        {unit && !missing ? <Text style={[type.small, { marginBottom: 4 }]}>{unit}</Text> : null}
      </View>
      {sub ? <Text style={type.small}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: space.lg,
    shadowColor: '#0E1A2B',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingTop: space.sm, paddingBottom: space.md },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6, flexWrap: 'wrap' },
  linkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  linkText: { fontSize: 12, fontWeight: '700' },
  banner: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: '#FFF4D6',
    borderRadius: radius.small,
    padding: space.md,
    marginBottom: space.lg,
  },
});
