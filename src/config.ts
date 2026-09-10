import { SkinDef, UpgradeDef } from './types';

export const SKINS: SkinDef[] = [
  {
    id: 'wood',
    name: 'Bâton en bois',
    description: 'Le classique. Simple, fiable, gratuit.',
    cost: 0,
    colors: ['#8a5a2b', '#c98a4b'],
    length: 260,
    width: 16,
    sound: require('../assets/sounds/wood.wav'),
  },
  {
    id: 'steel',
    name: 'Bâton en acier',
    description: 'Un sifflement plus net, avec un léger tintement métallique.',
    cost: 250,
    colors: ['#8d97a0', '#e6ecf0'],
    length: 260,
    width: 14,
    sound: require('../assets/sounds/steel.wav'),
  },
  {
    id: 'fire',
    name: 'Bâton de feu',
    description: "Crépite dans l'air à chaque mouvement.",
    cost: 1000,
    colors: ['#ff5f1f', '#ffd23f'],
    glow: 'rgba(255,95,31,0.55)',
    length: 250,
    width: 18,
    sound: require('../assets/sounds/fire.wav'),
  },
  {
    id: 'laser',
    name: 'Sabre laser',
    description: 'Un zap futuriste qui glisse en fréquence.',
    cost: 5000,
    colors: ['#2ee6ff', '#7a5cff'],
    glow: 'rgba(46,230,255,0.65)',
    length: 280,
    width: 10,
    sound: require('../assets/sounds/laser.wav'),
  },
  {
    id: 'rainbow',
    name: 'Bâton arc-en-ciel',
    description: 'Un carillon magique scintillant.',
    cost: 20000,
    colors: ['#ff5fa2', '#5fd0ff'],
    glow: 'rgba(255,255,255,0.5)',
    length: 260,
    width: 16,
    sound: require('../assets/sounds/rainbow.wav'),
  },
];

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'grip',
    name: 'Poignée renforcée',
    description: '+1 point par mouvement',
    baseCost: 15,
    costGrowth: 1.15,
    maxLevel: 100,
    kind: 'flat',
    value: 1,
  },
  {
    id: 'titanium',
    name: 'Alliage de titane',
    description: '+5 points par mouvement',
    baseCost: 150,
    costGrowth: 1.16,
    maxLevel: 100,
    kind: 'flat',
    value: 5,
  },
  {
    id: 'wind',
    name: 'Souffle du vent',
    description: 'x1.5 sur tous les gains',
    baseCost: 800,
    costGrowth: 1.9,
    maxLevel: 10,
    kind: 'mult',
    value: 1.5,
  },
  {
    id: 'dragon',
    name: 'Essence de dragon',
    description: '+50 points par mouvement',
    baseCost: 6000,
    costGrowth: 1.18,
    maxLevel: 100,
    kind: 'flat',
    value: 50,
  },
];

export const CLICK_SOUND = require('../assets/sounds/click.wav');

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}

export function pointsPerSwing(upgrades: Record<string, number>): number {
  let flat = 1;
  let mult = 1;
  for (const def of UPGRADES) {
    const level = upgrades[def.id] ?? 0;
    if (def.kind === 'flat') flat += def.value * level;
    else mult *= Math.pow(def.value, level);
  }
  return flat * mult;
}
