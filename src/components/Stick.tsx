import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { SkinDef } from '../types';

interface Props {
  skin: SkinDef;
  rotate: Animated.Value;
  scale: Animated.Value;
}

export default function Stick({ skin, rotate, scale }: Props) {
  const rotateInterpolated = rotate.interpolate({
    inputRange: [-100000, 100000],
    outputRange: ['-100000deg', '100000deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        {
          width: skin.length,
          height: skin.width,
          marginLeft: -skin.length / 2,
          marginTop: -skin.width / 2,
          transform: [{ rotate: rotateInterpolated }, { scale }],
          shadowColor: skin.glow ?? 'transparent',
          shadowOpacity: skin.glow ? 0.9 : 0,
          shadowRadius: skin.glow ? 18 : 0,
          elevation: skin.glow ? 12 : 4,
        },
      ]}
    >
      <LinearGradient
        colors={skin.colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.bar, { borderRadius: skin.width / 2 }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: '100%',
    height: '100%',
  },
});
