export type SkinId = 'wood' | 'steel' | 'fire' | 'laser' | 'rainbow';

export interface SkinDef {
  id: SkinId;
  name: string;
  description: string;
  cost: number;
  colors: [string, string];
  glow?: string;
  length: number;
  width: number;
  sound: any;
}

export type UpgradeId = 'grip' | 'titanium' | 'wind' | 'dragon';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  kind: 'flat' | 'mult';
  value: number;
}

export interface GameState {
  points: number;
  totalSwings: number;
  ownedSkins: SkinId[];
  equippedSkin: SkinId;
  upgrades: Record<UpgradeId, number>;
  hydrated: boolean;
}
