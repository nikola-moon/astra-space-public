import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Linking } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../lib/AppContext';
import { ApiError, PUBLIC_WEB, StationUnreachableError, validateStationUrl } from '../lib/api';
import { DEMO_PROFILES } from '../lib/demo';
import type { Mode } from '../lib/types';
import { Button, Card } from '../ui/components';
import { colors, radius, space, type } from '../ui/theme';

/** Profils connus du serveur de démonstration. L'identité est confirmée par la station. */
const KNOWN_PROFILES = Object.entries(DEMO_PROFILES).map(([id, p]) => ({ id, name: p.name }));

export default function Connexion() {
  const { session, login, apiUrl, setStationUrl } = useApp();
  const [mode, setMode] = useState<Mode>(PUBLIC_WEB || apiUrl ? 'api' : 'demo');
  const [profileId, setProfileId] = useState(KNOWN_PROFILES[0].id);
  const [code, setCode] = useState('');
  const [url, setUrl] = useState(apiUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'api') {
        validateStationUrl(url);
        await setStationUrl(url);
      }
      await login(mode, profileId, code);
      setCode('');
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof StationUnreachableError
          ? `Station injoignable à ${url || 'l’adresse configurée'}. Vérifiez que le téléphone et l’ordinateur de bord sont sur le même réseau local.`
          : err instanceof ApiError
            ? err.detail
            : err instanceof Error
              ? err.message
              : 'Connexion impossible.',
      );
    } finally {
      setCode('');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="planet" size={30} color={colors.navy} />
            </View>
            <Text style={styles.brandTitle}>ASTRA Space</Text>
            <Text style={styles.brandSub}>Votre suivi d’entraînement en mission, sur le réseau local de la station.</Text>
          </View>

          <Card>
            {PUBLIC_WEB ? (
              <>
                <Text style={type.label}>Version publique · données fictives</Text>
                <Text style={[type.small, { marginTop: space.sm }]}>Choisissez un profil. Votre station d’essai est isolée des autres visiteurs.</Text>
              </>
            ) : (
              <>
            <Text style={[type.label, { marginBottom: space.sm }]}>Source des données</Text>
            <View style={styles.segment} accessibilityRole="tablist">
              {(['api', 'demo'] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => { setMode(m); setCode(''); setError(null); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                  style={[styles.segBtn, mode === m && styles.segOn]}
                >
                  <Text style={[styles.segText, mode === m && { color: colors.white }]}>{m === 'api' ? 'Station locale' : 'Démo hors ligne'}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[type.small, { marginTop: space.sm }]}>
              {mode === 'api'
                ? 'Les données viennent du serveur ASTRA de l’ordinateur de bord. Internet n’est pas nécessaire.'
                : 'Deux profils fictifs et des scénarios de zones colorées, sans serveur. Aucune donnée réelle.'}
            </Text>

            {mode === 'api' ? (
              <>
                <Text style={[type.label, { marginTop: space.lg }]}>Adresse de la station</Text>
                <TextInput
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://station.example:8010"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={styles.input}
                  accessibilityLabel="Adresse de la station"
                />
              </>
            ) : null}

              </>
            )}

            <Text style={[type.label, { marginTop: space.lg }]}>Profil</Text>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
              {KNOWN_PROFILES.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setProfileId(p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: profileId === p.id }}
                  style={[styles.profile, profileId === p.id && styles.profileOn]}
                >
                  <Ionicons name="person" size={18} color={profileId === p.id ? colors.white : colors.navy} />
                  <Text style={[styles.profileText, profileId === p.id && { color: colors.white }]}>{p.name}</Text>
                </Pressable>
              ))}
            </View>

            {mode === 'api' && !PUBLIC_WEB ? (
              <>
                <Text style={[type.label, { marginTop: space.lg }]}>Mot de passe du profil</Text>
                <TextInput value={code} onChangeText={setCode} secureTextEntry autoCapitalize="none" autoCorrect={false}
                  maxLength={128} style={styles.input} onSubmitEditing={submit} accessibilityLabel="Mot de passe du profil" />
              </>
            ) : null}

            {error ? (
              <View style={styles.error} accessibilityRole="alert">
                <Text style={[type.body, { color: '#7A5200' }]}>{error}</Text>
              </View>
            ) : null}

            <View style={{ marginTop: space.lg }}>
              <Button label="Ouvrir mon espace" icon="log-in-outline" onPress={submit} loading={busy} disabled={mode === 'api' && !PUBLIC_WEB && !code} />
            </View>
            {PUBLIC_WEB ? (
              <View style={{ marginTop: space.sm }}>
                <Button label="Présentation / Project overview" icon="information-circle-outline" variant="secondary"
                  onPress={() => { void Linking.openURL(apiUrl + '/presentation'); }} />
              </View>
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.xl, flexGrow: 1, justifyContent: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', gap: space.sm },
  logo: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  brandTitle: { color: colors.white, fontSize: 30, fontWeight: '900', letterSpacing: 0.5 },
  brandSub: { color: '#C9D4E8', fontSize: 15, textAlign: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.pill, padding: 4 },
  segBtn: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.navy },
  segText: { fontWeight: '700', color: colors.navy },
  input: {
    marginTop: space.sm,
    minHeight: 48,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  profile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.line,
  },
  profileOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  profileText: { fontWeight: '700', color: colors.navy, flexShrink: 1 },
  error: { backgroundColor: '#FFF4D6', borderRadius: radius.small, padding: space.md, marginTop: space.md },
});
