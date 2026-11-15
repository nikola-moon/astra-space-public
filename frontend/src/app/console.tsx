import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { useApp } from '../lib/AppContext';
import { api, ApiError, PUBLIC_WEB, StationUnreachableError } from '../lib/api';
import { demo, type SignalScenario } from '../lib/demo';
import { petDemo } from '../lib/pet';
import type { StationAction } from '../lib/types';
import { Button, Card } from '../ui/components';
import { SheetScreen } from '../ui/Sheet';
import { colors, radius, space, type } from '../ui/theme';

type ConsoleAction = { action: StationAction | 'incomplete' | 'family'; sample?: 3 | 4 | 5; label: string };

const ACTIONS: ConsoleAction[] = [
  { action: 'import', sample: 3, label: 'Importer la séance 3' },
  { action: 'draft', label: 'Calculer l’ajustement' },
  { action: 'specialist', label: 'Simuler la revue spécialiste' },
  { action: 'approve', label: 'Simuler l’approbation de bord' },
  { action: 'import', sample: 4, label: 'Importer la séance 4' },
  { action: 'import', sample: 5, label: 'Importer la séance 5' },
  { action: 'rest', label: 'Mode repos' },
  { action: 'work', label: 'Mode travail' },
  { action: 'uplink', label: 'Liaison sol (courrier famille)' },
];

const SCENARIOS: { id: SignalScenario; label: string }[] = [
  { id: 'profil', label: 'Zones du profil' },
  { id: 'calme', label: 'Aucune alerte' },
  { id: 'indisponible', label: 'Données indisponibles' },
];

/** Profil, station et console de simulation. Ces commandes sont séparées de celles de l'astronaute. */
export default function Console() {
  const { session, logout, refresh, apiUrl } = useApp();
  const [stationCode, setStationCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flags, setFlags] = useState<{ scenario: SignalScenario; stationDown: boolean } | null>(null);

  useEffect(() => {
    if (session?.mode === 'demo') demo.getFlags(session).then(setFlags);
  }, [session]);

  if (!session) return <Redirect href="/connexion" />;
  const isDemo = session.mode === 'demo';

  const run = async (a: ConsoleAction) => {
    setBusy(a.label);
    setMessage(null);
    try {
      if (isDemo) setMessage(await demo.action(session, a.action, a.sample));
      else {
        if (a.action === 'incomplete' || a.action === 'family') return;
        const res = await api.stationAction(stationCode, a.action, a.sample);
        setMessage(res.message);
      }
      await refresh();
    } catch (err) {
      if (!isDemo && err instanceof ApiError && (err.status === 403 || err.status === 429)) setStationCode('');
      setMessage(
        err instanceof StationUnreachableError ? 'Station injoignable.' : err instanceof ApiError ? err.detail : err instanceof Error ? err.message : 'Action impossible.',
      );
    } finally {
      setBusy(null);
    }
  };

  const updateFlags = async (next: Partial<{ scenario: SignalScenario; stationDown: boolean }>) => {
    if (next.scenario) await demo.setScenario(session, next.scenario);
    if (next.stationDown !== undefined) await demo.setStationDown(session, next.stationDown);
    setFlags(await demo.getFlags(session));
    await refresh();
  };

  return (
    <SheetScreen title="Profil et station">
      <Card>
        <Text style={type.label}>Profil ouvert</Text>
        <Text style={[type.title, { marginTop: 4 }]}>{session.name}</Text>
        <Text style={type.small}>{isDemo ? 'Mode démo hors ligne · données fictives' : `Station locale · ${apiUrl || 'adresse non configurée'}`}</Text>
        <View style={{ marginTop: space.lg }}>
          <Button
            label="Changer de profil"
            icon="swap-horizontal"
            variant="secondary"
            onPress={async () => {
              await logout();
              router.replace('/connexion');
            }}
          />
        </View>
      </Card>

      <Card>
        <Text style={type.section}>Console de démonstration</Text>
        <Text style={[type.small, { marginTop: 4 }]}>
          {isDemo
            ? 'Simule les événements de la station sur ce profil fictif. Rien n’est envoyé sur le réseau.'
            : 'Appelle les routes /api/demo/* du serveur de démonstration. Réservé à la présentation.'}
        </Text>
        {!isDemo && !PUBLIC_WEB ? (
          <TextInput
            value={stationCode}
            onChangeText={setStationCode}
            placeholder="Mot de passe de la console"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={128}
            style={styles.input}
            accessibilityLabel="Mot de passe de la console"
          />
        ) : null}
        <View style={styles.grid}>
          {ACTIONS.filter((a) => !PUBLIC_WEB || a.action !== 'uplink').map((a) => (
            <Pressable
              key={a.label}
              onPress={() => run(a)}
              disabled={!!busy || (!isDemo && !PUBLIC_WEB && !stationCode)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, (pressed || busy === a.label) && { opacity: 0.6 }, !isDemo && !PUBLIC_WEB && !stationCode && { opacity: 0.4 }]}
            >
              <Text style={styles.actionText}>{a.label}</Text>
            </Pressable>
          ))}
          {isDemo ? (
            <Pressable
              onPress={() => run({ action: 'incomplete', label: 'Séance sans effort ressenti' })}
              disabled={!!busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.actionText}>Séance sans effort ressenti</Text>
            </Pressable>
          ) : null}
          {isDemo ? (
            <Pressable
              onPress={() => run({ action: 'family', label: 'Envoi fictif de la famille' })}
              disabled={!!busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.actionText}>Envoi fictif de la famille</Text>
            </Pressable>
          ) : null}
        </View>
        {message ? (
          <View style={styles.msg} accessibilityRole="alert">
            <Text style={[type.body, { color: colors.navy }]}>{message}</Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={type.section}>Soins de Nova</Text>
        <Text style={[type.small, { marginTop: 4 }]}>
          Raccourcis de présentation, sur ce téléphone uniquement.
          {isDemo ? ' En mode démo, le temps de Nova est accéléré : 1 minute réelle = 1 heure.' : ''}
        </Text>
        <View style={styles.grid}>
          {[
            { label: 'Nova a faim', fn: () => petDemo.makeHungry(session), msg: 'Nova a maintenant faim.' },
            { label: 'Salir la litière', fn: () => petDemo.addLitter(session), msg: 'La litière est à nettoyer.' },
            ...(isDemo ? [{ label: 'Jour / nuit', fn: () => petDemo.toggleNight(session), msg: 'Le cycle jour/nuit de Nova a basculé.' }] : []),
            { label: 'Nouvelle capsule', fn: () => petDemo.reset(session), msg: 'Une nouvelle capsule attend d’être ouverte.' },
          ].map((a) => (
            <Pressable
              key={a.label}
              onPress={async () => {
                await a.fn();
                setMessage(a.msg);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.actionText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {isDemo && flags ? (
        <Card>
          <Text style={type.section}>Scénario de zones</Text>
          <View style={styles.grid}>
            {SCENARIOS.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => updateFlags({ scenario: s.id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: flags.scenario === s.id }}
                style={[styles.action, flags.scenario === s.id && styles.actionOn]}
              >
                <Text style={[styles.actionText, flags.scenario === s.id && { color: colors.white }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[type.section, { marginTop: space.lg }]}>Liaison avec la station</Text>
          <Text style={[type.small, { marginTop: 4 }]}>Simule une coupure pour vérifier l’affichage du dernier bilan et du statut de synchronisation.</Text>
          <View style={{ marginTop: space.md }}>
            <Button
              label={flags.stationDown ? 'Rétablir la liaison' : 'Couper la liaison'}
              icon={flags.stationDown ? 'radio' : 'cloud-offline-outline'}
              variant="ghost"
              onPress={() => updateFlags({ stationDown: !flags.stationDown })}
            />
          </View>
          <View style={{ marginTop: space.sm }}>
            <Button
              label="Réinitialiser ce profil fictif"
              icon="refresh"
              variant="ghost"
              onPress={async () => {
                await demo.reset(session);
                setFlags(await demo.getFlags(session));
                setMessage('Profil fictif réinitialisé : deux séances de départ, plan initial.');
                await refresh();
              }}
            />
          </View>
        </Card>
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: space.md,
    minHeight: 48,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    fontSize: 16,
    backgroundColor: colors.bg,
    color: colors.ink,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  action: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  actionOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  actionText: { color: colors.navy, fontWeight: '700', fontSize: 14 },
  msg: { marginTop: space.md, backgroundColor: colors.accentSoft, borderRadius: radius.small, padding: space.md },
});
