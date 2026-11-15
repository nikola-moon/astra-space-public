import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button } from '../ui/components';
import { colors, space, type } from '../ui/theme';
import type { GameProps } from './types';

const PALETTE = ['#A9D3F0', '#3E8ED0', '#14213D', '#C8B6F2', '#F6C9A8', '#F4D3B0', '#9ED8C3', '#FFE7A3'];
const BLANK = '#FFFFFF';
const C = 150; // centre du dessin (viewBox 300 × 300)

const pt = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;

/** Secteur d'anneau entre r1 et r2. */
function ringSector(r1: number, r2: number, a0: number, a1: number) {
  return `M${pt(r2, a0)} A${r2} ${r2} 0 0 1 ${pt(r2, a1)} L${pt(r1, a1)} A${r1} ${r1} 0 0 0 ${pt(r1, a0)} Z`;
}

/** Pétale entre deux angles, de r1 jusqu'à la pointe en r2. */
function petal(r1: number, r2: number, a0: number, a1: number) {
  const mid = (a0 + a1) / 2;
  return `M${pt(r1, a0)} Q${pt(r2 * 0.92, a0)} ${pt(r2, mid)} Q${pt(r2 * 0.92, a1)} ${pt(r1, a1)} Z`;
}

interface Shape {
  kind: 'path' | 'circle';
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
}

function buildShapes(): Shape[] {
  const shapes: Shape[] = [{ kind: 'circle', cx: C, cy: C, r: 20 }];
  const ring = (n: number, fn: (a0: number, a1: number) => string, offset = 0) => {
    for (let i = 0; i < n; i++) {
      const a0 = ((i + offset) / n) * 2 * Math.PI - Math.PI / 2;
      const a1 = ((i + 1 + offset) / n) * 2 * Math.PI - Math.PI / 2;
      shapes.push({ kind: 'path', d: fn(a0, a1) });
    }
  };
  ring(8, (a0, a1) => ringSector(20, 44, a0, a1));
  ring(8, (a0, a1) => petal(44, 82, a0, a1));
  ring(16, (a0, a1) => ringSector(82, 100, a0, a1), 0.5);
  ring(16, (a0, a1) => petal(100, 132, a0, a1));
  for (let i = 0; i < 16; i++) {
    const a = ((i + 0.5) / 16) * 2 * Math.PI - Math.PI / 2;
    shapes.push({ kind: 'circle', cx: C + 128 * Math.cos(a), cy: C + 128 * Math.sin(a), r: 7 });
  }
  return shapes;
}

/** Retrouve la zone touchée à partir de la distance au centre et de l'angle (même ordre que buildShapes). */
function hitTest(x: number, y: number): number | null {
  const dx = x - C;
  const dy = y - C;
  const d = Math.hypot(dx, dy);
  const ang = (Math.atan2(dy, dx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
  const slice = (n: number, offset = 0) => (((Math.floor(ang / ((2 * Math.PI) / n) - offset) % n) + n) % n);
  if (d <= 20) return 0;
  if (d <= 44) return 1 + slice(8);
  if (d <= 82) return 9 + slice(8);
  if (d <= 100) return 17 + slice(16, 0.5);
  if (d <= 138) {
    const dot = Math.round(ang / ((2 * Math.PI) / 16) - 0.5);
    const k = ((dot % 16) + 16) % 16;
    const a = ((k + 0.5) / 16) * 2 * Math.PI - Math.PI / 2;
    if (Math.hypot(x - (C + 128 * Math.cos(a)), y - (C + 128 * Math.sin(a))) <= 10) return 49 + k;
    if (d <= 132) return 33 + slice(16);
  }
  return null;
}

export function Mandala({ onDone, saved, onSave }: GameProps & { saved: string[] | null; onSave: (fills: string[]) => void }) {
  const shapes = useMemo(buildShapes, []);
  const [fills, setFills] = useState<string[]>(() => saved && saved.length === shapes.length ? saved : shapes.map(() => BLANK));
  const [brush, setBrush] = useState(PALETTE[1]);
  const [box, setBox] = useState(300);

  useEffect(() => {
    onSave(fills);
  }, [fills, onSave]);

  const paint = (i: number) => setFills((f) => f.map((c, k) => (k === i ? brush : c)));
  const done = fills.filter((c) => c !== BLANK).length;

  return (
    <View style={{ alignItems: 'center', gap: space.md }}>
      {/* Une seule surface tactile : la zone est déduite de la position du doigt (iOS, Android et web). */}
      <Pressable
        style={styles.canvas}
        onLayout={(e) => setBox(e.nativeEvent.layout.width)}
        onPress={(e) => {
          // Mobile : locationX/Y. Web : l'événement DOM fournit offsetX/Y.
          const ne = e.nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
          const x = ne.locationX ?? ne.offsetX;
          const y = ne.locationY ?? ne.offsetY;
          if (x === undefined || y === undefined) return;
          const k = 300 / box;
          const hit = hitTest(x * k, y * k);
          if (hit !== null) paint(hit);
        }}
        accessibilityLabel={`Mandala, ${done} zones colorées sur ${shapes.length}. Touchez une zone pour la colorier.`}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 300 300">
          {shapes.map((s, i) =>
            s.kind === 'circle' ? (
              <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={fills[i]} stroke={colors.navy} strokeWidth={1.2} />
            ) : (
              <Path key={i} d={s.d} fill={fills[i]} stroke={colors.navy} strokeWidth={1.2} />
            ),
          )}
        </Svg>
        </View>
      </Pressable>
      <View style={styles.palette} accessibilityRole="radiogroup" accessibilityLabel="Couleurs">
        {[...PALETTE, BLANK].map((c) => (
          <Pressable
            key={c}
            onPress={() => setBrush(c)}
            accessibilityRole="radio"
            accessibilityState={{ checked: brush === c }}
            accessibilityLabel={c === BLANK ? 'Gomme' : `Couleur ${c}`}
            style={[styles.swatch, { backgroundColor: c }, brush === c && styles.swatchOn]}
          >
            {c === BLANK ? <Text style={{ fontSize: 11, color: colors.muted }}>gomme</Text> : null}
          </Pressable>
        ))}
      </View>
      <Text style={type.small}>
        {done} zone{done > 1 ? 's' : ''} colorée{done > 1 ? 's' : ''} sur {shapes.length}. Ton mandala est conservé sur ce téléphone.
      </Text>
      <View style={{ alignSelf: 'stretch' }}>
        <Button label="J’ai terminé" icon="checkmark" onPress={() => onDone(done, `Mandala colorié à ${Math.round((done / shapes.length) * 100)} %.`)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: 300, height: 300, maxWidth: '100%', aspectRatio: 1 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 3, borderColor: colors.navy },
});
