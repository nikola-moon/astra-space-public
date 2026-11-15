import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { act, applyFamily, loadPet, savePet, status, type PetAction, type PetData, type PortholeView } from '../lib/pet';
import type { FamilyCare, Session, Stage } from '../lib/types';
import { NovaAvatar, type Reaction } from './Nova';
import { colors, radius, space, type } from './theme';

type Tool = { id: PetAction | 'pet' | 'play'; label: string; icon: keyof typeof Ionicons.glyphMap };

/** Barre d'icônes : nourrir, nettoyer, hublot (les trois soins), puis caresser et jouer. */
const TOOLS: Tool[] = [
  { id: 'feed', label: 'Nourrir', icon: 'fish' },
  { id: 'clean', label: 'Nettoyer', icon: 'sparkles' },
  { id: 'view', label: 'Hublot', icon: 'planet' },
  { id: 'pet', label: 'Caresser', icon: 'hand-left' },
  { id: 'play', label: 'Jouer', icon: 'tennisball' },
];

const PET_LINES = ['Nova ronronne doucement.', 'Nova ferme les yeux, détendu.', 'Nova se blottit contre ta main.'];
const PLAY_LINES = ['Nova bondit sur la pelote !', 'Nova fait une pirouette en apesanteur.', 'Nova rapporte la pelote, fier de lui.'];
const pick = (l: string[]) => l[Math.floor(Math.random() * l.length)];

function Porthole({ view, night }: { view: PortholeView; night: boolean }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B1430" />
          <Stop offset="1" stopColor="#1B2B5A" />
        </LinearGradient>
        <ClipPath id="glass">
          <Circle cx={60} cy={60} r={56} />
        </ClipPath>
      </Defs>
      {/* Tout le paysage est découpé à la forme du hublot. */}
      <G clipPath="url(#glass)">
      <Circle cx={60} cy={60} r={56} fill="url(#sky)" />
      {[[22, 30], [40, 18], [88, 26], [96, 52], [30, 64], [70, 40], [52, 90], [84, 84]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={view === 'etoiles' ? 1.8 : 1} fill="#FFFFFF" opacity={view === 'etoiles' ? 0.95 : 0.6} />
      ))}
      {view === 'terre' ? (
        <>
          <Circle cx={60} cy={150} r={80} fill="#3E8ED0" />
          <Path d="M10 92 q20 -10 40 -2 q18 6 34 -4 q14 -6 26 2 l0 30 l-100 0 z" fill="#2E8B7A" opacity={0.85} />
          <Path d="M0 76 q60 -18 120 0" stroke="#A9D3F0" strokeWidth={3} fill="none" opacity={0.7} />
        </>
      ) : null}
      {view === 'aurore' ? (
        <>
          <Path d="M8 70 q26 -30 52 -6 q26 22 52 -10" stroke="#7CE0B5" strokeWidth={8} fill="none" opacity={0.7} strokeLinecap="round" />
          <Path d="M14 84 q24 -22 46 -4 q24 18 48 -8" stroke="#C8B6F2" strokeWidth={5} fill="none" opacity={0.6} strokeLinecap="round" />
          <Circle cx={60} cy={160} r={70} fill="#14213D" />
        </>
      ) : null}
      {night ? <Circle cx={60} cy={60} r={56} fill="#0B1430" opacity={0.35} /> : null}
      </G>
      <Circle cx={60} cy={60} r={56} fill="none" stroke="#C9D4E8" strokeWidth={6} />
      <Circle cx={60} cy={60} r={56} fill="none" stroke="#8FA0BC" strokeWidth={1.5} />
    </Svg>
  );
}

function Capsule() {
  return (
    <Svg width={150} height={170} viewBox="0 0 150 170" accessibilityLabel="Capsule fermée">
      <Ellipse cx={75} cy={160} rx={46} ry={6} fill="#0E1A2B" opacity={0.1} />
      <Path d="M75 12 C118 12 132 70 132 104 C132 138 106 156 75 156 C44 156 18 138 18 104 C18 70 32 12 75 12 Z" fill="#F4F6FA" stroke={colors.navy} strokeWidth={3} />
      <Path d="M24 96 L44 84 L60 98 L78 82 L96 98 L112 84 L128 96" stroke={colors.accent} strokeWidth={3} fill="none" strokeLinejoin="round" />
      <Circle cx={75} cy={56} r={14} fill={colors.accentSoft} stroke={colors.navy} strokeWidth={2} />
      <Path d="M68 56 l5 5 l9 -10" stroke={colors.navy} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Bowl({ full }: { full: boolean }) {
  return (
    <Svg width={54} height={34} viewBox="0 0 54 34" accessibilityLabel={full ? 'Gamelle remplie' : 'Gamelle vide'}>
      {full ? <Ellipse cx={27} cy={12} rx={18} ry={6} fill="#E9AE6F" /> : null}
      <Path d="M4 12 h46 l-6 18 h-34 z" fill={colors.accent} />
      <Rect x={4} y={10} width={46} height={4} rx={2} fill={colors.navy} />
    </Svg>
  );
}

function Litter({ count }: { count: number }) {
  return (
    <Svg width={64} height={34} viewBox="0 0 64 34" accessibilityLabel={`Litière, ${count} à nettoyer`}>
      <Rect x={2} y={12} width={60} height={20} rx={6} fill="#C9D4E8" stroke={colors.navy} strokeWidth={2} />
      {Array.from({ length: count }, (_, i) => (
        <Ellipse key={i} cx={16 + i * 16} cy={12} rx={6} ry={4.5} fill="#8E5A2C" />
      ))}
    </Svg>
  );
}

function Gauge({ label, value, icon }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }) {
  const pct = Math.round(value * 100);
  return (
    <View style={{ flex: 1 }} accessibilityLabel={`${label} : ${pct} %`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={icon} size={14} color={colors.navy} />
        <Text style={type.label}>{label}</Text>
        <Text style={[type.small, { marginLeft: 'auto' }]}>{pct} %</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

/**
 * Habitat de Nova : écran façon console de poche (scène + hublot), jauges, barre d'icônes
 * et trois boutons physiques ◀ ● ▶ pour choisir et valider une action.
 */
export function PetHabitat({ session, stage, waiting, idleLine, family = [], onLine }: {
  session: Session;
  stage: Stage;
  waiting: boolean;
  idleLine: string;
  /** Attentions de la famille arrivées à bord (fournies par la station). */
  family?: FamilyCare[];
  onLine?: (line: string) => void;
}) {
  const [data, setData] = useState<PetData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState(0);
  const [reaction, setReaction] = useState<Reaction>('idle');
  const [reactionKey, setReactionKey] = useState(0);
  const [line, setLine] = useState<string | null>(null);
  const [lineMs, setLineMs] = useState(2800);

  useEffect(() => {
    loadPet(session).then(setData);
  }, [session]);

  // Le temps de Nova avance tout seul : on rafraîchit l'affichage régulièrement.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      loadPet(session).then(setData); // reprend les changements faits depuis la console de démo
    }, session.mode === 'demo' ? 3000 : 30000);
    return () => clearInterval(t);
  }, [session]);

  useEffect(() => {
    if (reaction === 'idle' && !line) return;
    const t = setTimeout(() => {
      setReaction('idle');
      setLine(null);
      setLineMs(2800);
    }, lineMs);
    return () => clearTimeout(t);
  }, [reaction, reactionKey, line, lineMs]);

  const say = useCallback(
    (msg: string, r: Reaction = 'idle', ms = 2800) => {
      setLineMs(ms);
      setLine(msg);
      setReaction(r);
      setReactionKey((k) => k + 1);
      onLine?.(msg);
    },
    [onLine],
  );

  // Attentions de la famille : appliquées une seule fois, dès qu'elles arrivent à bord.
  const familyKey = family.map((f) => f.id).join(',');
  const announced = useRef(new Set<string>());
  useEffect(() => {
    if (!data || !family.length) return;
    // Mémoire immédiate en plus du stockage : évite une double annonce pendant l'écriture.
    const known = { ...data, appliedFamily: [...(data.appliedFamily ?? []), ...announced.current] };
    const res = applyFamily(known, session.mode, family);
    if (!res) return;
    family.forEach((f) => announced.current.add(String(f.id)));
    setData(res.data);
    savePet(session, res.data);
    say(res.announce, res.reaction, 7000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyKey, data?.appliedFamily?.length, data?.hatchedAt, session]);

  const run = useCallback(
    async (id: Tool['id']) => {
      if (!data) return;
      if (id === 'pet') return say(pick(PET_LINES), 'pet');
      if (id === 'play') return say(pick(PLAY_LINES), 'play');
      const res = act(data, session.mode, id, Date.now());
      setData(res.data);
      setNow(Date.now());
      await savePet(session, res.data);
      say(res.message, res.effect === 'none' ? 'idle' : 'pet');
    },
    [data, session, say],
  );

  if (!data) return <View style={{ height: 360 }} />;
  const st = status(data, session.mode, now);
  const egg = st.phase === 'egg';
  const pose = st.asleep ? 'sleep' : st.needy ? 'sad' : 'normal';
  const message = line ?? (st.phase === 'idle' ? idleLine : st.message);

  const validate = () => (egg ? run('hatch') : run(TOOLS[selected].id));

  return (
    <View style={{ gap: space.md }}>
      {/* Écran */}
      <View style={[styles.screen, st.asleep && { backgroundColor: '#DCE3F0' }]}>
        <View style={styles.porthole}>
          <Porthole view={data.view} night={st.asleep} />
        </View>
        <View style={styles.pet}>
          {egg ? <Capsule /> : <NovaAvatar stage={stage} reaction={reaction} reactionKey={reactionKey} waiting={waiting && !st.asleep} pose={pose} size={190} />}
        </View>
        {!egg ? (
          <View style={styles.floor}>
            <Bowl full={st.food > 0.5} />
            <Litter count={st.litter} />
          </View>
        ) : null}
        {st.asleep ? (
          <View style={styles.nightTag}>
            <Ionicons name="moon" size={12} color={colors.white} />
            <Text style={{ color: colors.white, fontSize: 11, fontWeight: '700' }}>Nuit à bord</Text>
          </View>
        ) : null}
      </View>

      <Text style={[type.body, { textAlign: 'center', minHeight: 42 }]} accessibilityLiveRegion="polite">
        {message}
      </Text>

      {!egg ? (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Gauge label="Repas" value={st.food} icon="fish" />
          <Gauge label="Propreté" value={st.clean} icon="sparkles" />
        </View>
      ) : null}

      {/* Barre d'icônes : toucher une icône la sélectionne et l'exécute. */}
      <View style={styles.icons} accessibilityRole="toolbar">
        {TOOLS.map((t, i) => {
          const on = i === selected && !egg;
          return (
            <Pressable
              key={t.id}
              disabled={egg}
              onPress={() => {
                setSelected(i);
                run(t.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: on, disabled: egg }}
              style={[styles.icon, on && styles.iconOn, egg && { opacity: 0.35 }]}
            >
              <Ionicons name={t.icon} size={22} color={on ? colors.white : colors.navy} />
              <Text style={[styles.iconText, on && { color: colors.white }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Boutons physiques : précédent, valider, suivant. */}
      <View style={styles.pad}>
        <Pressable
          onPress={() => setSelected((s) => (s + TOOLS.length - 1) % TOOLS.length)}
          disabled={egg}
          accessibilityRole="button"
          accessibilityLabel="Action précédente"
          style={[styles.side, egg && { opacity: 0.35 }]}
        >
          <Ionicons name="caret-back" size={22} color={colors.navy} />
        </Pressable>
        <Pressable
          onPress={validate}
          accessibilityRole="button"
          accessibilityLabel={egg ? 'Ouvrir la capsule' : `Valider : ${TOOLS[selected].label}`}
          style={({ pressed }) => [styles.center, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          {egg ? <Ionicons name="lock-open" size={26} color={colors.white} /> : <Text style={styles.centerText}>OK</Text>}
        </Pressable>
        <Pressable
          onPress={() => setSelected((s) => (s + 1) % TOOLS.length)}
          disabled={egg}
          accessibilityRole="button"
          accessibilityLabel="Action suivante"
          style={[styles.side, egg && { opacity: 0.35 }]}
        >
          <Ionicons name="caret-forward" size={22} color={colors.navy} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    height: 300,
    borderRadius: 28,
    backgroundColor: '#EAF2FB',
    overflow: 'hidden',
    borderWidth: 6,
    borderColor: colors.navy,
  },
  porthole: { position: 'absolute', top: 14, right: 14, width: 96, height: 96 },
  pet: { position: 'absolute', left: 0, right: 0, top: 50, alignItems: 'center' },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 46,
    backgroundColor: '#C9D4E8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  nightTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden', marginTop: 4 },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.navy },
  icons: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  icon: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: radius.small, backgroundColor: colors.bg, minHeight: 56 },
  iconOn: { backgroundColor: colors.navy },
  iconText: { fontSize: 11, fontWeight: '700', color: colors.navy },
  pad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl },
  side: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  center: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.accentSoft,
  },
  centerText: { color: colors.white, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
});
