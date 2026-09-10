import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
const YAW_SENSITIVITY = 0.55;
const PITCH_SENSITIVITY = 0.35;
const THROW_SPEED_THRESHOLD = 0.55; // px/ms
const GRAVITY = 0.0055; // px/ms^2
const MIN_FLIGHT_MS = 550;
const MAX_FLIGHT_MS = 1500;

function shortestDelta(a: number, b: number) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export default function PlayArea({ skin, onSwing }: Props) {
  const skinRef = useRef(skin);
  skinRef.current = skin;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rotateZ = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const rotateX = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [popups, setPopups] = useState<Popup[]>([]);
  const popupIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const gestureState = useRef({
    lastWrappedAngle: 0,
    unwrappedZ: 0,
    unwrappedY: 0,
    unwrappedX: 0,
    lastX: 0,
    lastY: 0,
    accumAngle: 0,
    lastSwingTime: 0,
    tossing: false,
  });

  const center = useMemo(() => ({ x: size.width / 2, y: size.height / 2 }), [size]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const spawnPopup = (text: string, x: number, y: number) => {
    const id = popupIdRef.current++;
    const anim = new Animated.Value(0);
    setPopups((p) => [...p, { id, value: text, x, y, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }).start(() => {
      setPopups((p) => p.filter((pp) => pp.id !== id));
    });
  };

  const registerSwing = (intensityFactor: number, x: number, y: number) => {
    const gained = onSwing(intensityFactor);
    playSwingSound(
      skinRef.current.sound,
      0.35 + Math.min(0.65, intensityFactor * 0.25),
      0.85 + Math.min(0.6, intensityFactor * 0.2)
    );
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
    spawnPopup(`+${Math.round(gained)}`, x, y);
  };

  const throwBaton = (vx: number, vy: number, x: number, y: number) => {
    const gs = gestureState.current;
    gs.tossing = true;

    const speed = Math.hypot(vx, vy);
    const dirX = vx === 0 ? 1 : Math.sign(vx);
    const dirY = vy === 0 ? -1 : Math.sign(vy);
    const spinYPerMs = (0.15 + Math.abs(vx) * 0.35) * dirX;
    const spinXPerMs = (0.12 + Math.abs(vy) * 0.3) * -dirY;
    const spinZPerMs = (0.2 + speed * 0.25) * dirX;

    const gravityFlight = (2 * Math.abs(vy)) / GRAVITY;
    const flightDuration = Math.max(MIN_FLIGHT_MS, Math.min(MAX_FLIGHT_MS, gravityFlight || MIN_FLIGHT_MS));

    const boundX = Math.max(60, size.width * 0.42);
    const boundY = Math.max(60, size.height * 0.32);

    playSwingSound(skinRef.current.sound, 0.9, 1.05 + Math.min(0.5, speed * 0.15));

    const start = Date.now();
    let lastFrame = start;

    const step = () => {
      const now = Date.now();
      const elapsed = now - start;
      const dt = now - lastFrame;
      lastFrame = now;

      if (elapsed >= flightDuration) {
        translateX.setValue(0);
        translateY.setValue(0);
        scale.setValue(1);

        const totalDeg = (Math.abs(spinXPerMs) + Math.abs(spinYPerMs) + Math.abs(spinZPerMs)) * flightDuration;
        const tours = totalDeg / 360;
        const intensityFactor = Math.max(1.5, Math.min(8, tours * 1.2));
        const gained = onSwing(intensityFactor);
        playSwingSound(skinRef.current.sound, 1, 0.9);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        spawnPopup(`+${Math.round(gained)}  (${tours.toFixed(1)} tours!)`, x, y);
        gs.tossing = false;
        rafRef.current = null;
        return;
      }

      const t = elapsed;
      const posX = Math.max(-boundX, Math.min(boundX, vx * t));
      const posYRaw = vy * t + 0.5 * GRAVITY * t * t;
      const posY = Math.max(-boundY, Math.min(boundY, posYRaw));
      translateX.setValue(posX);
      translateY.setValue(posY);

      gs.unwrappedX += spinXPerMs * dt;
      gs.unwrappedY += spinYPerMs * dt;
      gs.unwrappedZ += spinZPerMs * dt;
      rotateX.setValue(gs.unwrappedX);
      rotateY.setValue(gs.unwrappedY);
      rotateZ.setValue(gs.unwrappedZ);

      const depth = 1 - Math.abs(posY) / (boundY * 2);
      scale.setValue(0.85 + depth * 0.3);

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !gestureState.current.tossing,
        onMoveShouldSetPanResponder: () => !gestureState.current.tossing,
        onPanResponderGrant: (evt) => {
          if (gestureState.current.tossing) return;
          const { locationX, locationY } = evt.nativeEvent;
          const angle = (Math.atan2(locationY - center.y, locationX - center.x) * 180) / Math.PI;
          const gs = gestureState.current;
          gs.lastWrappedAngle = angle;
          gs.lastX = locationX;
          gs.lastY = locationY;
          gs.accumAngle = 0;
          gs.lastSwingTime = Date.now();
        },
        onPanResponderMove: (evt) => {
          const gs = gestureState.current;
          if (gs.tossing) return;
          const { locationX, locationY } = evt.nativeEvent;
          const dx = locationX - center.x;
          const dy = locationY - center.y;
          if (Math.hypot(dx, dy) < 12) return;

          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const deltaZ = shortestDelta(angle, gs.lastWrappedAngle);
          gs.lastWrappedAngle = angle;

          const moveDx = locationX - gs.lastX;
          const moveDy = locationY - gs.lastY;
          gs.lastX = locationX;
          gs.lastY = locationY;
          const deltaY = moveDx * YAW_SENSITIVITY;
          const deltaX = -moveDy * PITCH_SENSITIVITY;

          gs.unwrappedZ += deltaZ;
          gs.unwrappedY += deltaY;
          gs.unwrappedX += deltaX;
          rotateZ.setValue(gs.unwrappedZ);
          rotateY.setValue(gs.unwrappedY);
          rotateX.setValue(gs.unwrappedX);

          gs.accumAngle += Math.abs(deltaZ) + Math.abs(deltaY) * 0.5 + Math.abs(deltaX) * 0.5;

          if (gs.accumAngle >= SWING_THRESHOLD_DEG) {
            const now = Date.now();
            const dt = Math.max(1, now - gs.lastSwingTime);
            if (dt >= MIN_SWING_INTERVAL_MS) {
              const angularVelocity = gs.accumAngle / dt;
              const intensityFactor = Math.max(0.6, Math.min(4, angularVelocity * 6));
              registerSwing(intensityFactor, locationX, locationY);
              gs.lastSwingTime = now;
            }
            gs.accumAngle = 0;
          }
        },
        onPanResponderRelease: (evt, releaseGestureState) => {
          const gs = gestureState.current;
          if (gs.tossing) return;
          const speed = Math.hypot(releaseGestureState.vx, releaseGestureState.vy);
          if (speed >= THROW_SPEED_THRESHOLD) {
            const { locationX, locationY } = evt.nativeEvent;
            throwBaton(releaseGestureState.vx, releaseGestureState.vy, locationX, locationY);
          }
        },
      }),
    [center, size]
  );

  return (
    <View style={styles.container} onLayout={onLayout} {...panResponder.panHandlers}>
      {size.width > 0 && (
        <>
          <Stick
            skin={skin}
            rotateZ={rotateZ}
            rotateY={rotateY}
            rotateX={rotateX}
            translateX={translateX}
            translateY={translateY}
            scale={scale}
          />
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
            <Text style={styles.hintText}>Fais glisser pour orienter · lance vite pour un tour en l'air !</Text>
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
    paddingHorizontal: 20,
  },
  hintText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
  },
});
