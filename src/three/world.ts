import * as THREE from 'three';
import { BRANCH_PRESET, BranchOptions, ROD_PRESET, createBranchGeometry, createStubs } from './geometry';
import { createShadowTexture, createSkinMaterials, SkinMaterials } from './materials';
import { SkinDef } from '../types';

export interface WorldEvents {
  /** A stroke of the stick through the air: shaking, waving or swinging. */
  onSwing: (intensity: number, screen: { x: number; y: number }) => void;
  /** The stick hit the ground or a wall. */
  onImpact: (strength: number) => void;
  /** A thrown stick came back to rest, after `turns` full rotations in the air. */
  onCatch: (turns: number, screen: { x: number; y: number }) => void;
}

const MASS = 1;
const GRAVITY = -9.2;
const RESTITUTION = 0.34;
const FRICTION = 0.34;
const HAND_STIFFNESS = 340;
const HAND_DAMPING = 26;
const CONTACT_SAMPLES = 9;

// A stroke fires a whoosh when the tip speed rises past HIGH, and rearms once
// it drops below LOW. Shaking therefore fires exactly once per stroke.
const SWING_SPEED_HIGH = 3.0;
const SWING_SPEED_LOW = 1.9;

/** Inward normals of the invisible box the stick lives in: floor, ceiling, sides, front/back. */
const FACE_NORMALS = [
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

export class BatonWorld {
  private readonly gl: WebGL2RenderingContext & { endFrameEXP?: () => void };
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly stick = new THREE.Group();
  private readonly shadow: THREE.Mesh;
  private readonly events: WorldEvents;

  private materials: SkinMaterials | null = null;
  private geometries: THREE.BufferGeometry[] = [];

  private width = 1;
  private height = 1;

  // Rigid body state.
  private readonly position = new THREE.Vector3(0, 0, 0);
  private readonly velocity = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly angularVelocity = new THREE.Vector3();
  private inertia = 0.5;
  private halfLength = 1.2;
  private radius = 0.06;

  // Interaction state.
  private held = false;
  private readonly handTarget = new THREE.Vector3();
  private readonly gripLocal = new THREE.Vector3();
  private swingArmed = true;
  private swingCooldown = 0;
  private readonly prevTipDirection = new THREE.Vector3();
  private airborne = false;
  private airRotation = 0;
  private airWhooshAt = 0;
  private restTimer = 0;

  private bounds = { minX: -3, maxX: 3, minY: -2, maxY: 2, minZ: -1.1, maxZ: 1.1 };

  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly raycaster = new THREE.Raycaster();

  constructor(gl: WebGL2RenderingContext & { endFrameEXP?: () => void }, events: WorldEvents) {
    this.gl = gl;
    this.events = events;

    const canvas =
      (gl as any).canvas ??
      ({
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        clientWidth: gl.drawingBufferWidth,
        clientHeight: gl.drawingBufferHeight,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => gl,
      } as any);

    this.renderer = new THREE.WebGLRenderer({ canvas, context: gl as any, antialias: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x12141c, 1);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    this.camera.position.set(0, 0.3, 5.0);
    this.camera.lookAt(0, -0.15, 0);

    this.scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x3a2616, 1.5));
    const key = new THREE.DirectionalLight(0xfff2e0, 4.2);
    key.position.set(-3, 4.5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fbcff, 2.6);
    rim.position.set(3.5, 1.5, -3);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffd7a0, 1.1);
    fill.position.set(1, -2.5, 2);
    this.scene.add(fill);

    const shadowTexture = createShadowTexture();
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.5 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    this.scene.add(this.stick);
  }

  /** Screen size in layout points, used for pointer mapping and label placement. */
  setCssSize(cssWidth: number, cssHeight: number) {
    this.width = cssWidth;
    this.height = cssHeight;
  }

  setSize(drawWidth: number, drawHeight: number, cssWidth: number, cssHeight: number) {
    this.setCssSize(cssWidth, cssHeight);
    this.renderer.setSize(drawWidth, drawHeight, false);
    this.camera.aspect = drawWidth / drawHeight;
    this.camera.updateProjectionMatrix();
    this.updateBounds();
  }

  /** The box the stick lives in, sized so it stays on screen at any depth. */
  private updateBounds() {
    const corner = this.ndcToWorld(1, 1);
    const margin = this.radius + 0.08;
    const maxZ = 1.1;
    // The frustum is narrowest at the depth closest to the camera, so measure
    // there: a box that fits at maxZ fits at every depth behind it too.
    const shrink = (this.camera.position.z - maxZ) / this.camera.position.z;
    const halfWidth = Math.abs(corner.x) * shrink;
    const halfHeight = Math.abs(corner.y) * shrink;
    this.bounds = {
      minX: -halfWidth + margin,
      maxX: halfWidth - margin,
      // The floor sits above the bottom edge so a resting stick stays clear of
      // the on-screen labels instead of hugging the very bottom of the screen.
      minY: -halfHeight + margin + halfHeight * 0.28,
      maxY: halfHeight - margin,
      minZ: -1.1,
      maxZ,
    };
  }

  setSkin(skin: SkinDef) {
    this.clearStick();

    const preset: BranchOptions = { ...(skin.shape === 'rod' ? ROD_PRESET : BRANCH_PRESET), seed: skin.textureSeed ?? 7 };
    this.materials = createSkinMaterials(skin);
    const geometry = createBranchGeometry(preset);
    this.geometries.push(geometry);

    const mesh = new THREE.Mesh(geometry, [this.materials.surface, this.materials.ends]);
    this.stick.add(mesh);

    for (const stub of createStubs(preset)) {
      this.geometries.push(stub.geometry);
      const stubMesh = new THREE.Mesh(stub.geometry, this.materials.surface);
      stubMesh.position.copy(stub.position);
      stubMesh.quaternion.copy(stub.quaternion);
      this.stick.add(stubMesh);
    }

    this.halfLength = preset.length / 2;
    this.radius = preset.radius;
    this.inertia = (MASS * preset.length * preset.length) / 12;
    this.updateBounds();

    // Drop the stick in at a natural angle rather than perfectly axis-aligned.
    this.position.set(0, 0.7, 0);
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.quaternion.setFromEuler(new THREE.Euler(0.3, 0.25, 0.32));
    this.held = false;
    this.airborne = false;
  }

  private clearStick() {
    for (const child of [...this.stick.children]) this.stick.remove(child);
    this.geometries.forEach((g) => g.dispose());
    this.geometries = [];
    this.materials?.dispose();
    this.materials = null;
  }

  private ndcToWorld(nx: number, ny: number): THREE.Vector3 {
    this.raycaster.setFromCamera({ x: nx, y: ny } as THREE.Vector2, this.camera);
    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, point);
    return point ?? new THREE.Vector3();
  }

  /** World position of a point at `t` (-1 tip .. +1 tip) along the stick. */
  private pointAt(t: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(t * this.halfLength, 0, 0).applyQuaternion(this.quaternion).add(this.position);
  }

  private velocityAt(point: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(point).sub(this.position).cross(this.angularVelocity).negate().add(this.velocity);
  }

  grab(nx: number, ny: number) {
    const hand = this.ndcToWorld(nx, ny);
    this.handTarget.copy(hand);

    // Grab the stick where it was actually touched, never right at a tip.
    const axis = this.tmpA.set(1, 0, 0).applyQuaternion(this.quaternion);
    const toHand = this.tmpB.copy(hand).sub(this.position);
    const along = THREE.MathUtils.clamp(toHand.dot(axis), -this.halfLength * 0.82, this.halfLength * 0.82);
    // A hand never grips exactly through the axis: the small offset is what
    // makes waving produce genuine three-axis tumbling rather than flat spin.
    this.gripLocal.set(along, 0, this.radius * 0.6);

    this.held = true;
    this.airborne = false;
    this.restTimer = 0;
  }

  move(nx: number, ny: number) {
    if (!this.held) return;
    this.handTarget.copy(this.ndcToWorld(nx, ny));
  }

  release() {
    if (!this.held) return;
    this.held = false;
    const speed = this.velocity.length();
    if (speed > 1.2) {
      this.airborne = true;
      this.airRotation = 0;
      this.airWhooshAt = 0;
      // Push it slightly into the scene and add a little off-plane tumble so a
      // throw reads as three-dimensional rather than a flat spin.
      this.velocity.z -= Math.min(2.2, speed * 0.12);
      this.angularVelocity.x += (Math.random() - 0.5) * speed * 0.55;
      this.angularVelocity.y += (Math.random() - 0.5) * speed * 0.55;
    }
  }

  update(dt: number) {
    const step = Math.min(dt, 1 / 30);

    if (this.held) {
      this.applyHandForces(step);
    }

    this.velocity.y += GRAVITY * step;
    this.velocity.multiplyScalar(Math.exp(-0.12 * step));
    this.angularVelocity.multiplyScalar(Math.exp(-(this.held ? 2.6 : 0.35) * step));

    this.position.addScaledVector(this.velocity, step);
    this.integrateRotation(step);
    this.resolveContacts(step);

    this.trackSwings(step);
    this.updateTransforms();
  }

  private applyHandForces(dt: number) {
    const grip = this.tmpA.copy(this.gripLocal).applyQuaternion(this.quaternion).add(this.position);
    const gripVelocity = this.velocityAt(grip, this.tmpB);
    // Critically damped spring pulling the grip towards the finger. Because the
    // grip is off the centre of mass, the same force also swings the stick.
    const force = this.tmpC
      .copy(this.handTarget)
      .sub(grip)
      .multiplyScalar(HAND_STIFFNESS)
      .addScaledVector(gripVelocity, -HAND_DAMPING);

    this.velocity.addScaledVector(force, (1 / MASS) * dt);

    const r = grip.sub(this.position);
    const torque = r.cross(force);
    this.angularVelocity.addScaledVector(torque, (1 / this.inertia) * dt);
    // Gravity acts at the centre of mass, so the far end naturally hangs down.
  }

  private integrateRotation(dt: number) {
    const w = this.angularVelocity;
    const spin = new THREE.Quaternion(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0).multiply(this.quaternion);
    this.quaternion.set(
      this.quaternion.x + spin.x,
      this.quaternion.y + spin.y,
      this.quaternion.z + spin.z,
      this.quaternion.w + spin.w
    );
    this.quaternion.normalize();
  }

  private resolveContacts(dt: number) {
    let strongest = 0;
    const point = new THREE.Vector3();
    const b = this.bounds;
    const r = this.radius;

    for (let i = 0; i < CONTACT_SAMPLES; i++) {
      const t = (i / (CONTACT_SAMPLES - 1)) * 2 - 1;
      this.pointAt(t, point);

      const depths = [
        point.y - r - b.minY,
        b.maxY - r - point.y,
        point.x - r - b.minX,
        b.maxX - r - point.x,
        point.z - r - b.minZ,
        b.maxZ - r - point.z,
      ];

      for (let f = 0; f < FACE_NORMALS.length; f++) {
        const depth = depths[f];
        if (depth >= 0) continue;
        const n = FACE_NORMALS[f];
        this.position.addScaledVector(n, -depth * 0.6);
        const impact = this.applyContactImpulse(point, n);
        strongest = Math.max(strongest, impact);
      }
    }

    if (strongest > 1.4) {
      this.events.onImpact(Math.min(1, strongest / 9));
    }

    // Let a resting stick actually come to rest instead of jittering forever.
    const energy = this.velocity.length() + this.angularVelocity.length();
    if (!this.held && energy < 0.85) {
      this.restTimer += dt;
      this.velocity.multiplyScalar(Math.exp(-6 * dt));
      this.angularVelocity.multiplyScalar(Math.exp(-6 * dt));
      if (this.airborne && this.restTimer > 0.25) this.finishThrow();
    } else {
      this.restTimer = 0;
    }
  }

  private applyContactImpulse(point: THREE.Vector3, n: THREE.Vector3): number {
    const r = new THREE.Vector3().copy(point).sub(this.position);
    const pointVelocity = new THREE.Vector3().copy(r).cross(this.angularVelocity).negate().add(this.velocity);
    const vn = pointVelocity.dot(n);
    if (vn >= 0) return 0;

    const rn = new THREE.Vector3().copy(r).cross(n);
    const denom = 1 / MASS + rn.dot(rn) / this.inertia;
    const j = (-(1 + RESTITUTION) * vn) / denom;

    this.velocity.addScaledVector(n, j / MASS);
    this.angularVelocity.addScaledVector(new THREE.Vector3().copy(r).cross(n).multiplyScalar(j), 1 / this.inertia);

    const tangent = new THREE.Vector3().copy(pointVelocity).addScaledVector(n, -vn);
    const tangentSpeed = tangent.length();
    if (tangentSpeed > 1e-4) {
      tangent.multiplyScalar(-1 / tangentSpeed);
      const rt = new THREE.Vector3().copy(r).cross(tangent);
      const denomT = 1 / MASS + rt.dot(rt) / this.inertia;
      const jt = THREE.MathUtils.clamp(tangentSpeed / denomT, 0, FRICTION * j);
      this.velocity.addScaledVector(tangent, jt / MASS);
      this.angularVelocity.addScaledVector(rt.multiplyScalar(jt), 1 / this.inertia);
    }

    return -vn;
  }

  private trackSwings(dt: number) {
    this.swingCooldown = Math.max(0, this.swingCooldown - dt);
    const tip = this.pointAt(1, this.tmpA);
    const tipVelocity = this.velocityAt(tip, this.tmpB);
    const tipSpeed = tipVelocity.length();

    if (this.held) {
      const direction = this.tmpC.copy(tipVelocity).divideScalar(tipSpeed || 1);
      // Two ways to count a stroke: a lone sweep crossing the speed threshold,
      // or the tip whipping back the other way, which is what shaking is.
      const reversed =
        tipSpeed > SWING_SPEED_LOW && this.prevTipDirection.lengthSq() > 0 && direction.dot(this.prevTipDirection) < -0.15;
      if (tipSpeed < SWING_SPEED_LOW) this.swingArmed = true;

      if (this.swingCooldown === 0 && (reversed || (this.swingArmed && tipSpeed > SWING_SPEED_HIGH))) {
        this.swingArmed = false;
        this.swingCooldown = 0.08;
        const intensity = THREE.MathUtils.clamp(tipSpeed / SWING_SPEED_HIGH, 1, 4);
        this.events.onSwing(intensity, this.projectToScreen(tip));
      }
      if (tipSpeed > 0.5) this.prevTipDirection.copy(direction);
      return;
    }
    this.prevTipDirection.set(0, 0, 0);

    if (this.airborne) {
      this.airRotation += this.angularVelocity.length() * dt;
      if (this.airRotation - this.airWhooshAt > Math.PI * 2) {
        this.airWhooshAt = this.airRotation;
        const intensity = THREE.MathUtils.clamp(this.angularVelocity.length() / 6, 0.7, 3);
        this.events.onSwing(intensity, this.projectToScreen(tip));
      }
    }
  }

  private finishThrow() {
    const turns = this.airRotation / (Math.PI * 2);
    this.airborne = false;
    this.airRotation = 0;
    if (turns > 0.4) {
      this.events.onCatch(turns, this.projectToScreen(this.position));
    }
  }

  private updateTransforms() {
    this.stick.position.copy(this.position);
    this.stick.quaternion.copy(this.quaternion);

    // Contact shadow follows the stick and fades with height.
    const height = THREE.MathUtils.clamp(this.position.y - this.bounds.minY, 0, 3);
    const spread = 1 + height * 0.55;
    this.shadow.position.set(this.position.x, this.bounds.minY - this.radius + 0.005, this.position.z);
    this.shadow.scale.set(this.halfLength * 2.4 * spread, this.halfLength * 1.5 * spread, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.45 / (1 + height * 0.9);
  }

  projectToScreen(worldPoint: THREE.Vector3): { x: number; y: number } {
    const projected = new THREE.Vector3().copy(worldPoint).project(this.camera);
    return {
      x: (projected.x * 0.5 + 0.5) * this.width,
      y: (-projected.y * 0.5 + 0.5) * this.height,
    };
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.gl.endFrameEXP?.();
  }

  dispose() {
    this.clearStick();
    (this.shadow.material as THREE.MeshBasicMaterial).map?.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    this.renderer.dispose();
  }
}
