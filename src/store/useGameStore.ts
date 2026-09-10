import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SKINS, UPGRADES, pointsPerSwing, upgradeCost } from '../config';
import { GameState, SkinId, UpgradeId } from '../types';

const STORAGE_KEY = 'baton-simulator-save-v1';

const defaultState: GameState = {
  points: 0,
  totalSwings: 0,
  ownedSkins: ['wood'],
  equippedSkin: 'wood',
  upgrades: { grip: 0, titanium: 0, wind: 0, dragon: 0 },
  hydrated: false,
};

export function useGameStore() {
  const [state, setState] = useState<GameState>(defaultState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setState((s) => ({ ...s, ...saved, hydrated: true }));
        } else {
          setState((s) => ({ ...s, hydrated: true }));
        }
      } catch {
        setState((s) => ({ ...s, hydrated: true }));
      }
    })();
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const { hydrated, ...toSave } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [state]);

  const addSwing = useCallback((intensityFactor: number) => {
    const gain = pointsPerSwing(stateRef.current.upgrades) * intensityFactor;
    setState((s) => ({ ...s, points: s.points + gain, totalSwings: s.totalSwings + 1 }));
    return gain;
  }, []);

  const buySkin = useCallback((id: SkinId) => {
    const def = SKINS.find((sk) => sk.id === id);
    if (!def) return false;
    let bought = false;
    setState((s) => {
      if (s.ownedSkins.includes(id) || s.points < def.cost) return s;
      bought = true;
      return { ...s, points: s.points - def.cost, ownedSkins: [...s.ownedSkins, id] };
    });
    return bought;
  }, []);

  const equipSkin = useCallback((id: SkinId) => {
    setState((s) => (s.ownedSkins.includes(id) ? { ...s, equippedSkin: id } : s));
  }, []);

  const buyUpgrade = useCallback((id: UpgradeId) => {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    let bought = false;
    setState((s) => {
      const level = s.upgrades[id] ?? 0;
      if (level >= def.maxLevel) return s;
      const cost = upgradeCost(def, level);
      if (s.points < cost) return s;
      bought = true;
      return {
        ...s,
        points: s.points - cost,
        upgrades: { ...s.upgrades, [id]: level + 1 },
      };
    });
    return bought;
  }, []);

  return { state, addSwing, buySkin, equipSkin, buyUpgrade };
}
