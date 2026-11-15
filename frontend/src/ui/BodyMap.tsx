import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

import { formatDateTime, measure } from '../lib/format';
import type { HealthSignal, SignalStatus, ZoneId } from '../lib/types';
import { Chip } from './components';
import { colors, radius, space, statusStyle, type } from './theme';

/** Dimensions de assets/images/silhouette.png. Les zones sont exprimées dans ce repère. */
const W = 540;
const H = 1092;

type Shape = { cx: number; cy: number; rx: number; ry: number; rot?: number };

/** Gauche/droite sont celles de l'astronaute (vu de face, sa gauche est à droite de l'écran). */
export const ZONES: Record<ZoneId, { label: string; shapes: Shape[]; marker: [number, number] }> = {
  tete: { label: 'Tête', shapes: [{ cx: 270, cy: 82, rx: 52, ry: 66 }], marker: [270, 82] },
  poumons: {
    label: 'Poumons',
    shapes: [
      { cx: 222, cy: 300, rx: 38, ry: 74 },
      { cx: 328, cy: 296, rx: 36, ry: 74 },
    ],
    marker: [222, 270],
  },
  coeur: { label: 'Cœur', shapes: [{ cx: 292, cy: 318, rx: 34, ry: 38 }], marker: [292, 318] },
  colonne: { label: 'Colonne vertébrale', shapes: [{ cx: 270, cy: 440, rx: 20, ry: 62 }], marker: [270, 440] },
  bassin: { label: 'Bassin et hanches', shapes: [{ cx: 270, cy: 535, rx: 88, ry: 48 }], marker: [270, 540] },
  bras_droit: { label: 'Bras droit', shapes: [{ cx: 112, cy: 420, rx: 36, ry: 175, rot: 12 }], marker: [105, 440] },
  bras_gauche: { label: 'Bras gauche', shapes: [{ cx: 428, cy: 420, rx: 36, ry: 175, rot: -12 }], marker: [435, 440] },
  jambe_droite: { label: 'Jambe droite', shapes: [{ cx: 225, cy: 800, rx: 52, ry: 255 }], marker: [222, 760] },
  jambe_gauche: { label: 'Jambe gauche', shapes: [{ cx: 318, cy: 800, rx: 52, ry: 255 }], marker: [320, 760] },
};

/**
 * Illustrations fournies (docs/references 2, 5, 6, 7), même cadrage que la silhouette :
 * chacune colore un système du corps. La zone touchée par un test affiche le système correspondant.
 */
type System = 'os' | 'poumons' | 'muscles' | 'coeur';
const SYSTEM_IMAGE = {
  os: require('../../assets/images/systeme-os.jpg'),
  poumons: require('../../assets/images/systeme-poumons.jpg'),
  muscles: require('../../assets/images/systeme-muscles.jpg'),
  coeur: require('../../assets/images/systeme-coeur.jpg'),
} as const;
const SYSTEM_LABEL: Record<System, string> = {
  os: 'squelette (os)',
  poumons: 'système respiratoire',
  muscles: 'système musculaire',
  coeur: 'système cardiaque',
};
const ZONE_SYSTEM: Record<ZoneId, System | null> = {
  tete: null,
  coeur: 'coeur',
  poumons: 'poumons',
  colonne: 'os',
  bassin: 'os',
  bras_droit: 'muscles',
  bras_gauche: 'muscles',
  jambe_droite: 'muscles',
  jambe_gauche: 'muscles',
};

const ORDER: SignalStatus[] = ['priority', 'review', 'in_band', 'unavailable'];
const rank = (s: SignalStatus) => ORDER.indexOf(s);

/** Statut affiché pour une zone : le plus prioritaire de ses signaux. */
function zoneStatus(signals: HealthSignal[]): SignalStatus {
  return signals.reduce<SignalStatus>((acc, s) => (rank(s.status) < rank(acc) ? s.status : acc), 'unavailable');
}

export function Legend() {
  return (
    <View style={styles.legend} accessibilityLabel="Légende des statuts">
      {ORDER.map((s) => (
        <View key={s} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: statusStyle[s].color }]} />
          <Text style={type.small}>{statusStyle[s].label}</Text>
        </View>
      ))}
    </View>
  );
}

export function BodyMap({ signals, width }: { signals: HealthSignal[] | null; width: number }) {
  const [open, setOpen] = useState<HealthSignal[] | null>(null);
  const [openTitle, setOpenTitle] = useState('');
  const [chosen, setChosen] = useState<ZoneId | null>(null);
  const height = (width * H) / W;
  const byZone = new Map<ZoneId, HealthSignal[]>();
  for (const s of signals ?? []) if (s.zone && ZONES[s.zone]) byZone.set(s.zone, [...(byZone.get(s.zone) ?? []), s]);
  const located = [...byZone.entries()].sort((a, b) => rank(zoneStatus(a[1])) - rank(zoneStatus(b[1])));

  // Zone mise en avant : celle touchée par l'utilisateur, sinon la plus prioritaire.
  const focus: ZoneId | null = chosen && byZone.has(chosen) ? chosen : located[0]?.[0] ?? null;
  const system = focus ? ZONE_SYSTEM[focus] : null;

  const openZone = (zone: ZoneId) => {
    const list = byZone.get(zone);
    if (!list) return;
    setChosen(zone);
    setOpenTitle(ZONES[zone].label);
    setOpen(list);
  };

  return (
    <View>
      <View style={{ width, height, alignSelf: 'center' }}>
        <Image
          source={system ? SYSTEM_IMAGE[system] : require('../../assets/images/silhouette.png')}
          style={{ width, height }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
          {located.map(([zone, list], i) => {
            const st = statusStyle[zoneStatus(list)];
            const z = ZONES[zone];
            return (
              <G key={zone}>
                {z.shapes.map((sh, k) => (
                  <Ellipse
                    key={k}
                    cx={sh.cx}
                    cy={sh.cy}
                    rx={sh.rx}
                    ry={sh.ry}
                    fill={st.color}
                    fillOpacity={zone === focus ? 0.12 : 0.28}
                    stroke={st.color}
                    strokeWidth={zone === focus ? 6 : 4}
                    transform={sh.rot ? `rotate(${sh.rot} ${sh.cx} ${sh.cy})` : undefined}
                  />
                ))}
                <Circle cx={z.marker[0]} cy={z.marker[1]} r={22} fill={st.color} stroke={colors.white} strokeWidth={4} />
                <SvgText x={z.marker[0]} y={z.marker[1] + 8} fontSize={24} fontWeight="bold" fill={colors.white} textAnchor="middle">
                  {String(i + 1)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
        {/* Surfaces tactiles posées sur chaque forme : même comportement sur iOS, Android et web. */}
        {/* Les grandes zones d'abord, les petites par-dessus : le cœur reste touchable malgré les poumons. */}
        {located
          .flatMap(([zone, list]) => ZONES[zone].shapes.map((sh, k) => ({ zone, list, sh, k })))
          .sort((x, y) => y.sh.rx * y.sh.ry - x.sh.rx * x.sh.ry)
          .map(({ zone, list, sh, k }) => {
            // Boîte englobante de l'ellipse (éventuellement tournée), à l'échelle de l'affichage.
            const k_ = width / W;
            const a = ((sh.rot ?? 0) * Math.PI) / 180;
            const halfW = Math.sqrt((sh.rx * Math.cos(a)) ** 2 + (sh.ry * Math.sin(a)) ** 2) * k_;
            const halfH = Math.sqrt((sh.rx * Math.sin(a)) ** 2 + (sh.ry * Math.cos(a)) ** 2) * k_;
            return (
              <Pressable
                key={`${zone}-${k}`}
                onPress={() => openZone(zone)}
                accessibilityRole="button"
                accessibilityLabel={`${ZONES[zone].label} : ${statusStyle[zoneStatus(list)].label}`}
                style={{
                  position: 'absolute',
                  left: sh.cx * k_ - halfW,
                  top: sh.cy * k_ - halfH,
                  width: halfW * 2,
                  height: halfH * 2,
                  borderRadius: halfW,
                }}
              />
            );
          })}
      </View>

      {focus ? (
        <View style={styles.caption} accessibilityRole="text">
          <Ionicons name="body-outline" size={18} color={colors.navy} />
          <Text style={[type.small, { flex: 1, color: colors.inkSoft }]}>
            <Text style={{ fontWeight: '800', color: colors.ink }}>
              {system ? `Illustration : ${SYSTEM_LABEL[system]}` : 'Illustration : silhouette'}
            </Text>
            {` — zone « ${ZONES[focus].label} » touchée par le test. Le statut est donné par l’anneau et son libellé ; touchez une autre zone pour voir son système.`}
          </Text>
        </View>
      ) : null}

      {/* Équivalent textuel des zones : chaque couleur est accompagnée d'un libellé. */}
      <View style={{ gap: space.sm, marginTop: space.md }}>
        {located.map(([zone, list], i) => {
          const status = zoneStatus(list);
          const st = statusStyle[status];
          return (
            <Pressable
              key={zone}
              onPress={() => openZone(zone)}
              accessibilityRole="button"
              accessibilityLabel={`Zone ${i + 1}, ${ZONES[zone].label} : ${st.label}. ${list.length} signal${list.length > 1 ? 'aux' : ''}.`}
              style={({ pressed }) => [styles.zoneRow, { borderLeftColor: st.color }, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.num, { backgroundColor: st.color }]}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '700', color: colors.ink }]}>{ZONES[zone].label}</Text>
                <Text style={type.small} numberOfLines={1}>
                  {list.map((s) => s.label).join(' · ')}
                </Text>
              </View>
              <Chip label={st.short} color={st.text} bg={st.soft} />
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          );
        })}
      </View>

      <SignalSheet title={openTitle} signals={open} onClose={() => setOpen(null)} />
    </View>
  );
}

export function SignalSheet({ title, signals, onClose }: { title: string; signals: HealthSignal[] | null; onClose: () => void }) {
  return (
    <Modal visible={!!signals} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer le détail" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <Text style={[type.title, { flex: 1 }]} accessibilityRole="header">
            {title}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.ink} />
          </Pressable>
        </View>
        {(signals ?? []).map((s) => (
          <SignalDetail key={s.id} signal={s} />
        ))}
      </View>
    </Modal>
  );
}

export function SignalDetail({ signal: s }: { signal: HealthSignal }) {
  const st = statusStyle[s.status];
  return (
    <View style={[styles.detail, { borderColor: st.color }]}>
      <View style={{ gap: space.sm, marginBottom: space.sm }}>
        <Text style={[type.body, { fontWeight: '700', color: colors.ink }]}>{s.label}</Text>
        <Chip label={st.label} color={st.text} bg={st.soft} />
      </View>
      <View style={styles.kv}>
        <Text style={type.small}>Mesure</Text>
        <Text style={[type.title, s.value === null && { color: colors.muted, fontSize: 16 }]}>{measure(s.value, s.unit)}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={type.small}>Unité</Text>
        <Text style={type.body}>{s.unit ?? 'Non précisée'}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={type.small}>Appareil ou capteur</Text>
        <Text style={type.body}>{s.device ?? 'Non précisé'}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={type.small}>Date</Text>
        <Text style={type.body}>{s.observed_at ? formatDateTime(s.observed_at) : 'À confirmer'}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={type.small}>Statut</Text>
        <Text style={[type.body, { color: st.text, fontWeight: '700' }]}>{st.label}</Text>
      </View>
      {s.note ? <Text style={[type.small, { marginTop: space.sm }]}>{s.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { flexDirection: 'row', gap: space.sm, marginTop: space.md, padding: space.md, borderRadius: radius.small, backgroundColor: colors.accentSoft },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.small,
    borderLeftWidth: 4,
    padding: space.md,
    minHeight: 52,
  },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(14,26,43,0.35)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: space.xl,
    paddingBottom: space.xxl,
    maxHeight: '80%',
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: space.md },
  detail: { borderWidth: 1, borderRadius: radius.small, padding: space.md, marginBottom: space.md },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, gap: space.md },
});
