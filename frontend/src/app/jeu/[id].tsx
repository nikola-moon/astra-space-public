import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Assemblage } from '../../games/Assemblage';
import { Constellations } from '../../games/Constellations';
import { Mandala } from '../../games/Mandala';
import { Regard } from '../../games/Regard';
import { Souffle } from '../../games/Souffle';
import { useApp } from '../../lib/AppContext';
import { GAMES, gameAccess, recordPlay } from '../../lib/games';
import { profileKey, storage } from '../../lib/storage';
import type { Stage } from '../../lib/types';
import { Button, Card } from '../../ui/components';
import { NovaAvatar } from '../../ui/Nova';
import { SheetScreen } from '../../ui/Sheet';
import { colors, radius, space, type } from '../../ui/theme';

export default function JeuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, state } = useApp();
  const game = GAMES.find((g) => g.id === id);
  const [result, setResult] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [mandala, setMandala] = useState<string[] | null | undefined>(undefined);
  // Nova vérifie à l'ouverture ; s'il change d'avis pendant la partie, on laisse finir.
  const [access] = useState(() => (game ? gameAccess(state, game) : null));

  const mandalaKey = session ? profileKey(session.mode, session.profileId, 'mandala') : '';
  useEffect(() => {
    if (game?.id === 'mandala' && mandalaKey) storage.readJson<string[]>(mandalaKey).then((v) => setMandala(v));
  }, [game?.id, mandalaKey]);
  const saveMandala = useCallback((fills: string[]) => void storage.writeJson(mandalaKey, fills), [mandalaKey]);

  const onDone = useCallback(
    (score: number | null, summary: string) => {
      if (session && game) recordPlay(session, game.id, score, game.id !== 'regard');
      setResult(summary);
    },
    [session, game],
  );

  if (!session) return <Redirect href="/connexion" />;
  if (!game || !access) return <Redirect href="/chat" />;
  const stage = (state?.companion.age ?? 'Bébé') as Stage;

  return (
    <SheetScreen title={game.title}>
      {!access.allowed ? (
        <Card style={{ alignItems: 'center', gap: space.md }}>
          <NovaAvatar stage={stage} reaction="idle" reactionKey={0} size={150} />
          <Text style={[type.body, { textAlign: 'center' }]}>{access.reason}</Text>
          <Button label="Retour à Mon chat" variant="secondary" onPress={() => router.back()} />
        </Card>
      ) : result ? (
        <Card style={{ alignItems: 'center', gap: space.md }}>
          <NovaAvatar stage={stage} reaction="pet" reactionKey={1} size={150} />
          <Text style={type.title}>Belle pause</Text>
          <Text style={[type.body, { textAlign: 'center' }]}>{result}</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>Les jeux n’ajoutent aucune séance au dossier d’entraînement.</Text>
          <View style={{ alignSelf: 'stretch', gap: space.sm }}>
            <Button label="Rejouer" icon="refresh" variant="secondary" onPress={() => setResult(null)} />
            <Button label="Retour à Mon chat" onPress={() => router.back()} />
          </View>
        </Card>
      ) : (
        <Card>
          {game.id === 'souffle' ? <Souffle stage={stage} onDone={onDone} /> : null}
          {game.id === 'regard' ? <Regard stage={stage} onDone={onDone} /> : null}
          {game.id === 'constellations' ? <Constellations stage={stage} onDone={onDone} /> : null}
          {game.id === 'assemblage' ? <Assemblage stage={stage} onDone={onDone} /> : null}
          {game.id === 'mandala' && mandala !== undefined ? (
            <Mandala stage={stage} onDone={onDone} saved={mandala} onSave={saveMandala} />
          ) : null}
        </Card>
      )}

      <Card>
        <Pressable
          onPress={() => setShowWhy((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showWhy }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
        >
          <Ionicons name="book-outline" size={20} color={colors.navy} />
          <Text style={[type.section, { flex: 1 }]}>Pourquoi ce jeu ?</Text>
          <Ionicons name={showWhy ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
        </Pressable>
        {showWhy ? (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <Text style={type.body}>{game.why}</Text>
            <View style={styles.caution}>
              <Text style={[type.small, { color: '#7A5200' }]}>{game.caution}</Text>
            </View>
            <Text style={type.label}>Sources</Text>
            {game.sources.map((s) => (
              <Pressable key={s.url} onPress={() => Linking.openURL(s.url).catch(() => undefined)} accessibilityRole="link">
                <Text style={[type.small, { color: colors.accent }]}>{s.label}</Text>
              </Pressable>
            ))}
            <Text style={type.small}>Les liens demandent Internet ; les références restent lisibles hors ligne.</Text>
          </View>
        ) : null}
      </Card>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  caution: { backgroundColor: '#FFF4D6', borderRadius: radius.small, padding: space.md },
});
