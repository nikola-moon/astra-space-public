import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { useApp } from '../../lib/AppContext';
import { GAMES, gameAccess, loadStats } from '../../lib/games';
import { formatDateTime, minutes } from '../../lib/format';
import { addPhoto, listPhotos, removePhoto, type Photo } from '../../lib/photos';
import { profileKey, storage } from '../../lib/storage';
import type { FamilyKind, Session, Stage } from '../../lib/types';
import { Button, Card, Chip, Header, OfflineBanner, SectionTitle } from '../../ui/components';
import { StageDots } from '../../ui/Nova';
import { PetHabitat } from '../../ui/PetHabitat';
import { colors, radius, space, type } from '../../ui/theme';

const STAGES: Stage[] = ['Bébé', 'Jeune', 'Adulte'];

export default function MonChat() {
  const { session, state, stateTime, fromCache, link, linkMessage } = useApp();
  if (!session) return null;
  const offline = link === 'unreachable' || link === 'session_expired';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header session={session} link={link} stateTime={stateTime} fromCache={fromCache} />
        {offline ? <OfflineBanner message={linkMessage} stateTime={stateTime} hasData={!!state} /> : null}
        {/* La clé force un état neuf par profil : rien ne fuit d'un profil à l'autre. */}
        <ChatContent key={`${session.mode}-${session.profileId}`} session={session} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChatContent({ session }: { session: Session }) {
  const { state } = useApp();
  const companion = state?.companion;
  const stage = (STAGES.includes(companion?.age as Stage) ? companion?.age : 'Bébé') as Stage;
  const [evolved, setEvolved] = useState<string | null>(null);

  // Attitude d'attente : déclenchée uniquement par le statut de la dernière séance (entraînement),
  // jamais par les signaux de santé. Le stade et les jeux restent inchangés.
  const lastStatus = state?.history[0]?.status;
  const waiting = lastStatus === 'À confirmer' || lastStatus === 'À examiner';
  const idleLine =
    lastStatus === 'À confirmer'
      ? 'Nova attend la confirmation de ta dernière séance. Rien n’est perdu en attendant.'
      : lastStatus === 'À examiner'
        ? 'Nova attend que l’équipe à bord examine ta dernière séance. Il reste à tes côtés.'
        : 'Nova est bien installé près du hublot.';
  // Une priorité déclarée par la station est seulement signalée, sans détail médical.
  const hasPriority = (state?.signals ?? []).some((s) => s.status === 'priority');

  // Annonce d'évolution : comparée au dernier stade vu sur ce téléphone pour ce profil.
  useEffect(() => {
    if (!companion) return;
    const key = profileKey(session.mode, session.profileId, 'novaStage');
    (async () => {
      const seen = await storage.readJson<Stage>(key);
      if (seen && STAGES.indexOf(stage) > STAGES.indexOf(seen)) {
        setEvolved(`Nova est passé au stade ${stage} grâce à vos séances confirmées.`);
      }
      await storage.writeJson(key, stage);
    })();
  }, [stage, companion, session]);

  const confirmed = companion?.confirmed_sessions ?? 0;
  const next = companion?.next_stage_at ?? null;
  const prevThreshold = stage === 'Adulte' ? 5 : stage === 'Jeune' ? 3 : 0;
  const progress = next ? Math.min(1, (confirmed - prevThreshold) / (next - prevThreshold)) : 1;

  return (
    <View style={{ gap: space.lg }}>
      <Card>
        <SectionTitle title="Nova" hint="Votre compagnon de mission" right={<StageDots stage={stage} />} />
        {evolved ? (
          <View style={styles.evolved} accessibilityRole="alert">
            <Ionicons name="sparkles" size={18} color={colors.navy} />
            <Text style={[type.body, { flex: 1, color: colors.navy, fontWeight: '700' }]}>{evolved}</Text>
            <Pressable onPress={() => setEvolved(null)} accessibilityLabel="Masquer l’annonce" hitSlop={10}>
              <Ionicons name="close" size={18} color={colors.navy} />
            </Pressable>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginBottom: space.md, flexWrap: 'wrap' }}>
          <Text style={type.title}>Stade {stage}</Text>
          {waiting ? <Chip label="En attente de confirmation" color={colors.navy} bg={colors.accentSoft} icon="hourglass-outline" /> : null}
        </View>
        <PetHabitat session={session} stage={stage} waiting={waiting} idleLine={idleLine} family={state?.family ?? []} />
        {hasPriority ? (
          <Pressable
            onPress={() => router.navigate('/')}
            accessibilityRole="button"
            accessibilityLabel="Un point t’attend dans Mon suivi. Ouvrir Mon suivi."
            style={styles.orient}
          >
            <Ionicons name="arrow-back-circle-outline" size={20} color={colors.navy} />
            <Text style={[type.body, { flex: 1, color: colors.navy }]}>Un point t’attend dans Mon suivi.</Text>
          </Pressable>
        ) : null}

        <View style={styles.progressBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={type.label}>Séances confirmées</Text>
              <Text style={type.big}>{companion ? confirmed : '—'}</Text>
            </View>
            <Text style={[type.small, { textAlign: 'right', flex: 1, marginLeft: space.md }]}>
              {!companion
                ? 'Progression indisponible hors synchronisation'
                : next
                  ? `${Math.max(0, next - confirmed)} séance${next - confirmed > 1 ? 's' : ''} avant le stade ${stage === 'Bébé' ? 'Jeune' : 'Adulte'}`
                  : 'Stade adulte atteint'}
            </Text>
          </View>
          <View style={styles.track} accessibilityLabel={`Progression vers le stade suivant : ${Math.round(progress * 100)} %`}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={type.small}>
            Le compteur vient de la station. Une séance retransmise ne compte qu’une fois ; une séance « À confirmer » ne fait pas progresser Nova et ne lui retire rien.
          </Text>
        </View>
      </Card>

      <FamilyMail />
      <NovaGames session={session} />
      <Reminder session={session} />
      <Gallery session={session} />
    </View>
  );
}

const FAMILY_ICON: Record<FamilyKind, keyof typeof Ionicons.glyphMap> = {
  friandise: 'fish',
  caresse: 'hand-left',
  jouet: 'tennisball',
  carte: 'mail',
};
const FAMILY_LABEL: Record<FamilyKind, string> = { friandise: 'Friandise', caresse: 'Caresse', jouet: 'Jouet', carte: 'Carte' };

/** Attentions envoyées par les proches depuis le portail famille, arrivées par la liaison sol. */
function FamilyMail() {
  const { state } = useApp();
  const family = state?.family ?? [];
  return (
    <Card>
      <SectionTitle title="Courrier de la Terre" hint="Les attentions de tes proches pour Nova arrivent à chaque liaison sol" />
      {family.length === 0 ? (
        <Text style={type.small}>Rien pour l’instant. Tes proches peuvent envoyer une friandise, une caresse, un jouet ou une carte depuis le portail famille.</Text>
      ) : (
        <View style={{ gap: space.sm }}>
          {family.slice(0, 6).map((f) => (
            <View key={String(f.id)} style={styles.mail}>
              <View style={styles.mailIcon}>
                <Ionicons name={FAMILY_ICON[f.kind] ?? 'mail'} size={20} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '800', color: colors.ink }]}>
                  {f.sender} · {FAMILY_LABEL[f.kind] ?? f.kind}
                </Text>
                {f.message ? <Text style={type.body}>« {f.message} »</Text> : null}
                <Text style={type.small}>Arrivé à bord le {formatDateTime(f.delivered_at)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

/** Les jeux ne s'ouvrent que si Nova le permet : plage de repos et stade suffisant. */
function NovaGames({ session }: { session: Session }) {
  const { state } = useApp();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof loadStats>>>({});
  useFocusEffect(
    useCallback(() => {
      loadStats(session).then(setStats);
    }, [session]),
  );
  const pause = state?.companion.reminder_allowed ?? false;
  const unlocked = GAMES.filter((g) => gameAccess(state, g).allowed).length;

  return (
    <Card>
      <SectionTitle
        title="Jeux de Nova"
        hint={pause ? `Pause : Nova autorise ${unlocked} jeu${unlocked > 1 ? 'x' : ''} sur ${GAMES.length}` : 'Nova les ouvre pendant tes pauses'}
      />
      <View style={{ gap: space.sm }}>
        {GAMES.map((g) => {
          const access = gameAccess(state, g);
          const st = stats[g.id];
          return (
            <Pressable
              key={g.id}
              onPress={() => router.push({ pathname: '/jeu/[id]', params: { id: g.id } })}
              accessibilityRole="button"
              accessibilityState={{ disabled: !access.allowed }}
              accessibilityLabel={`${g.title}. ${access.allowed ? 'Disponible.' : access.reason}`}
              style={({ pressed }) => [styles.game, !access.allowed && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.gameIcon, !access.allowed && { backgroundColor: colors.line }]}>
                <Ionicons name={access.allowed ? g.icon : 'lock-closed'} size={22} color={access.allowed ? colors.white : colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '800', color: colors.ink }]}>{g.title}</Text>
                <Text style={type.small} numberOfLines={2}>
                  {access.allowed ? g.pitch : access.reason}
                </Text>
                {st?.plays ? <Text style={[type.small, { fontSize: 11 }]}>{st.plays} partie{st.plays > 1 ? 's' : ''}</Text> : null}
              </View>
              <Text style={type.small}>{g.minutes}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[type.small, { marginTop: space.md }]}>
        Activités de détente fondées sur des études publiées (détail dans chaque jeu). Elles ne remplacent pas le soutien de l’équipage.
      </Text>
    </Card>
  );
}

function Reminder({ session }: { session: Session }) {
  const { state } = useApp();
  const key = profileKey(session.mode, session.profileId, 'reminderDismissed');
  const [dismissed, setDismissed] = useState(false);
  const companion = state?.companion;

  useEffect(() => {
    (async () => {
      if (companion?.period === 'work') {
        // Nouvelle plage de travail : le prochain repos affichera de nouveau le rappel.
        await storage.writeJson(key, false);
        setDismissed(false);
      } else {
        setDismissed((await storage.readJson<boolean>(key)) ?? false);
      }
    })();
  }, [companion?.period, key]);

  if (!state || !companion) return null;
  const plan = state.program;
  return (
    <Card>
      <SectionTitle title="Rappels de séance" hint={companion.period === 'rest' ? 'Plage de repos' : 'Plage de travail'} />
      {!companion.reminder_allowed ? (
        <View style={styles.reminderMuted}>
          <Ionicons name="moon-outline" size={20} color={colors.muted} />
          <Text style={[type.body, { flex: 1 }]}>Rappels suspendus pendant la plage de travail du planning. Ils reprendront à la prochaine plage de repos.</Text>
        </View>
      ) : dismissed ? (
        <View style={styles.reminderMuted}>
          <Ionicons name="eye-off-outline" size={20} color={colors.muted} />
          <Text style={[type.body, { flex: 1 }]}>Rappel masqué pour cette plage de repos.</Text>
          <Pressable
            onPress={async () => {
              setDismissed(false);
              await storage.writeJson(key, false);
            }}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Afficher</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.reminder}>
          <Ionicons name="alarm-outline" size={24} color={colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: colors.white, fontWeight: '800' }]}>C’est l’heure de votre séance</Text>
            <Text style={[type.small, { color: '#C9D4E8' }]}>
              {state.equipment} · {plan.power_w ?? '—'} W · {minutes(plan.duration_s) ?? 'durée à confirmer'}. Nova vous accompagne.
            </Text>
          </View>
          <Pressable
            onPress={async () => {
              setDismissed(true);
              await storage.writeJson(key, true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Masquer le rappel"
            style={styles.hideBtn}
          >
            <Text style={{ color: colors.white, fontWeight: '700' }}>Masquer</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

function Gallery({ session }: { session: Session }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => setPhotos(await listPhotos(session)), [session]);
  useEffect(() => {
    reload();
  }, [reload]);

  const onAdd = async () => {
    setError(null);
    setBusy(true);
    try {
      const added = await addPhoto(session);
      if (added) await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajout impossible.');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = (photo: Photo) => {
    const doRemove = async () => {
      await removePhoto(session, photo.id);
      await reload();
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm('Retirer cette photo de votre galerie ?')) doRemove();
      return;
    }
    Alert.alert('Retirer la photo', 'Cette photo sera supprimée de ce téléphone.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: doRemove },
    ]);
  };

  return (
    <Card>
      <SectionTitle title="Mes proches" hint="Photos conservées sur ce téléphone, pour ce profil uniquement" />
      <View style={styles.grid}>
        <Pressable onPress={onAdd} disabled={busy} accessibilityRole="button" accessibilityLabel="Ajouter une photo" style={[styles.tile, styles.addTile]}>
          <Ionicons name="add" size={30} color={colors.navy} />
          <Text style={{ color: colors.navy, fontWeight: '700', fontSize: 12 }}>{busy ? 'Ajout…' : 'Ajouter'}</Text>
        </Pressable>
        {photos.map((p) => (
          <View key={p.id} style={styles.tile}>
            <Image source={{ uri: p.uri }} style={styles.photo} accessibilityLabel="Photo d’un proche" />
            <Pressable onPress={() => onRemove(p)} accessibilityRole="button" accessibilityLabel="Retirer cette photo" style={styles.remove} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.white} />
            </Pressable>
          </View>
        ))}
      </View>
      {photos.length === 0 ? <Text style={[type.small, { marginTop: space.sm }]}>Aucune photo pour l’instant.</Text> : null}
      {error ? <Text style={[type.small, { color: '#9B1C1C', marginTop: space.sm }]}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 120 },
  evolved: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.accentSoft, padding: space.md, borderRadius: radius.small },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  orient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    padding: space.md,
    minHeight: 44,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.line,
  },
  progressBox: { marginTop: space.lg, backgroundColor: colors.bg, borderRadius: radius.small, padding: space.md, gap: space.sm },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.navy },
  mail: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.small, backgroundColor: colors.bg },
  mailIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  game: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.small, backgroundColor: colors.bg, minHeight: 64 },
  gameIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.navy, borderRadius: radius.small, padding: space.md },
  reminderMuted: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.bg, borderRadius: radius.small, padding: space.md },
  hideBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: '#5C6E92' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: 96, height: 96, borderRadius: radius.small, overflow: 'hidden', backgroundColor: colors.bg },
  addTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.accent },
  photo: { width: '100%', height: '100%' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(14,26,43,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
