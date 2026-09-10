import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { SkinDef } from '../types';

interface Props {
  skin: SkinDef;
  rotateZ: Animated.Value;
  rotateY: Animated.Value;
  rotateX: Animated.Value;
  translateX: Animated.Value;
  translateY: Animated.Value;
  scale: Animated.Value;
}

const AXIS_RANGE: [number, number] = [-1000000, 1000000];
const AXIS_OUTPUT: [string, string] = ['-1000000deg', '1000000deg'];

export default function Stick({ skin, rotateZ, rotateY, rotateX, translateX, translateY, scale }: Props) {
  const rz = rotateZ.interpolate({ inputRange: AXIS_RANGE, outputRange: AXIS_OUTPUT });
  const ry = rotateY.interpolate({ inputRange: AXIS_RANGE, outputRange: AXIS_OUTPUT });
  const rx = rotateX.interpolate({ inputRange: AXIS_RANGE, outputRange: AXIS_OUTPUT });
  const capSize = skin.width * 1.7;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        {
          transform: [
            { perspective: 900 },
            { translateX },
            { translateY },
            { rotateY: ry },
            { rotateX: rx },
            { rotateZ: rz },
            { scale },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.bar,
          {
            width: skin.length,
            height: skin.width,
            marginLeft: -skin.length / 2,
            marginTop: -skin.width / 2,
            borderRadius: skin.width / 2,
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
          style={[styles.fill, { borderRadius: skin.width / 2 }]}
        />
      </Animated.View>
      {[-1, 1].map((side) => (
        <Animated.View
          key={side}
          style={[
            styles.cap,
            {
              width: capSize,
              height: capSize,
              borderRadius: capSize / 2,
              marginLeft: (side * skin.length) / 2 - capSize / 2,
              marginTop: -capSize / 2,
              backgroundColor: skin.glow ? skin.colors[1] : '#fdf6e3',
              borderColor: skin.colors[1],
              shadowColor: skin.glow ?? 'transparent',
              shadowOpacity: skin.glow ? 0.9 : 0,
              shadowRadius: skin.glow ? 12 : 0,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  bar: {
    position: 'absolute',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  cap: {
    position: 'absolute',
    borderWidth: 2,
  },
});
