import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../ui/components';
import { colors, radius, space, type } from '../ui/theme';
import type { GameProps } from './types';

/** Formes ET couleurs différentes : le jeu reste lisible sans distinguer les couleurs. */
const KINDS: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }[] = [
  { icon: 'star', color: '#E0A100', label: 'étoile' },
  { icon: 'ellipse', color: '#3E8ED0', label: 'planète' },
  { icon: 'triangle', color: '#2E8B7A', label: 'triangle' },
  { icon: 'square', color: '#7C5CC4', label: 'carré' },
  { icon: 'diamond', color: '#D9707A', label: 'losange' },
];
const N = 6;
const GOAL = 30;

type Board = number[];

const rnd = () => Math.floor(Math.random() * KINDS.length);

function findMatches(b: Board): Set<number> {
  const out = new Set<number>();
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = b[r * N + c];
      if (v < 0) continue;
      if (c <= N - 3 && b[r * N + c + 1] === v && b[r * N + c + 2] === v) [0, 1, 2].forEach((k) => out.add(r * N + c + k));
      if (r <= N - 3 && b[(r + 1) * N + c] === v && b[(r + 2) * N + c] === v) [0, 1, 2].forEach((k) => out.add((r + k) * N + c));
    }
  return out;
}

/** Vrai s'il existe au moins un échange qui crée un alignement. */
function hasMove(b: Board): boolean {
  for (let i = 0; i < N * N; i++)
    for (const j of [i + 1, i + N]) {
      if (j >= N * N || (j === i + 1 && Math.floor(i / N) !== Math.floor(j / N))) continue;
      const t = [...b];
      [t[i], t[j]] = [t[j], t[i]];
      if (findMatches(t).size > 0) return true;
    }
  return false;
}

function newBoard(): Board {
  let b: Board;
  do {
    b = Array.from({ length: N * N }, rnd);
  } while (findMatches(b).size > 0 || !hasMove(b));
  return b;
}

/** Retire les alignements, fait tomber les formes et complète, jusqu'à stabilité. */
function resolve(b: Board): { board: Board; cleared: number } {
  let board = [...b];
  let cleared = 0;
  for (let m = findMatches(board); m.size > 0; m = findMatches(board)) {
    cleared += m.size;
    m.forEach((i) => (board[i] = -1));
    for (let c = 0; c < N; c++) {
      const col = [];
      for (let r = N - 1; r >= 0; r--) if (board[r * N + c] >= 0) col.push(board[r * N + c]);
      for (let r = N - 1, k = 0; r >= 0; r--, k++) board[r * N + c] = k < col.length ? col[k] : rnd();
    }
  }
  return { board, cleared };
}

/** Jeu d'association sans chronomètre ni défaite. */
export function Constellations({ onDone }: GameProps) {
  const [board, setBoard] = useState(newBoard);
  const [sel, setSel] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('Touche une forme, puis une forme voisine pour les échanger.');

  const tap = (i: number) => {
    if (sel === null) return setSel(i);
    if (sel === i) return setSel(null);
    const adjacent = (Math.abs(sel - i) === 1 && Math.floor(sel / N) === Math.floor(i / N)) || Math.abs(sel - i) === N;
    if (!adjacent) return setSel(i);
    const swapped = [...board];
    [swapped[sel], swapped[i]] = [swapped[i], swapped[sel]];
    setSel(null);
    if (findMatches(swapped).size === 0) {
      setMsg('Pas d’alignement ici. Essaie un autre échange, rien ne presse.');
      return;
    }
    const { board: next, cleared } = resolve(swapped);
    setScore((s) => s + cleared);
    if (!hasMove(next)) {
      // Aucun coup possible : le ciel se recompose, sans pénalité.
      setBoard(newBoard());
      setMsg(`${cleared} formes rejoignent la constellation. Le ciel se recompose.`);
      return;
    }
    setBoard(next);
    setMsg(`${cleared} formes rejoignent la constellation.`);
  };

  return (
    <View style={{ alignItems: 'center', gap: space.md }}>
      <Text style={type.section}>
        {score} / {GOAL} étoiles rassemblées
      </Text>
      <View style={styles.grid}>
        {board.map((v, i) => {
          const k = KINDS[v];
          return (
            <Pressable
              key={i}
              onPress={() => tap(i)}
              accessibilityRole="button"
              accessibilityLabel={`${k.label}, ligne ${Math.floor(i / N) + 1}, colonne ${(i % N) + 1}`}
              accessibilityState={{ selected: sel === i }}
              style={[styles.cell, sel === i && styles.sel]}
            >
              <Ionicons name={k.icon} size={28} color={k.color} />
            </Pressable>
          );
        })}
      </View>
      <Text style={[type.small, { textAlign: 'center', minHeight: 36 }]}>{msg}</Text>
      <View style={{ alignSelf: 'stretch' }}>
        <Button
          label={score >= GOAL ? 'Constellation complète' : 'Terminer ma pause'}
          icon={score >= GOAL ? 'sparkles' : 'checkmark'}
          onPress={() => onDone(score, `${score} étoiles rassemblées, sans chronomètre.`)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { width: N * 50, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.navy, borderRadius: radius.small, padding: 3 },
  cell: { width: 44, height: 44, margin: 3, borderRadius: 10, backgroundColor: '#22325A', alignItems: 'center', justifyContent: 'center' },
  sel: { backgroundColor: colors.accentSoft },
});
