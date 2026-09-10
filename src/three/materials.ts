import * as THREE from 'three';
import { fbm, valueNoise } from './noise';
import { SkinDef } from '../types';

const TEXTURE_SIZE = 128;

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Bark: lengthwise ridges and fissures, with darker crevices and lighter
 * weathered ridges. `u` runs around the branch, `v` along it.
 */
function barkPixel(u: number, v: number, seed: number) {
  const fissure = valueNoise(u * 7, v * 1.4, seed);
  const ridge = Math.abs(fissure - 0.5) * 2;
  const grain = fbm(u * 14, v * 42, seed + 17, 4);
  const mottle = fbm(u * 4, v * 6, seed + 53, 3);
  const shade = mix(0.62, 1.35, ridge) * mix(0.85, 1.15, grain) * mix(0.9, 1.12, mottle);
  return shade;
}

function ringPixel(u: number, v: number, seed: number) {
  // Concentric growth rings for the cut ends.
  const cx = u - 0.5;
  const cy = v - 0.5;
  const r = Math.sqrt(cx * cx + cy * cy);
  const rings = Math.sin(r * 78 + fbm(u * 5, v * 5, seed, 2) * 3.5) * 0.5 + 0.5;
  return mix(0.82, 1.2, rings) * mix(0.94, 1.06, fbm(u * 20, v * 20, seed + 3, 3));
}

function buildTexture(
  color: THREE.Color,
  shadeFn: (u: number, v: number, seed: number) => number,
  seed: number
): THREE.DataTexture {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;
      const shade = shadeFn(u, v, seed);
      const i = (y * TEXTURE_SIZE + x) * 4;
      data[i] = Math.min(255, Math.max(0, color.r * 255 * shade));
      data[i + 1] = Math.min(255, Math.max(0, color.g * 255 * shade));
      data[i + 2] = Math.min(255, Math.max(0, color.b * 255 * shade));
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export interface SkinMaterials {
  surface: THREE.MeshStandardMaterial;
  ends: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createSkinMaterials(skin: SkinDef): SkinMaterials {
  const surfaceColor = new THREE.Color(skin.surfaceColor);
  const endColor = new THREE.Color(skin.endColor);
  const textures: THREE.Texture[] = [];

  const surface = new THREE.MeshStandardMaterial({
    color: skin.textured ? 0xffffff : surfaceColor,
    roughness: skin.roughness,
    metalness: skin.metalness,
    emissive: new THREE.Color(skin.emissive ?? 0x000000),
    emissiveIntensity: skin.emissiveIntensity ?? 0,
  });
  if (skin.textured) {
    const map = buildTexture(surfaceColor, barkPixel, skin.textureSeed ?? 7);
    surface.map = map;
    // Glow through the bark rather than over it, so crevices stay dark and the
    // branch keeps its shape instead of flattening into a solid colour.
    surface.emissiveMap = map;
    textures.push(map);
  }

  const ends = new THREE.MeshStandardMaterial({
    color: skin.textured ? 0xffffff : endColor,
    roughness: Math.min(1, skin.roughness + 0.1),
    metalness: skin.metalness * 0.6,
    emissive: new THREE.Color(skin.emissive ?? 0x000000),
    emissiveIntensity: (skin.emissiveIntensity ?? 0) * 0.6,
  });
  if (skin.textured) {
    const map = buildTexture(endColor, ringPixel, (skin.textureSeed ?? 7) + 5);
    ends.map = map;
    textures.push(map);
  }

  return {
    surface,
    ends,
    dispose: () => {
      surface.dispose();
      ends.dispose();
      textures.forEach((t) => t.dispose());
    },
  };
}

/** Soft radial blob used as a contact shadow on the ground. */
export function createShadowTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const alpha = Math.pow(1 - d, 2.2);
      const i = (y * size + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}
