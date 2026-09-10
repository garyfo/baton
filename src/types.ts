export type SkinId = 'wood' | 'steel' | 'fire' | 'laser' | 'rainbow';

export interface SkinDef {
  id: SkinId;
  name: string;
  description: string;
  cost: number;
  /** Gradient used for the shop swatch. */
  colors: [string, string];
  sound: any;
  /** A gnarled branch, or a smooth manufactured rod. */
  shape: 'branch' | 'rod';
  surfaceColor: string;
  endColor: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
  /** Whether to generate procedural bark / growth-ring textures. */
  textured: boolean;
  textureSeed?: number;
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
