import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import type { Stage } from '../lib/types';
import { colors } from './theme';

export type Reaction = 'idle' | 'pet' | 'play';

interface Look {
  fur: string;
  dark: string;
  head: { cx: number; cy: number; r: number };
  body: { cx: number; cy: number; rx: number; ry: number };
  ear: number;
  eye: number;
  tail: string;
  whisker: number;
}

const LOOKS: Record<Stage, Look> = {
  Bébé: {
    fur: '#F4D3B0', dark: '#C99A6E',
    head: { cx: 100, cy: 98, r: 46 }, body: { cx: 100, cy: 152, rx: 38, ry: 30 },
    ear: 18, eye: 9.5, tail: 'M136 160 q22 -2 16 -20', whisker: 14,
  },
  Jeune: {
    fur: '#E9AE6F', dark: '#B9773A',
    head: { cx: 100, cy: 78, r: 38 }, body: { cx: 100, cy: 142, rx: 44, ry: 42 },
    ear: 24, eye: 7, tail: 'M142 160 q34 -6 30 -48 q-2 -14 -12 -16', whisker: 20,
  },
  Adulte: {
    fur: '#C98A50', dark: '#8E5A2C',
    head: { cx: 100, cy: 62, r: 34 }, body: { cx: 100, cy: 134, rx: 52, ry: 54 },
    ear: 30, eye: 6, tail: 'M150 168 q44 -8 40 -70 q-2 -22 -18 -26', whisker: 30,
  },
};

/** Nova, compagnon original d'ASTRA : trois stades visuellement distincts. */
export type Pose = 'normal' | 'sleep' | 'sad';

function Cat({ stage, happy, waiting, pose = 'normal' }: { stage: Stage; happy: boolean; waiting: boolean; pose?: Pose }) {
  const base = LOOKS[stage] ?? LOOKS['Bébé'];
  const sleep = pose === 'sleep' && !happy;
  const sad = pose === 'sad' && !happy && !sleep;
  // En attente : oreilles dressées, regard levé vers le sablier, bouche en « o ». Le stade ne change jamais.
  // Besoin d'attention : oreilles basses. Jamais de régression ni de punition.
  const L = sad ? { ...base, ear: Math.max(6, base.ear - 10) } : waiting && !happy && !sleep ? { ...base, ear: base.ear + 6 } : base;
  const look = waiting && !happy ? 0.6 : 0.35;
  const { cx, cy, r } = L.head;
  const eyeY = cy - r * 0.05;
  const eyeDx = r * 0.4;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 200">
      {/* Ombre */}
      <Ellipse cx={100} cy={188} rx={L.body.rx + 6} ry={6} fill="#0E1A2B" opacity={0.08} />
      {/* Queue */}
      <Path d={L.tail} stroke={L.fur} strokeWidth={stage === 'Bébé' ? 9 : 11} fill="none" strokeLinecap="round" />
      {/* Corps */}
      <Ellipse cx={L.body.cx} cy={L.body.cy} rx={L.body.rx} ry={L.body.ry} fill={L.fur} />
      {stage === 'Adulte' ? <Ellipse cx={100} cy={142} rx={24} ry={34} fill="#FBEBDD" /> : null}
      {/* Pattes */}
      <Ellipse cx={82} cy={L.body.cy + L.body.ry - 6} rx={11} ry={8} fill={L.fur} stroke={L.dark} strokeWidth={1.5} />
      <Ellipse cx={118} cy={L.body.cy + L.body.ry - 6} rx={11} ry={8} fill={L.fur} stroke={L.dark} strokeWidth={1.5} />
      {/* Accessoires de stade */}
      {stage === 'Bébé' ? (
        <G>
          <Path d="M78 128 q22 22 44 0 l-6 16 q-16 12 -32 0 z" fill={colors.accentSoft} />
          <Polygon points="100,131 103,138 110,138 104,142 106,149 100,145 94,149 96,142 90,138 97,138" fill={colors.accent} />
        </G>
      ) : null}
      {stage === 'Jeune' ? <Path d="M70 108 q30 16 60 0 l0 9 q-30 16 -60 0 z" fill={colors.navy} /> : null}
      {stage === 'Adulte' ? (
        <G>
          <Path d="M72 92 q28 12 56 0" stroke={colors.navy} strokeWidth={6} fill="none" strokeLinecap="round" />
          <Circle cx={100} cy={102} r={8} fill={colors.accent} stroke={colors.white} strokeWidth={2} />
          <Polygon points="100,96 101.8,100 106,100.5 102.8,103.2 103.7,107.4 100,105.2 96.3,107.4 97.2,103.2 94,100.5 98.2,100" fill={colors.white} />
        </G>
      ) : null}
      {/* Oreilles */}
      <Polygon points={`${cx - r * 0.85},${cy - r * 0.35} ${cx - r * 0.6},${cy - r - L.ear} ${cx - r * 0.1},${cy - r * 0.8}`} fill={L.fur} />
      <Polygon points={`${cx + r * 0.85},${cy - r * 0.35} ${cx + r * 0.6},${cy - r - L.ear} ${cx + r * 0.1},${cy - r * 0.8}`} fill={L.fur} />
      <Polygon points={`${cx - r * 0.7},${cy - r * 0.5} ${cx - r * 0.58},${cy - r - L.ear * 0.55} ${cx - r * 0.3},${cy - r * 0.78}`} fill="#F6B8B8" />
      <Polygon points={`${cx + r * 0.7},${cy - r * 0.5} ${cx + r * 0.58},${cy - r - L.ear * 0.55} ${cx + r * 0.3},${cy - r * 0.78}`} fill="#F6B8B8" />
      {/* Tête */}
      <Circle cx={cx} cy={cy} r={r} fill={L.fur} />
      {stage === 'Jeune' ? (
        <G>
          <Path d={`M${cx - 8} ${cy - r + 2} l3 12 M${cx} ${cy - r} l0 13 M${cx + 8} ${cy - r + 2} l-3 12`} stroke={L.dark} strokeWidth={3} strokeLinecap="round" />
        </G>
      ) : null}
      {/* Yeux : fermés et souriants quand Nova est content */}
      {sleep ? (
        <G>
          <Path d={`M${cx - eyeDx - L.eye} ${eyeY} q${L.eye} ${L.eye * 0.8} ${L.eye * 2} 0`} stroke={colors.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d={`M${cx + eyeDx - L.eye} ${eyeY} q${L.eye} ${L.eye * 0.8} ${L.eye * 2} 0`} stroke={colors.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
        </G>
      ) : happy ? (
        <G>
          <Path d={`M${cx - eyeDx - L.eye} ${eyeY} q${L.eye} -${L.eye} ${L.eye * 2} 0`} stroke={colors.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d={`M${cx + eyeDx - L.eye} ${eyeY} q${L.eye} -${L.eye} ${L.eye * 2} 0`} stroke={colors.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
        </G>
      ) : (
        <G>
          <Ellipse cx={cx - eyeDx} cy={eyeY} rx={L.eye} ry={stage === 'Adulte' ? L.eye * 1.25 : L.eye} fill={colors.ink} />
          <Ellipse cx={cx + eyeDx} cy={eyeY} rx={L.eye} ry={stage === 'Adulte' ? L.eye * 1.25 : L.eye} fill={colors.ink} />
          <Circle cx={cx - eyeDx + L.eye * look} cy={eyeY - L.eye * look} r={L.eye * 0.32} fill={colors.white} />
          <Circle cx={cx + eyeDx + L.eye * look} cy={eyeY - L.eye * look} r={L.eye * 0.32} fill={colors.white} />
        </G>
      )}
      {/* Nez, bouche, joues */}
      <Polygon points={`${cx - 4},${cy + r * 0.22} ${cx + 4},${cy + r * 0.22} ${cx},${cy + r * 0.3}`} fill="#E07A7A" />
      {sad ? (
        <Path d={`M${cx - 7} ${cy + r * 0.46} q7 -6 14 0`} stroke={colors.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
      ) : waiting && !happy && !sleep ? (
        <Ellipse cx={cx} cy={cy + r * 0.42} rx={3.2} ry={4} fill={colors.ink} />
      ) : (
        <Path d={`M${cx} ${cy + r * 0.3} q-5 6 -10 2 M${cx} ${cy + r * 0.3} q5 6 10 2`} stroke={colors.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
      )}
      <Circle cx={cx - r * 0.62} cy={cy + r * 0.25} r={r * 0.12} fill="#F6B8B8" opacity={happy ? 0.9 : 0.5} />
      <Circle cx={cx + r * 0.62} cy={cy + r * 0.25} r={r * 0.12} fill="#F6B8B8" opacity={happy ? 0.9 : 0.5} />
      {/* Moustaches */}
      {[-1, 1].map((side) => (
        <G key={side}>
          <Line x1={cx + side * r * 0.35} y1={cy + r * 0.25} x2={cx + side * (r * 0.35 + L.whisker)} y2={cy + r * 0.15} stroke={L.dark} strokeWidth={1.5} />
          <Line x1={cx + side * r * 0.35} y1={cy + r * 0.32} x2={cx + side * (r * 0.35 + L.whisker)} y2={cy + r * 0.36} stroke={L.dark} strokeWidth={1.5} />
        </G>
      ))}
    </Svg>
  );
}

function Yarn() {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <Circle cx={20} cy={20} r={16} fill={colors.accent} />
      <Path d="M8 14 q12 6 24 -2 M6 22 q14 8 28 0 M10 30 q10 4 20 -2" stroke={colors.white} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function Heart() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path d="M12 21s-7-4.6-9.3-9C1 8.6 3.3 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.5 0 5.8 3.6 4.1 7-2.3 4.4-9.3 9-9.3 9z" fill="#F08FA8" />
    </Svg>
  );
}

/** « Zzz » qui montent doucement pendant le sommeil. */
function Zzz({ size }: { size: number }) {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rise, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [rise]);
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const opacity = rise.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.Text
      pointerEvents="none"
      style={{ position: 'absolute', top: size * 0.08, right: size * 0.18, fontSize: 22, fontWeight: '900', color: colors.accent, opacity, transform: [{ translateY }] }}
    >
      Z z z
    </Animated.Text>
  );
}

/** Sablier qui se retourne lentement : Nova attend une confirmation, sans régresser. */
function Hourglass({ size }: { size: number }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(turn, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(turn, { toValue: 2, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1, 2], outputRange: ['0deg', '180deg', '360deg'] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: size * 0.04, right: size * 0.06, transform: [{ rotate }] }}
    >
      <Svg width={34} height={44} viewBox="0 0 34 44">
        <Rect x={3} y={2} width={28} height={5} rx={2.5} fill={colors.navy} />
        <Rect x={3} y={37} width={28} height={5} rx={2.5} fill={colors.navy} />
        <Path d="M7 7 h20 q0 9 -8 15 q8 6 8 15 h-20 q0 -9 8 -15 q-8 -6 -8 -15 z" fill={colors.accentSoft} stroke={colors.navy} strokeWidth={2} />
        <Path d="M11 33 q6 -7 12 0 z" fill={colors.accent} />
        <Path d="M12 11 h10 q-1 4 -5 7 q-4 -3 -5 -7 z" fill={colors.accent} />
      </Svg>
    </Animated.View>
  );
}

export function NovaAvatar({ stage, reaction, reactionKey, waiting = false, pose = 'normal', size = 220 }: {
  stage: Stage;
  reaction: Reaction;
  reactionKey: number;
  waiting?: boolean;
  pose?: Pose;
  size?: number;
}) {
  const bounce = useRef(new Animated.Value(0)).current;
  const fx = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reaction === 'idle') return;
    bounce.setValue(0);
    fx.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(bounce, { toValue: 0, friction: 3, useNativeDriver: true }),
      ]),
      Animated.timing(fx, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [reaction, reactionKey, bounce, fx]);

  const scale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, reaction === 'pet' ? 1.06 : 1.0] });
  const rotate = bounce.interpolate({ inputRange: [0, 1], outputRange: ['0deg', reaction === 'play' ? '-8deg' : '0deg'] });
  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, reaction === 'play' ? -18 : -4] });
  const fxY = fx.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const fxOpacity = fx.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const yarnX = fx.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-60, 40, -20] });
  const yarnY = fx.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -50, 0, -25, 0] });

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }} accessibilityLabel={`Nova, stade ${stage}${waiting ? ', en attente d’une confirmation' : ''}`}>
      <Animated.View style={{ width: size, height: size, transform: [{ translateY: lift }, { scale }, { rotate }] }}>
        <Cat stage={stage} happy={reaction !== 'idle'} waiting={waiting} pose={pose} />
      </Animated.View>
      {waiting && pose !== 'sleep' ? <Hourglass size={size} /> : null}
      {pose === 'sleep' && reaction === 'idle' ? <Zzz size={size} /> : null}
      {reaction === 'pet' ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: size * 0.15, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 22, opacity: fxOpacity, transform: [{ translateY: fxY }] }}>
          <Heart />
          <Heart />
          <Heart />
        </Animated.View>
      ) : null}
      {reaction === 'play' ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 6, left: size / 2 - 20, transform: [{ translateX: yarnX }, { translateY: yarnY }] }}>
          <Yarn />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Petite étiquette de rappel visuel du stade, pour la barre de progression. */
export function StageDots({ stage }: { stage: Stage }) {
  const order: Stage[] = ['Bébé', 'Jeune', 'Adulte'];
  const idx = order.indexOf(stage);
  return (
    <Svg width={60} height={12} viewBox="0 0 60 12">
      {order.map((s, i) => (
        <Rect key={s} x={i * 21} y={2} width={18} height={8} rx={4} fill={i <= idx ? colors.navy : colors.line} />
      ))}
    </Svg>
  );
}
