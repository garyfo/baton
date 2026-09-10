import * as Haptics from 'expo-haptics';
import React, { useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { SkinDef } from '../types';
import { playSwingSound } from '../sound';
import Stick from './Stick';

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

const SWING_THRESHOLD_DEG = 22;
const MIN_SWING_INTERVAL_MS = 90;

function shortestDelta(a: number, b: number) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export default function PlayArea({ skin, onSwing }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [popups, setPopups] = useState<Popup[]>([]);
  const popupIdRef = useRef(0);

  const gestureState = useRef({
    lastWrappedAngle: 0,
    unwrapped: 0,
    accumAngle: 0,
    lastSwingTime: 0,
    swingStartTime: 0,
    touching: false,
  });

  const center = useMemo(() => ({ x: size.width / 2, y: size.height / 2 }), [size]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const spawnPopup = (value: number, x: number, y: number) => {
    const id = popupIdRef.current++;
    const anim = new Animated.Value(0);
    setPopups((p) => [...p, { id, value: `+${Math.round(value)}`, x, y, anim }]);
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start(() => {
      setPopups((p) => p.filter((pp) => pp.id !== id));
    });
  };

  const registerSwing = (intensityFactor: number, x: number, y: number) => {
    const gained = onSwing(intensityFactor);
    playSwingSound(skin.sound, 0.35 + Math.min(0.65, intensityFactor * 0.25), 0.85 + Math.min(0.6, intensityFactor * 0.2));
    if (Platform.OS !== 'web') {
      const style =
        intensityFactor > 2
          ? Haptics.ImpactFeedbackStyle.Heavy
          : intensityFactor > 1.2
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => {});
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 1 + Math.min(0.35, intensityFactor * 0.12), duration: 60, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();
    spawnPopup(gained, x, y);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const angle = (Math.atan2(locationY - center.y, locationX - center.x) * 180) / Math.PI;
          gestureState.current.lastWrappedAngle = angle;
          gestureState.current.accumAngle = 0;
          gestureState.current.lastSwingTime = Date.now();
          gestureState.current.touching = true;
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const dx = locationX - center.x;
          const dy = locationY - center.y;
          if (Math.hypot(dx, dy) < 12) return;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const gs = gestureState.current;
          const delta = shortestDelta(angle, gs.lastWrappedAngle);
          gs.lastWrappedAngle = angle;
          gs.unwrapped += delta;
          rotate.setValue(gs.unwrapped);
          gs.accumAngle += Math.abs(delta);

          if (gs.accumAngle >= SWING_THRESHOLD_DEG) {
            const now = Date.now();
            const dt = Math.max(1, now - gs.lastSwingTime);
            if (dt >= MIN_SWING_INTERVAL_MS) {
              const angularVelocity = gs.accumAngle / dt; // deg per ms
              const intensityFactor = Math.max(0.6, Math.min(4, angularVelocity * 6));
              registerSwing(intensityFactor, locationX, locationY);
              gs.lastSwingTime = now;
            }
            gs.accumAngle = 0;
          }
        },
        onPanResponderRelease: () => {
          gestureState.current.touching = false;
          const target = Math.round(gestureState.current.unwrapped / 360) * 360;
          Animated.spring(rotate, {
            toValue: target,
            friction: 5,
            tension: 40,
            useNativeDriver: true,
          }).start(() => {
            gestureState.current.unwrapped = target;
          });
        },
      }),
    [center, skin]
  );

  return (
    <View style={styles.container} onLayout={onLayout} {...panResponder.panHandlers}>
      {size.width > 0 && (
        <>
          <Stick skin={skin} rotate={rotate} scale={scale} />
          {popups.map((p) => (
            <Animated.Text
              key={p.id}
              style={[
                styles.popup,
                {
                  left: p.x,
                  top: p.y,
                  opacity: p.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [
                    { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) },
                  ],
                },
              ]}
            >
              {p.value}
            </Animated.Text>
          ))}
          <View pointerEvents="none" style={styles.hint}>
            <Text style={styles.hintText}>Fais tourner le bâton avec ton doigt !</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
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
    alignSelf: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
});
