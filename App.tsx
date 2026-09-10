import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PlayArea from './src/components/PlayArea';
import Shop from './src/components/Shop';
import { SKINS, pointsPerSwing } from './src/config';
import { formatNumber } from './src/format';
import { playClickSound } from './src/sound';
import { useGameStore } from './src/store/useGameStore';

type Tab = 'play' | 'shop';

export default function App() {
  const { state, addSwing, buySkin, equipSkin, buyUpgrade } = useGameStore();
  const [tab, setTab] = useState<Tab>('play');
  const equippedSkin = SKINS.find((s) => s.id === state.equippedSkin) ?? SKINS[0];

  if (!state.hydrated) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.points}>{formatNumber(state.points)}</Text>
          <Text style={styles.pointsLabel}>points</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.statLine}>{formatNumber(state.totalSwings)} mouvements</Text>
          <Text style={styles.statLine}>{formatNumber(pointsPerSwing(state.upgrades))} pts / mouvement</Text>
        </View>
      </View>

      <View style={styles.body}>
        {tab === 'play' ? (
          <PlayArea skin={equippedSkin} onSwing={addSwing} />
        ) : (
          <Shop state={state} onBuySkin={buySkin} onEquipSkin={equipSkin} onBuyUpgrade={buyUpgrade} />
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'play' && styles.tabButtonActive]}
          onPress={() => {
            playClickSound();
            setTab('play');
          }}
        >
          <Text style={[styles.tabText, tab === 'play' && styles.tabTextActive]}>🥢 Bâton</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'shop' && styles.tabButtonActive]}
          onPress={() => {
            playClickSound();
            setTab('shop');
          }}
        >
          <Text style={[styles.tabText, tab === 'shop' && styles.tabTextActive]}>🛒 Boutique</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#12141c' },
  container: { flex: 1, backgroundColor: '#12141c' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  points: { color: '#fff', fontSize: 32, fontWeight: '800' },
  pointsLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: -2 },
  headerRight: { alignItems: 'flex-end' },
  statLine: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabButtonActive: { borderTopWidth: 2, borderTopColor: '#ffd23f', marginTop: -StyleSheet.hairlineWidth },
  tabText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  tabTextActive: { color: '#ffd23f' },
});
