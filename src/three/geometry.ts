import * as THREE from 'three';
import { fbm, makeRandom, valueNoise } from './noise';

export interface BranchOptions {
  length: number;
  radius: number;
  /** How much thinner the tip is compared to the base, 0..1 */
  taper: number;
  /** Amplitude of the lengthwise bends */
  bend: number;
  /** Amplitude of the bark bumps (0 for a smooth rod) */
  gnarl: number;
  /** Number of swollen knots along the branch */
  knots: number;
  radialSegments: number;
  tubularSegments: number;
  seed: number;
}

export const BRANCH_PRESET: BranchOptions = {
  length: 2.4,
  radius: 0.075,
  taper: 0.42,
  bend: 0.085,
  gnarl: 0.13,
  knots: 3,
  radialSegments: 16,
  tubularSegments: 130,
  seed: 7,
};

export const ROD_PRESET: BranchOptions = {
  length: 2.4,
  radius: 0.05,
  taper: 0.12,
  bend: 0.01,
  gnarl: 0,
  knots: 0,
  radialSegments: 20,
  tubularSegments: 60,
  seed: 3,
};

interface Knot {
  at: number;
  width: number;
  height: number;
}

function buildKnots(options: BranchOptions): Knot[] {
  const rand = makeRandom(options.seed * 977 + 13);
  const knots: Knot[] = [];
  for (let i = 0; i < options.knots; i++) {
    knots.push({
      at: 0.12 + (0.76 * (i + 0.35 + rand() * 0.3)) / Math.max(1, options.knots),
      width: 0.03 + rand() * 0.035,
      height: 0.25 + rand() * 0.45,
    });
  }
  return knots;
}

/** Radius of the branch at normalized position t, before per-vertex bark noise. */
function radiusAt(t: number, options: BranchOptions, knots: Knot[]): number {
  let r = options.radius * (1 - options.taper * t);
  for (const knot of knots) {
    const d = (t - knot.at) / knot.width;
    r += options.radius * knot.height * Math.exp(-d * d);
  }
  return r;
}

function buildCurve(options: BranchOptions): THREE.CatmullRomCurve3 {
  const rand = makeRandom(options.seed * 131 + 5);
  const points: THREE.Vector3[] = [];
  const controlCount = 7;
  const phaseY = rand() * Math.PI * 2;
  const phaseZ = rand() * Math.PI * 2;
  for (let i = 0; i < controlCount; i++) {
    const t = i / (controlCount - 1);
    const x = (t - 0.5) * options.length;
    // Two sine layers plus jitter: a natural, non-repeating curve rather than a bow.
    const y =
      Math.sin(t * 2.1 + phaseY) * options.bend +
      Math.sin(t * 5.3 + phaseY * 1.7) * options.bend * 0.35 +
      (rand() - 0.5) * options.bend * 0.3;
    const z =
      Math.sin(t * 1.7 + phaseZ) * options.bend * 0.8 +
      Math.sin(t * 4.1 + phaseZ * 1.3) * options.bend * 0.3 +
      (rand() - 0.5) * options.bend * 0.3;
    points.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
}

/**
 * Builds a closed branch mesh by sweeping rings along a bent curve.
 * Group 0 is the bark surface, group 1 the two cut ends (pale heartwood).
 */
export function createBranchGeometry(options: BranchOptions): THREE.BufferGeometry {
  const { radialSegments, tubularSegments } = options;
  const knots = buildKnots(options);
  const curve = buildCurve(options);
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const point = new THREE.Vector3();
  const vertex = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, point);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const baseRadius = radiusAt(t, options, knots);

    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const angle = v * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      // Bark relief: ridges running lengthwise plus coarse mottling.
      let bump = 0;
      if (options.gnarl > 0) {
        const ridges = valueNoise(v * 9, t * 3.5, options.seed) - 0.5;
        const coarse = fbm(v * 5, t * 14, options.seed + 91, 3) - 0.5;
        bump = (ridges * 0.65 + coarse * 0.45) * options.gnarl;
      }
      const radius = baseRadius * (1 + bump);

      vertex.copy(point);
      vertex.x += radius * (cos * normal.x + sin * binormal.x);
      vertex.y += radius * (cos * normal.y + sin * binormal.y);
      vertex.z += radius * (cos * normal.z + sin * binormal.z);

      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(v * 2, t * 5);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const sideIndexCount = indices.length;

  // Cut ends: a fan around the centre of the first and last ring.
  for (const end of [0, 1]) {
    const ringStart = end === 0 ? 0 : tubularSegments * (radialSegments + 1);
    curve.getPointAt(end, point);
    const centerIndex = positions.length / 3;
    positions.push(point.x, point.y, point.z);
    uvs.push(0.5, 0.5);
    for (let j = 0; j < radialSegments; j++) {
      const a = ringStart + j;
      const b = ringStart + j + 1;
      if (end === 0) indices.push(centerIndex, a, b);
      else indices.push(centerIndex, b, a);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.addGroup(0, sideIndexCount, 0);
  geometry.addGroup(sideIndexCount, indices.length - sideIndexCount, 1);
  geometry.computeVertexNormals();
  return geometry;
}

export interface Stub {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/** Snapped-off twigs, the detail that reads as "this came off a tree". */
export function createStubs(options: BranchOptions): Stub[] {
  if (options.knots === 0) return [];
  const rand = makeRandom(options.seed * 37 + 91);
  const knots = buildKnots(options);
  const curve = buildCurve(options);
  const stubs: Stub[] = [];

  for (const knot of knots) {
    if (rand() < 0.25) continue;
    const t = knot.at;
    const radius = radiusAt(t, options, knots);
    const length = radius * (2.2 + rand() * 2.6);
    const geometry = new THREE.CylinderGeometry(radius * 0.32, radius * 0.72, length, 8, 1, false);
    // Cylinders are built along +Y; move the body so it grows out of the branch.
    geometry.translate(0, length * 0.42, 0);

    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const angle = rand() * Math.PI * 2;
    const side = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle));
    const outward = side.projectOnPlane(tangent).normalize();
    // Lean the stub towards the tip, the way a twig grows.
    const direction = outward.multiplyScalar(0.8).addScaledVector(tangent, 0.55 + rand() * 0.3).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

    stubs.push({ geometry, position: point.clone(), quaternion });
  }
  return stubs;
}
