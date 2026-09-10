import * as Haptics from 'expo-haptics';
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { IMPACT_SOUND } from '../config';
import { playSwingSound } from '../sound';
import { SkinDef } from '../types';
import BatonScene from './BatonScene';

interface Props {
  skin: SkinDef;
  onSwing: (intensityFactor: number) => number;
}

interface Popup {
  id: number;
  value: string;
  x: number;
  y: number;
  anim: Animated.Value;
}

export default function PlayArea({ skin, onSwing }: Props) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const popupIdRef = useRef(0);
  const skinRef = useRef(skin);
  skinRef.current = skin;
  const onSwingRef = useRef(onSwing);
  onSwingRef.current = onSwing;

  const spawnPopup = (text: string, x: number, y: number) => {
    const id = popupIdRef.current++;
    const anim = new Animated.Value(0);
    setPopups((p) => [...p.slice(-8), { id, value: text, x, y, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }).start(() => {
      setPopups((p) => p.filter((pp) => pp.id !== id));
    });
  };

  const events = useMemo(
    () => ({
      onSwing: (intensity: number, screen: { x: number; y: number }) => {
        const gained = onSwingRef.current(intensity);
        playSwingSound(
          skinRef.current.sound,
          0.35 + Math.min(0.65, intensity * 0.25),
          0.85 + Math.min(0.6, intensity * 0.2)
        );
        if (Platform.OS !== 'web') {
          const style =
            intensity > 2.5
              ? Haptics.ImpactFeedbackStyle.Heavy
              : intensity > 1.5
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light;
          Haptics.impactAsync(style).catch(() => {});
        }
        spawnPopup(`+${Math.round(gained)}`, screen.x, screen.y);
      },
      onImpact: (strength: number) => {
        playSwingSound(IMPACT_SOUND, 0.25 + strength * 0.6, 0.85 + strength * 0.35);
        if (Platform.OS !== 'web' && strength > 0.35) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
        }
      },
      onCatch: (turns: number, screen: { x: number; y: number }) => {
        const gained = onSwingRef.current(Math.max(1.5, Math.min(8, turns * 1.2)));
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        spawnPopup(`+${Math.round(gained)}  (${turns.toFixed(1)} tours !)`, screen.x, screen.y);
      },
    }),
    []
  );

  return (
    <View style={styles.container}>
      <BatonScene skin={skin} events={events} />
      <View style={styles.overlay} pointerEvents="none">
        {popups.map((p) => (
          <Animated.Text
            key={p.id}
            style={[
              styles.popup,
              {
                left: p.x,
                top: p.y,
                opacity: p.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [{ translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) }],
              },
            ]}
          >
            {p.value}
          </Animated.Text>
        ))}
        <View style={styles.hint}>
          <Text style={styles.hintText}>Attrape le bâton, secoue-le, lance-le en l’air.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  popup: {
    position: 'absolute',
    color: '#ffd23f',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  hint: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  hintText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
  },
});
