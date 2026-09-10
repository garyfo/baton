import { SkinDef, UpgradeDef } from './types';

export const SKINS: SkinDef[] = [
  {
    id: 'wood',
    name: 'Branche de chêne',
    description: 'Ramassée au pied d’un arbre. Écorce, nœuds et brindilles cassées.',
    cost: 0,
    colors: ['#6b4426', '#a97845'],
    sound: require('../assets/sounds/wood.wav'),
    shape: 'branch',
    surfaceColor: '#a4763f',
    endColor: '#e6c493',
    roughness: 0.92,
    metalness: 0.02,
    textured: true,
    textureSeed: 7,
  },
  {
    id: 'steel',
    name: 'Barre en acier',
    description: 'Forgée et polie. Un sifflement net, avec un tintement métallique.',
    cost: 250,
    colors: ['#8d97a0', '#e6ecf0'],
    sound: require('../assets/sounds/steel.wav'),
    shape: 'rod',
    surfaceColor: '#b9c2cb',
    endColor: '#8b949d',
    roughness: 0.24,
    metalness: 0.95,
    textured: false,
    textureSeed: 3,
  },
  {
    id: 'fire',
    name: 'Branche ardente',
    description: 'Du bois calciné qui rougeoie et crépite à chaque mouvement.',
    cost: 1000,
    colors: ['#ff5f1f', '#ffd23f'],
    sound: require('../assets/sounds/fire.wav'),
    shape: 'branch',
    surfaceColor: '#3a2118',
    endColor: '#ff9d3f',
    roughness: 0.78,
    metalness: 0.05,
    emissive: '#ff5a18',
    emissiveIntensity: 1.1,
    textured: true,
    textureSeed: 21,
  },
  {
    id: 'laser',
    name: 'Sabre laser',
    description: 'Une lame d’énergie contenue. Un zap futuriste qui glisse en fréquence.',
    cost: 5000,
    colors: ['#2ee6ff', '#7a5cff'],
    sound: require('../assets/sounds/laser.wav'),
    shape: 'rod',
    surfaceColor: '#2ee6ff',
    endColor: '#d9faff',
    roughness: 0.35,
    metalness: 0.2,
    emissive: '#28d8ff',
    emissiveIntensity: 1.2,
    textured: false,
    textureSeed: 11,
  },
  {
    id: 'rainbow',
    name: 'Branche enchantée',
    description: 'Un bois irisé qui scintille et chante comme un carillon.',
    cost: 20000,
    colors: ['#ff5fa2', '#5fd0ff'],
    sound: require('../assets/sounds/rainbow.wav'),
    shape: 'branch',
    surfaceColor: '#c48ff0',
    endColor: '#ffe8ff',
    roughness: 0.42,
    metalness: 0.45,
    emissive: '#7b4dff',
    emissiveIntensity: 0.55,
    textured: true,
    textureSeed: 33,
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
export const IMPACT_SOUND = require('../assets/sounds/impact.wav');

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
