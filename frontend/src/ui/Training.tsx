import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { formatDate, formatDateTime, measure, minutes } from '../lib/format';
import type { MeState, WorkoutEntry } from '../lib/types';
import { Card, Chip, SectionTitle, Stat } from './components';
import { colors, radius, space, type } from './theme';

/** Statuts d'entraînement : couleurs neutres, les couleurs d'alerte restent réservées à la santé. */
export function WorkoutChip({ status }: { status: string }) {
  if (status === 'Confirmée') return <Chip label="Cible atteinte · Confirmée" color={colors.white} bg={colors.navy} icon="checkmark" />;
  if (status === 'À examiner') return <Chip label="À examiner" color={colors.navy} bg={colors.accentSoft} icon="eye-outline" />;
  return <Chip label="À confirmer" color={colors.muted} bg={colors.card} icon="help-circle-outline" dashed />;
}

function dataStatus(w: WorkoutEntry): string {
  const missing: string[] = [];
  if (w.power_w === null) missing.push('puissance');
  if (w.duration_s === null) missing.push('durée');
  if (w.heart_rate_avg_bpm === null) missing.push('fréquence cardiaque');
  if (w.rpe === null) missing.push('effort ressenti');
  return missing.length ? `Données manquantes : ${missing.join(', ')}` : 'Données complètes reçues de l’appareil';
}

export function TrainingSummary({ state }: { state: MeState }) {
  const last = state.history[0];
  return (
    <Card>
      <SectionTitle
        title="Bilan d’entraînement"
        hint={`${state.equipment} · ${state.comparison_count} séance${state.comparison_count > 1 ? 's' : ''} comparable${state.comparison_count > 1 ? 's' : ''}`}
      />
      {!last ? (
        <Text style={type.body}>Aucune séance reçue pour ce profil. Le bilan apparaîtra après la première séance synchronisée.</Text>
      ) : (
        <>
          <View style={styles.lastHead}>
            <View>
              <Text style={type.label}>Dernière séance</Text>
              <Text style={type.body}>{formatDateTime(last.ended_at)}</Text>
            </View>
            <WorkoutChip status={last.status} />
          </View>

          <View style={styles.hero}>
            <Text style={[type.hero, last.power_w === null && { fontSize: 22, color: colors.muted }]}>
              {last.power_w === null ? 'À confirmer' : String(last.power_w)}
            </Text>
            {last.power_w !== null ? <Text style={[type.title, { color: colors.muted, marginBottom: 8 }]}>W mesurés</Text> : null}
          </View>

          <View style={styles.cols}>
            <View style={styles.col}>
              <Text style={styles.colTitle}>Objectif prévu</Text>
              <Stat label="Puissance" value={measure(last.target_w)} unit="W" />
              <Stat label="Durée" value={minutes(state.program.duration_s) ?? 'À confirmer'} />
            </View>
            <View style={styles.col}>
              <Text style={styles.colTitle}>Résultat mesuré</Text>
              <Stat label="Durée" value={minutes(last.duration_s) ?? 'À confirmer'} />
              <Stat label="FC moyenne" value={measure(last.heart_rate_avg_bpm)} unit="bpm" />
            </View>
            <View style={styles.col}>
              <Text style={styles.colTitle}>Effort ressenti déclaré</Text>
              <Stat label="Échelle 0 à 10" value={measure(last.rpe)} unit="/ 10" sub={last.rpe === null ? 'Non déclaré' : 'Auto-déclaration'} />
            </View>
          </View>
          <Text style={[type.small, { marginTop: space.sm }]}>{dataStatus(last)}</Text>

          <View style={styles.explain}>
            <Text style={type.body}>{state.explanation}</Text>
          </View>

          <Text style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>Historique</Text>
          <HistoryChart history={state.history} />
          {state.history.map((w, i) => (
            <View key={`${w.ended_at}-${i}`} style={styles.row}>
              <View style={{ width: 52 }}>
                <Text style={[type.body, { fontWeight: '700', color: colors.ink }]}>{formatDate(w.ended_at)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>
                  {measure(w.power_w, 'W')} <Text style={type.small}>/ cible {measure(w.target_w, 'W')}</Text>
                </Text>
                <Text style={type.small}>
                  {minutes(w.duration_s) ?? 'Durée à confirmer'} · FC {measure(w.heart_rate_avg_bpm, 'bpm')} · Effort {w.rpe === null ? 'à confirmer' : `${w.rpe}/10`}
                </Text>
              </View>
              <WorkoutChip status={w.status} />
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

/** Barres de puissance mesurée, trait de la cible, du plus ancien au plus récent. */
function HistoryChart({ history }: { history: WorkoutEntry[] }) {
  const items = [...history].reverse().slice(-8);
  const max = Math.max(1, ...items.map((w) => Math.max(w.power_w ?? 0, w.target_w ?? 0))) * 1.15;
  const w = 300;
  const h = 110;
  const step = w / Math.max(items.length, 1);
  const bw = Math.min(26, step * 0.5);
  return (
    <View accessibilityLabel={`Graphique de ${items.length} séances : puissance mesurée et cible`} style={{ alignItems: 'center', marginBottom: space.sm }}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {items.map((it, i) => {
          const x = i * step + (step - bw) / 2;
          const ph = ((it.power_w ?? 0) / max) * (h - 10);
          const th = h - ((it.target_w ?? 0) / max) * (h - 10);
          const latest = i === items.length - 1;
          return [
            <Rect key={`b${i}`} x={x} y={h - ph} width={bw} height={ph} rx={6} fill={latest ? colors.chartBarStrong : colors.chartBar} />,
            <Line key={`t${i}`} x1={x - 4} x2={x + bw + 4} y1={th} y2={th} stroke={colors.navy} strokeWidth={2} />,
          ];
        })}
      </Svg>
      <Text style={type.small}>Barres : puissance mesurée · trait : cible prévue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lastHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginVertical: space.md },
  cols: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 100, backgroundColor: colors.bg, borderRadius: radius.small, padding: space.md, gap: space.sm },
  colTitle: { fontSize: 13, fontWeight: '800', color: colors.navy },
  explain: { backgroundColor: colors.accentSoft, borderRadius: radius.small, padding: space.md, marginTop: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
