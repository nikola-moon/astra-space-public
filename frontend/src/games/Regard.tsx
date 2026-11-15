import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon } from 'react-native-svg';

import { Button } from '../ui/components';
import { colors, radius, space, type } from '../ui/theme';
import type { GameProps } from './types';

const ROUNDS = 12;

/** Visage de Nova : apaisé (yeux mi-clos, sourire) ou grognon (sourcils froncés, bouche tombante). */
function Face({ calm, size }: { calm: boolean; size: number }) {
  const fur = calm ? '#F4D3B0' : '#E3C3A3';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points="18,42 26,8 46,28" fill={fur} />
      <Polygon points="82,42 74,8 54,28" fill={fur} />
      <Circle cx={50} cy={55} r={36} fill={fur} />
      {calm ? (
        <>
          <Path d="M28 52 q8 -7 16 0" stroke={colors.ink} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <Path d="M56 52 q8 -7 16 0" stroke={colors.ink} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <Path d="M40 70 q10 9 20 0" stroke={colors.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Circle cx={27} cy={64} r={5} fill="#F6B8B8" />
          <Circle cx={73} cy={64} r={5} fill="#F6B8B8" />
        </>
      ) : (
        <>
          <Line x1={26} y1={40} x2={44} y2={47} stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" />
          <Line x1={74} y1={40} x2={56} y2={47} stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" />
          <Ellipse cx={36} cy={54} rx={5} ry={5} fill={colors.ink} />
          <Ellipse cx={64} cy={54} rx={5} ry={5} fill={colors.ink} />
          <Path d="M40 75 q10 -8 20 0" stroke={colors.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
        </>
      )}
      <Polygon points="46,62 54,62 50,66" fill="#E07A7A" />
    </Svg>
  );
}

function makeRound(n: number) {
  const side = n < 4 ? 3 : 4;
  return { side, target: Math.floor(Math.random() * side * side) };
}

/** Recherche visuelle du visage apaisé parmi des visages grognons (principe de modification du biais attentionnel). */
export function Regard({ onDone }: GameProps) {
  const [round, setRound] = useState(0);
  const [grid, setGrid] = useState(() => makeRound(0));
  const [hint, setHint] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const times = useRef<number[]>([]);

  const start = () => {
    times.current = [];
    setRound(1);
    setGrid(makeRound(1));
    setHint(null);
    shownAt.current = Date.now();
  };

  const tap = useCallback(
    (i: number) => {
      if (i !== grid.target) {
        setHint('Celui-ci est encore grognon. Cherche les yeux mi-clos et le sourire.');
        return;
      }
      times.current.push(Date.now() - shownAt.current);
      setHint(null);
      if (round >= ROUNDS) {
        const avg = Math.round(times.current.reduce((a, b) => a + b, 0) / times.current.length);
        setRound(0);
        onDone(avg, `${ROUNDS} Nova apaisés retrouvés, en ${(avg / 1000).toFixed(1).replace('.', ',')} s en moyenne.`);
        return;
      }
      setRound(round + 1);
      setGrid(makeRound(round + 1));
      shownAt.current = Date.now();
    },
    [grid.target, round, onDone],
  );

  if (round === 0) {
    return (
      <View style={{ gap: space.lg, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          <View style={{ alignItems: 'center' }}>
            <Face calm size={90} />
            <Text style={type.small}>À trouver</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Face calm={false} size={90} />
            <Text style={type.small}>À ignorer</Text>
          </View>
        </View>
        <Text style={[type.body, { textAlign: 'center' }]}>Touche le Nova apaisé le plus vite possible. {ROUNDS} manches, sans pénalité.</Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Button label="Commencer" icon="play" onPress={start} />
        </View>
      </View>
    );
  }

  const cell = grid.side === 3 ? 96 : 72;
  return (
    <View style={{ alignItems: 'center', gap: space.md }}>
      <Text style={type.section}>
        Manche {round} sur {ROUNDS}
      </Text>
      <View style={[styles.grid, { width: grid.side * (cell + 8) }]}>
        {Array.from({ length: grid.side * grid.side }, (_, i) => (
          <Pressable
            key={`${round}-${i}`}
            onPress={() => tap(i)}
            accessibilityRole="button"
            accessibilityLabel={i === grid.target ? 'Nova apaisé' : 'Nova grognon'}
            style={({ pressed }) => [styles.cell, { width: cell, height: cell }, pressed && { opacity: 0.7 }]}
          >
            <Face calm={i === grid.target} size={cell - 10} />
          </Pressable>
        ))}
      </View>
      <Text style={[type.small, { minHeight: 36, textAlign: 'center' }]}>{hint ?? ' '}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  cell: { borderRadius: radius.small, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
