import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../lib/AppContext';
import { EXERCISE_LABEL, formatDateTime, minutes, PROGRAM_STATUS } from '../lib/format';
import { Card, Chip } from '../ui/components';
import { SheetScreen } from '../ui/Sheet';
import { colors, radius, space, type } from '../ui/theme';

/** Écran ouvert par le bouton GO : programme en vigueur, tel que reçu de la station. */
export default function Programme() {
  const { session, state, stateTime, fromCache } = useApp();
  if (!session) return <Redirect href="/connexion" />;

  if (!state) {
    return (
      <SheetScreen title="Mon programme">
        <Card>
          <Text style={type.title}>Dossier sans programme disponible</Text>
          <Text style={[type.body, { marginTop: space.sm }]}>
            Aucun programme n’a encore été reçu de la station pour ce profil. Il s’affichera après la prochaine synchronisation.
          </Text>
        </Card>
      </SheetScreen>
    );
  }

  const p = state.program;
  const pending = p.status === 'pending_approval';
  const approved = p.status === 'approved';
  const initial = p.status === 'initial';

  return (
    <SheetScreen title="Mon programme">
      {pending ? (
        <View style={styles.notice}>
          <Ionicons name="hourglass-outline" size={20} color={colors.navy} />
          <Text style={[type.body, { flex: 1, color: colors.navy }]}>
            <Text style={{ fontWeight: '800' }}>Proposition en attente de décision à bord. </Text>
            Le programme ci-dessous reste en vigueur jusqu’à la validation.
          </Text>
        </View>
      ) : null}
      {initial ? (
        <View style={styles.notice}>
          <Ionicons name="document-text-outline" size={20} color={colors.navy} />
          <Text style={[type.body, { flex: 1, color: colors.navy }]}>
            <Text style={{ fontWeight: '800' }}>Aucun ajustement validé à bord pour l’instant. </Text>
            Le plan initial établi par le spécialiste est en vigueur.
          </Text>
        </View>
      ) : null}
      {!pending && !approved && !initial ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.navy} />
          <Text style={[type.body, { flex: 1, color: colors.navy }]}>
            État du dossier : {PROGRAM_STATUS[p.status] ?? p.status}. Le programme en vigueur reste celui affiché ci-dessous.
          </Text>
        </View>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' }}>
          <Text style={type.label}>Programme en vigueur</Text>
          <Chip
            label={approved ? 'Validé à bord' : initial ? 'Plan initial' : 'Programme actuel'}
            color={approved ? colors.white : colors.navy}
            bg={approved ? colors.navy : colors.accentSoft}
            icon={approved ? 'checkmark-circle' : 'time-outline'}
          />
        </View>

        <View style={styles.exercise}>
          <View style={styles.icon}>
            <Ionicons name="bicycle" size={28} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>{EXERCISE_LABEL.cycling}</Text>
            <Text style={type.body}>Appareil : {EXERCISE_LABEL[state.equipment] ?? state.equipment}</Text>
          </View>
        </View>

        <View style={styles.params}>
          <Param label="Puissance cible" value={p.power_w === null ? 'À confirmer' : String(p.power_w)} unit="W" />
          <Param label="Durée" value={minutes(p.duration_s) ?? 'À confirmer'} />
        </View>

        {approved ? (
          <Text style={[type.small, { marginTop: space.md }]}>Validé à bord le {formatDateTime(p.validated_at)}.</Text>
        ) : null}
        <Text style={[type.body, { marginTop: space.md }]}>{state.explanation}</Text>
      </Card>

      <Text style={type.small}>
        Paramètres reçus de la station {fromCache ? `(dernier bilan du ${formatDateTime(stateTime)})` : `le ${formatDateTime(stateTime)}`}. ASTRA n’invente aucun paramètre : seuls ceux transmis sont affichés.
      </Text>
    </SheetScreen>
  );
}

function Param({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const missing = value === 'À confirmer';
  return (
    <View style={styles.param}>
      <Text style={type.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
        <Text style={missing ? [type.body, { color: colors.muted, fontWeight: '700' }] : type.hero}>{value}</Text>
        {unit && !missing ? <Text style={[type.title, { color: colors.muted, marginBottom: 8 }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: space.sm, backgroundColor: colors.accentSoft, borderRadius: radius.small, padding: space.md },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  icon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  params: { flexDirection: 'row', gap: space.md, marginTop: space.lg, flexWrap: 'wrap' },
  param: { flex: 1, minWidth: 130, backgroundColor: colors.bg, borderRadius: radius.small, padding: space.md },
});
