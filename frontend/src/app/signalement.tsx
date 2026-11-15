import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../lib/AppContext';
import { ApiError, StationUnreachableError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { REPORT_CATEGORIES, type ReportCategory, type ReportResult } from '../lib/types';
import { Button, Card } from '../ui/components';
import { SheetScreen } from '../ui/Sheet';
import { colors, radius, space, type } from '../ui/theme';

/** Signalement à l'équipage à bord : distinct de la discussion avec ASTRA. */
export default function Signalement() {
  const { session, state, report } = useApp();
  const [choice, setChoice] = useState<ReportCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!session) return <Redirect href="/connexion" />;

  const submit = async () => {
    if (!choice) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await report(choice));
    } catch (err) {
      setError(
        err instanceof StationUnreachableError
          ? 'Station injoignable : le signalement n’a pas été transmis. Réessayez quand la liaison locale est rétablie, ou prévenez l’équipage de vive voix.'
          : err instanceof ApiError
            ? err.detail
            : 'Envoi impossible.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetScreen title="Signaler un problème à bord">
      <Card>
        <Text style={type.body}>
          Ce signalement est transmis à l’équipage à bord. Il ne passe pas par la discussion avec ASTRA. En cas d’urgence, suivez la procédure de la station.
        </Text>
        <Text style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>Motif</Text>
        <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
          {REPORT_CATEGORIES.map((c) => {
            const selected = choice === c;
            return (
              <Pressable
                key={c}
                onPress={() => setChoice(c)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[styles.option, selected && styles.optionOn]}
              >
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.navy : colors.muted} />
                <Text style={[type.body, { flex: 1, color: colors.ink, fontWeight: selected ? '700' : '400' }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: space.lg }}>
          <Button label="Envoyer le signalement" icon="send" onPress={submit} disabled={!choice} loading={busy} />
        </View>
      </Card>

      {result ? (
        <View style={styles.confirm} accessibilityRole="alert">
          <Ionicons name="checkmark-circle" size={24} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { fontWeight: '800', color: colors.navy }]}>
              {result.already_registered ? 'Ce signalement était déjà enregistré' : 'Signalement enregistré par la station'}
            </Text>
            <Text style={type.small}>
              N° {result.report.id} · {result.report.category} · {formatDateTime(result.report.created_at)}
            </Text>
          </View>
        </View>
      ) : null}
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={[type.body, { color: '#7A5200' }]}>{error}</Text>
        </View>
      ) : null}

      {state?.reports.length ? (
        <Card>
          <Text style={[type.label, { marginBottom: space.sm }]}>Mes signalements</Text>
          {state.reports.map((r) => (
            <View key={String(r.id)} style={styles.row}>
              <Text style={[type.body, { flex: 1 }]}>{r.category}</Text>
              <Text style={type.small}>{formatDateTime(r.created_at)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 52,
  },
  optionOn: { borderColor: colors.navy, backgroundColor: colors.accentSoft },
  confirm: { flexDirection: 'row', gap: space.md, backgroundColor: colors.accentSoft, borderRadius: radius.small, padding: space.md },
  error: { backgroundColor: '#FFF4D6', borderRadius: radius.small, padding: space.md },
  row: { flexDirection: 'row', gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
});
