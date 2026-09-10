import { GLView } from 'expo-gl';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { unlockAudio } from '../sound';
import { BatonWorld, WorldEvents } from '../three/world';
import { SkinDef } from '../types';

interface Props {
  skin: SkinDef;
  events: WorldEvents;
}

export default function BatonScene({ skin, events }: Props) {
  const worldRef = useRef<BatonWorld | null>(null);
  const frameRef = useRef<number | null>(null);
  const layoutRef = useRef({ width: 1, height: 1 });
  const skinRef = useRef(skin);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    skinRef.current = skin;
    worldRef.current?.setSkin(skin);
  }, [skin]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, []);

  const onContextCreate = useCallback((gl: any) => {
    const world = new BatonWorld(gl, {
      onSwing: (intensity, screen) => eventsRef.current.onSwing(intensity, screen),
      onImpact: (strength) => eventsRef.current.onImpact(strength),
      onCatch: (turns, screen) => eventsRef.current.onCatch(turns, screen),
    });
    worldRef.current = world;
    world.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, layoutRef.current.width, layoutRef.current.height);
    world.setSkin(skinRef.current);

    let last = Date.now();
    let bufferWidth = gl.drawingBufferWidth;
    let bufferHeight = gl.drawingBufferHeight;
    const loop = () => {
      const now = Date.now();
      const dt = Math.max(0.001, (now - last) / 1000);
      last = now;
      // The canvas backing store is resized outside React (and asynchronously
      // on web), so track it here rather than reacting to layout.
      if (gl.drawingBufferWidth !== bufferWidth || gl.drawingBufferHeight !== bufferHeight) {
        bufferWidth = gl.drawingBufferWidth;
        bufferHeight = gl.drawingBufferHeight;
        world.setSize(bufferWidth, bufferHeight, layoutRef.current.width, layoutRef.current.height);
      }
      world.update(dt);
      world.render();
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    layoutRef.current = { width, height };
    worldRef.current?.setCssSize(width, height);
  }, []);

  const toNdc = (x: number, y: number) => ({
    nx: (x / layoutRef.current.width) * 2 - 1,
    ny: -((y / layoutRef.current.height) * 2 - 1),
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          unlockAudio();
          const { nx, ny } = toNdc(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          worldRef.current?.grab(nx, ny);
        },
        onPanResponderMove: (evt) => {
          const { nx, ny } = toNdc(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          worldRef.current?.move(nx, ny);
        },
        onPanResponderRelease: () => worldRef.current?.release(),
        onPanResponderTerminate: () => worldRef.current?.release(),
      }),
    []
  );

  return (
    <View style={styles.container} onLayout={onLayout} {...panResponder.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
});
