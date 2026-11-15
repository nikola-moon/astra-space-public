import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../ui/components';
import { colors, radius, space, type } from '../ui/theme';
import type { GameProps } from './types';

const N = 7;
type Piece = { cells: [number, number][]; color: string };

/** Modules de station : formes fixes, posées sur une grille (pas de chute ni de rotation). */
const SHAPES: [number, number][][] = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
];
const TINTS = ['#3E8ED0', '#7C5CC4', '#2E8B7A', '#E0A100', '#D9707A'];

const randomPiece = (): Piece => ({
  cells: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  color: TINTS[Math.floor(Math.random() * TINTS.length)],
});
const hand = () => [randomPiece(), randomPiece(), randomPiece()];

function fits(grid: (string | null)[], p: Piece, r: number, c: number) {
  return p.cells.every(([dr, dc]) => r + dr < N && c + dc < N && grid[(r + dr) * N + c + dc] === null);
}

function anyFit(grid: (string | null)[], pieces: (Piece | null)[]) {
  return pieces.some((p) => p && grid.some((_, i) => fits(grid, p, Math.floor(i / N), i % N)));
}

/** Placement visuospatial sans chrono : une ligne ou une colonne complète se libère. */
export function Assemblage({ onDone }: GameProps) {
  const [grid, setGrid] = useState<(string | null)[]>(() => Array(N * N).fill(null));
  const [pieces, setPieces] = useState<(Piece | null)[]>(hand);
  const [sel, setSel] = useState<number | null>(0);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('Choisis un module, puis touche la case de son coin supérieur gauche.');
  const blocked = !anyFit(grid, pieces);

  const place = (i: number) => {
    if (sel === null || !pieces[sel]) return;
    const p = pieces[sel]!;
    const r = Math.floor(i / N);
    const c = i % N;
    if (!fits(grid, p, r, c)) {
      setMsg('Ce module ne tient pas ici. Essaie une autre case.');
      return;
    }
    const g = [...grid];
    p.cells.forEach(([dr, dc]) => (g[(r + dr) * N + c + dc] = p.color));
    // Libère les lignes et colonnes complètes.
    const full = new Set<number>();
    for (let k = 0; k < N; k++) {
      if (Array.from({ length: N }, (_, j) => g[k * N + j]).every(Boolean)) for (let j = 0; j < N; j++) full.add(k * N + j);
      if (Array.from({ length: N }, (_, j) => g[j * N + k]).every(Boolean)) for (let j = 0; j < N; j++) full.add(j * N + k);
    }
    full.forEach((x) => (g[x] = null));
    let next = pieces.map((q, k) => (k === sel ? null : q));
    if (next.every((q) => q === null)) next = hand();
    setGrid(g);
    setPieces(next);
    setSel(next.findIndex((q) => q !== null));
    setScore((s) => s + p.cells.length + full.size);
    setMsg(full.size ? 'Une section de la station est terminée et libérée.' : 'Module installé.');
  };

  return (
    <View style={{ alignItems: 'center', gap: space.md }}>
      <Text style={type.section}>{score} points</Text>
      <View style={styles.board}>
        {grid.map((v, i) => (
          <Pressable
            key={i}
            onPress={() => place(i)}
            accessibilityRole="button"
            accessibilityLabel={`Case ligne ${Math.floor(i / N) + 1}, colonne ${(i % N) + 1}${v ? ', occupée' : ''}`}
            style={[styles.cell, v ? { backgroundColor: v } : null]}
          />
        ))}
      </View>
      <View style={styles.tray}>
        {pieces.map((p, k) => (
          <Pressable
            key={k}
            disabled={!p}
            onPress={() => setSel(k)}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel === k, disabled: !p }}
            accessibilityLabel={p ? `Module de ${p.cells.length} case${p.cells.length > 1 ? 's' : ''}` : 'Emplacement vide'}
            style={[styles.slot, sel === k && styles.slotOn]}
          >
            {p ? (
              <View style={{ width: 3 * 16, height: 3 * 16 }}>
                {p.cells.map(([r, c], j) => (
                  <View key={j} style={[styles.mini, { top: r * 16, left: c * 16, backgroundColor: p.color }]} />
                ))}
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      <Text style={[type.small, { textAlign: 'center', minHeight: 36 }]}>
        {blocked ? 'Plus de place pour ces modules. Tu peux recommencer une grille.' : msg}
      </Text>
      <View style={{ alignSelf: 'stretch', gap: space.sm }}>
        {blocked ? (
          <Button
            label="Nouvelle grille"
            icon="refresh"
            variant="secondary"
            onPress={() => {
              setGrid(Array(N * N).fill(null));
              setPieces(hand());
              setSel(0);
            }}
          />
        ) : null}
        <Button label="Terminer ma pause" icon="checkmark" onPress={() => onDone(score, `${score} points d’assemblage.`)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { width: N * 40 + 6, flexDirection: 'row', flexWrap: 'wrap', padding: 3, borderRadius: radius.small, backgroundColor: colors.line },
  cell: { width: 36, height: 36, margin: 2, borderRadius: 6, backgroundColor: colors.card },
  tray: { flexDirection: 'row', gap: space.md },
  slot: { width: 72, height: 72, borderRadius: radius.small, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  slotOn: { borderColor: colors.navy },
  mini: { position: 'absolute', width: 14, height: 14, borderRadius: 3 },
});
