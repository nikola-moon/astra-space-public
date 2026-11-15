import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../../lib/AppContext';
import { ApiError, StationUnreachableError } from '../../lib/api';
import { PROGRAM_STATUS } from '../../lib/format';
import { TOPICS, type DiscussionReply, type HealthSignal, type Topic } from '../../lib/types';
import { BodyMap, Legend, SignalSheet } from '../../ui/BodyMap';
import { Button, Card, Chip, Header, OfflineBanner, SectionTitle } from '../../ui/components';
import { colors, radius, space, statusStyle, type } from '../../ui/theme';
import { TrainingSummary } from '../../ui/Training';

export default function MonSuivi() {
  const { session, state, stateTime, fromCache, link, linkMessage, refresh } = useApp();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  if (!session) return null;
  const offline = link === 'unreachable' || link === 'session_expired';
  const mapWidth = Math.min(width - 2 * space.lg - 2 * space.lg, 260);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }
      >
        <Header
          session={session}
          link={link}
          stateTime={stateTime}
          fromCache={fromCache}
          right={
            <Pressable
              onPress={() => router.push('/console')}
              accessibilityRole="button"
              accessibilityLabel="Profil, station et console de démonstration"
              style={styles.iconBtn}
            >
              <Ionicons name="person-circle-outline" size={28} color={colors.navy} />
            </Pressable>
          }
        />
        {offline ? <OfflineBanner message={linkMessage} stateTime={stateTime} hasData={!!state} /> : null}

        {!state ? (
          <Card>
            <Text style={type.body}>{offline ? 'Aucun bilan n’a encore été enregistré pour ce profil sur ce téléphone.' : 'Chargement du bilan…'}</Text>
          </Card>
        ) : (
          <View style={{ gap: space.lg }}>
            <HealthOverview signals={state.signals ?? null} mapWidth={mapWidth} demo={session.mode === 'demo'} />
            <TrainingSummary state={state} />
            <Discussion key={`${session.mode}-${session.profileId}`} />
            <GoButton status={state.program.status} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HealthOverview({ signals, mapWidth, demo }: { signals: HealthSignal[] | null; mapWidth: number; demo: boolean }) {
  const [open, setOpen] = useState<HealthSignal | null>(null);
  const unlocated = (signals ?? []).filter((s) => !s.zone);
  return (
    <Card>
      <SectionTitle
        title="Aperçu santé"
        hint={demo ? 'Scénario fictif du mode démo' : 'Zones et priorités transmises par la station'}
      />
      {signals === null ? (
        <View style={styles.unavailable} accessibilityRole="text">
          <Ionicons name="information-circle-outline" size={20} color={statusStyle.unavailable.text} />
          <Text style={[type.body, { flex: 1, color: statusStyle.unavailable.text }]}>
            <Text style={{ fontWeight: '800' }}>Données indisponibles. </Text>
            La station ne transmet pas encore de signaux de santé localisés pour ce profil. Aucune zone n’est donc colorée.
          </Text>
        </View>
      ) : null}
      <BodyMap signals={signals} width={mapWidth} />
      <Legend />

      {unlocated.length ? (
        <View style={{ marginTop: space.lg }}>
          <Text style={[type.label, { marginBottom: space.sm }]}>Signaux sans localisation</Text>
          {unlocated.map((s) => {
            const st = statusStyle[s.status];
            return (
              <Pressable
                key={s.id}
                onPress={() => setOpen(s)}
                accessibilityRole="button"
                accessibilityLabel={`${s.label} : ${st.label}`}
                style={({ pressed }) => [styles.signalRow, { borderLeftColor: st.color }, pressed && { opacity: 0.8 }]}
              >
                <Text style={[type.body, { flex: 1, color: colors.ink, fontWeight: '600' }]}>{s.label}</Text>
                <Chip label={st.short} color={st.text} bg={st.soft} />
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <SignalSheet title="Signal sans localisation" signals={open ? [open] : null} onClose={() => setOpen(null)} />
    </Card>
  );
}

interface Message {
  from: 'me' | 'astra';
  text: string;
  meta?: string;
}

function Discussion() {
  const { ask } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    { from: 'astra', text: 'Bonjour ! Que voulez-vous consulter ? Choisissez une question ci-dessous.' },
  ]);
  const [followUp, setFollowUp] = useState<DiscussionReply['follow_up']>();
  const [busy, setBusy] = useState<Topic | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => void (mounted.current = false);
  }, []);

  const send = async (topic: Topic, label: string) => {
    setBusy(topic);
    setFollowUp(undefined);
    setMessages((m) => [...m, { from: 'me', text: label }]);
    try {
      const res = await ask(topic);
      if (mounted.current) {
        setMessages((m) => [...m, { from: 'astra', text: res.answer, meta: res.mode }]);
        setFollowUp(res.follow_up);
      }
    } catch (err) {
      const text =
        err instanceof StationUnreachableError
          ? 'La station est injoignable. Je ne peux pas consulter votre dossier pour le moment.'
          : err instanceof ApiError
            ? err.detail
            : 'Réponse indisponible.';
      if (mounted.current) setMessages((m) => [...m, { from: 'astra', text, meta: 'Erreur' }]);
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  return (
    <Card>
      <SectionTitle title="Discussion avec ASTRA" hint="Trois sujets acceptés par la station" />
      <View style={{ gap: space.sm }}>
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.from === 'me' ? styles.me : styles.astra]}>
            <Text style={[type.body, m.from === 'me' && { color: colors.white }]}>{m.text}</Text>
            {m.meta ? <Text style={[type.small, { marginTop: 4, fontSize: 11 }]}>{m.meta}</Text> : null}
          </View>
        ))}
      </View>
      {followUp ? (
        <View style={[styles.bubble, styles.astra, { marginTop: space.sm }]}>
          <Text style={type.body}>{followUp.question}</Text>
          <View style={styles.quick}>
            <Pressable onPress={() => send(followUp.topic, 'Oui')} accessibilityRole="button" style={styles.quickBtn}>
              <Text style={styles.quickText}>Oui</Text>
            </Pressable>
            <Pressable onPress={() => setFollowUp(undefined)} accessibilityRole="button" style={styles.quickBtn}>
              <Text style={styles.quickText}>Plus tard</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={styles.quick}>
        {TOPICS.map((t) => (
          <Pressable
            key={t.topic}
            disabled={!!busy}
            onPress={() => send(t.topic, t.label)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.quickBtn, (pressed || busy === t.topic) && { opacity: 0.6 }]}
          >
            <Text style={styles.quickText}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: space.md }}>
        <Button
          label="Signaler un problème à bord"
          icon="flag-outline"
          variant="ghost"
          onPress={() => router.push('/signalement')}
          accessibilityHint="Ouvre un formulaire distinct, transmis à l’équipage à bord"
        />
      </View>
    </Card>
  );
}

function GoButton({ status }: { status: string }) {
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.md }}>
      <Pressable
        onPress={() => router.push('/programme')}
        accessibilityRole="button"
        accessibilityLabel="GO, ouvrir mon programme validé"
        style={({ pressed }) => [styles.go, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <Text style={styles.goText}>GO</Text>
      </Pressable>
      <Text style={[type.body, { fontWeight: '700', color: colors.ink }]}>Ouvrir mon programme</Text>
      <Text style={type.small}>{PROGRAM_STATUS[status] ?? `État du dossier : ${status}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 120 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  unavailable: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: statusStyle.unavailable.soft,
    borderRadius: radius.small,
    padding: space.md,
    marginBottom: space.md,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.small,
    borderLeftWidth: 4,
    padding: space.md,
    marginBottom: space.sm,
    minHeight: 48,
  },
  bubble: { maxWidth: '88%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  me: { alignSelf: 'flex-end', backgroundColor: colors.navy, borderBottomRightRadius: 4 },
  astra: { alignSelf: 'flex-start', backgroundColor: colors.bg, borderBottomLeftRadius: 4 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  quickBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  quickText: { color: colors.navy, fontWeight: '700', fontSize: 14 },
  go: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: colors.accentSoft,
  },
  goText: { color: colors.white, fontSize: 36, fontWeight: '900', letterSpacing: 2 },
});
