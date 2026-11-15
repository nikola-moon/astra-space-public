import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../ui/components';
import { NovaAvatar } from '../ui/Nova';
import { colors, space, type } from '../ui/theme';
import type { GameProps } from './types';

const HALF = 5000; // 5 s d'inspiration, 5 s d'expiration : 6 cycles par minute.
const TOTAL = 12 * 2 * HALF; // 2 minutes.
const TICK = 100;

/** Respiration guidée : maintenir appuyé pendant l'inspiration, relâcher pendant l'expiration. */
export function Souffle({ stage, onDone }: GameProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pressed = useRef(false);
  const ticks = useRef({ ok: 0, all: 0 });

  const startedAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const e = Date.now() - startedAt.current;
      const inhale = e % (2 * HALF) < HALF;
      ticks.current.all += 1;
      if (pressed.current === inhale) ticks.current.ok += 1;
      setElapsed(Math.min(e, TOTAL));
    }, TICK);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running || elapsed < TOTAL) return;
    setRunning(false);
    const pct = Math.round((ticks.current.ok / Math.max(1, ticks.current.all)) * 100);
    onDone(pct, `${pct} % du temps au rythme de Nova sur 12 respirations.`);
  }, [elapsed, running, onDone]);

  const inhale = elapsed % (2 * HALF) < HALF;
  const t = (elapsed % HALF) / HALF;
  const scale = running ? (inhale ? 0.62 + 0.38 * t : 1 - 0.38 * t) : 0.62;
  const left = Math.ceil((HALF - (elapsed % HALF)) / 1000);
  const cycle = Math.min(12, Math.floor(elapsed / (2 * HALF)) + 1);

  return (
    <View style={{ alignItems: 'center', gap: space.lg }}>
      <View style={styles.stage}>
        <View style={[styles.halo, { transform: [{ scale }] }]} />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <NovaAvatar stage={stage} reaction="idle" reactionKey={0} size={130} />
          </View>
        </View>
      </View>
      <Text style={type.big} accessibilityLiveRegion="polite">
        {running ? (inhale ? `Inspire… ${left}` : `Expire… ${left}`) : 'Prêt ?'}
      </Text>
      <Text style={type.small}>{running ? `Respiration ${cycle} sur 12` : 'Maintiens le bouton appuyé pendant que tu inspires, relâche pour expirer.'}</Text>
      {running ? (
        <Pressable
          onPressIn={() => (pressed.current = true)}
          onPressOut={() => (pressed.current = false)}
          accessibilityRole="button"
          accessibilityLabel="Maintenir pendant l’inspiration"
          style={({ pressed: p }) => [styles.hold, p && { backgroundColor: colors.accent }]}
        >
          <Text style={styles.holdText}>Maintenir pour inspirer</Text>
        </Pressable>
      ) : (
        <View style={{ alignSelf: 'stretch' }}>
          <Button
            label="Commencer"
            icon="play"
            onPress={() => {
              ticks.current = { ok: 0, all: 0 };
              startedAt.current = Date.now();
              setElapsed(0);
              setRunning(true);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  halo: { width: 240, height: 240, borderRadius: 120, backgroundColor: colors.accentSoft, borderWidth: 3, borderColor: colors.accent },
  hold: {
    alignSelf: 'stretch',
    minHeight: 72,
    borderRadius: 36,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
