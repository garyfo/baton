import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SKINS, UPGRADES, pointsPerSwing, upgradeCost } from '../config';
import { playClickSound } from '../sound';
import { GameState, SkinId, UpgradeId } from '../types';
import { formatNumber } from '../format';

interface Props {
  state: GameState;
  onBuySkin: (id: SkinId) => void;
  onEquipSkin: (id: SkinId) => void;
  onBuyUpgrade: (id: UpgradeId) => void;
}

export default function Shop({ state, onBuySkin, onEquipSkin, onBuyUpgrade }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Skins de bâton</Text>
      {SKINS.map((skin) => {
        const owned = state.ownedSkins.includes(skin.id);
        const equipped = state.equippedSkin === skin.id;
        const canAfford = state.points >= skin.cost;
        return (
          <View key={skin.id} style={styles.card}>
            <LinearGradient colors={skin.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{skin.name}</Text>
              <Text style={styles.cardDesc}>{skin.description}</Text>
            </View>
            {equipped ? (
              <View style={[styles.button, styles.buttonEquipped]}>
                <Text style={styles.buttonTextEquipped}>Équipé</Text>
              </View>
            ) : owned ? (
              <TouchableOpacity
                style={[styles.button, styles.buttonOwned]}
                onPress={() => {
                  playClickSound();
                  onEquipSkin(skin.id);
                }}
              >
                <Text style={styles.buttonTextLight}>Équiper</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                disabled={!canAfford}
                style={[styles.button, canAfford ? styles.buttonBuy : styles.buttonDisabled]}
                onPress={() => {
                  playClickSound();
                  onBuySkin(skin.id);
                }}
              >
                <Text style={canAfford ? styles.buttonText : styles.buttonTextDisabled}>
                  {formatNumber(skin.cost)} pts
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Améliorations</Text>
      <Text style={styles.sectionSubtitle}>
        Gain actuel : {formatNumber(pointsPerSwing(state.upgrades))} points / mouvement
      </Text>
      {UPGRADES.map((upgrade) => {
        const level = state.upgrades[upgrade.id] ?? 0;
        const maxed = level >= upgrade.maxLevel;
        const cost = upgradeCost(upgrade, level);
        const canAfford = state.points >= cost;
        return (
          <View key={upgrade.id} style={styles.card}>
            <View style={styles.upgradeIcon}>
              <Text style={styles.upgradeLevel}>Lv {level}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{upgrade.name}</Text>
              <Text style={styles.cardDesc}>{upgrade.description}</Text>
            </View>
            <TouchableOpacity
              disabled={maxed || !canAfford}
              style={[styles.button, maxed ? styles.buttonOwned : canAfford ? styles.buttonBuy : styles.buttonDisabled]}
              onPress={() => {
                playClickSound();
                onBuyUpgrade(upgrade.id);
              }}
            >
              <Text style={maxed ? styles.buttonTextLight : canAfford ? styles.buttonText : styles.buttonTextDisabled}>
                {maxed ? 'Max' : `${formatNumber(cost)} pts`}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 12, marginBottom: 10 },
  sectionSubtitle: { color: 'rgba(255,255,255,0.6)', marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  swatch: { width: 44, height: 44, borderRadius: 10 },
  upgradeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeLevel: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cardDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  button: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, minWidth: 84, alignItems: 'center' },
  buttonBuy: { backgroundColor: '#ffd23f' },
  buttonOwned: { backgroundColor: 'rgba(255,255,255,0.16)' },
  buttonEquipped: { backgroundColor: 'rgba(46,230,255,0.25)' },
  buttonDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  buttonText: { color: '#1a1a1a', fontWeight: '800', fontSize: 12 },
  buttonTextLight: { color: '#fff', fontWeight: '800', fontSize: 12 },
  buttonTextDisabled: { color: 'rgba(255,255,255,0.4)', fontWeight: '800', fontSize: 12 },
  buttonTextEquipped: { color: '#2ee6ff', fontWeight: '800', fontSize: 12 },
});
