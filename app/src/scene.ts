// three.js arena: Blender-built wizard and environment models (GLB), projectiles, particles, lane telegraphs.
// If a model fails to load the arena falls back to primitives so the game always runs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import wizardUrl from './assets/models/wizard.glb';
import castleUrl from './assets/models/arena.glb';
import forestUrl from './assets/models/forest.glb';
import caveUrl from './assets/models/cave.glb';
import sanctumUrl from './assets/models/sanctum.glb';
import { ENEMY_Z, LANE_X, PLAYER_LOOK, STAGE_THEME, TIERS, enemyLook, stageForLevel, type EnemyDef, type HatStyle, type StaffStyle, type StageId, type WizardLook } from '@wizard/shared';
import type { BattleEvent, Projectile } from '@wizard/shared';
import type { BattleLike } from './duel/view';
import { MATERIAL_TEXTURE, UNLIT_MATERIALS, texture } from './textures';

/** Internal render resolution relative to CSS pixels: low on purpose for the PS2 look. */
const RENDER_SCALE = 0.55;

/** Converts a glTF PBR material into a Gouraud-shaded, textured material (vertex lighting, like the PS2). */
function toLambert(src: THREE.Material, transparent: boolean): THREE.MeshLambertMaterial {
  const color = (src as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1);
  const kind = MATERIAL_TEXTURE[src.name];
  const m = new THREE.MeshLambertMaterial({ color: color.clone(), map: kind ? texture(kind) : null, transparent });
  m.name = src.name;
  return m;
}

/** Glowing materials (flames, lava, crystals) ignore lighting entirely. */
function toUnlit(src: THREE.Material): THREE.MeshBasicMaterial {
  const kind = MATERIAL_TEXTURE[src.name];
  const color = src.name === 'Flame' ? new THREE.Color('#ffb347') : new THREE.Color(1, 1, 1);
  const m = new THREE.MeshBasicMaterial({ color, map: kind ? texture(kind) : null });
  m.name = src.name;
  return m;
}

const HAT_NODES: Record<HatStyle, string> = {
  pointy: 'Hat_Pointy', hood: 'Hat_Hood', crown: 'Hat_Crown', horns: 'Hat_Horns', wide: 'Hat_Wide', turban: 'Hat_Turban',
  halo: 'Hat_Halo', helm: 'Hat_Helm', veil: 'Hat_Veil',
};
const STAFF_NODES: Record<StaffStyle, string> = {
  claw: 'Staff_Claw', crystal: 'Staff_Crystal', ring: 'Staff_Ring', blade: 'Staff_Blade', skull: 'Staff_Skull', leaf: 'Staff_Leaf',
  sun: 'Staff_Sun', hammer: 'Staff_Hammer', hourglass: 'Staff_Hourglass',
};

// ---- helpers ------------------------------------------------------------------
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const GLOW = glowTexture();
function col(hex: string): THREE.Color { return new THREE.Color(hex); }

// ---- model cache -------------------------------------------------------------------
let wizardModel: THREE.Group | null = null;
const stageModels: Partial<Record<StageId, THREE.Group | null>> = {};
let loadPromise: Promise<void> | null = null;
const STAGE_URLS: Record<StageId, string> = { castle: castleUrl, forest: forestUrl, cave: caveUrl, sanctum: sanctumUrl };

/** Loads the GLB models once; safe to call early (during the splash) and again later. */
export function preloadModels(): Promise<void> {
  if (loadPromise) return loadPromise;
  const loader = new GLTFLoader();
  const load = (url: string): Promise<THREE.Group | null> => new Promise(res => loader.load(url, g => res(g.scene), undefined, () => res(null)));
  const ids = Object.keys(STAGE_URLS) as StageId[];
  loadPromise = Promise.all([load(wizardUrl), ...ids.map(id => load(STAGE_URLS[id]))]).then(([w, ...stages]) => {
    wizardModel = w;
    ids.forEach((id, i) => { stageModels[id] = stages[i]; });
  });
  return loadPromise;
}

/** Stage light sprites (x, y, z in game units) and their glow colour. */
const STAGE_LIGHTS: Record<StageId, { pos: [number, number, number][]; color: string; size: number }> = {
  castle: { pos: [[-3.9, 2, 3], [3.9, 2, 3], [-3.9, 2, -9], [3.9, 2, -9], [-3.9, 2, -21], [3.9, 2, -21]], color: '#ffb060', size: 2.2 },
  forest: { pos: [[-3.4, 3, 3], [3.4, 3, 3], [-3.4, 3, -9], [3.4, 3, -9], [-3.4, 3, -21], [3.4, 3, -21]], color: '#ffe08a', size: 1.8 },
  cave: { pos: [[-6, 1.2, 0], [6, 1.2, 0], [-7, 1.2, -8], [7, 1.2, -8], [-6, 1.2, -16], [6, 1.2, -16], [0, 3.5, -25]], color: '#7df9ff', size: 3.6 },
  sanctum: { pos: [[-3.6, 2.3, 3], [3.6, 2.3, 3], [-3.6, 2.3, -9], [3.6, 2.3, -9], [-3.6, 2.3, -21], [3.6, 2.3, -21], [-6.6, 8.3, 1], [6.6, 8.3, 1], [-6.6, 8.3, -10], [6.6, 8.3, -10], [-6.6, 8.3, -21], [6.6, 8.3, -21]], color: '#ff7a2a', size: 2.6 },
};

// ---- particles ------------------------------------------------------------------
class Particles {
  readonly points: THREE.Points;
  private readonly max = 700;
  private pos: Float32Array;
  private colors: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private base: Float32Array;
  private grav: Float32Array;
  private cursor = 0;

  constructor() {
    const n = this.max;
    this.pos = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.base = new Float32Array(n * 3);
    this.grav = new Float32Array(n);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -100;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.28, map: GLOW, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  emit(p: THREE.Vector3, color: THREE.Color, count: number, speed: number, life: number, gravity = 0, spread = 0.1): void {
    for (let k = 0; k < count; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.pos[i * 3] = p.x + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread;
      this.vel[i * 3] = dir.x * sp; this.vel[i * 3 + 1] = dir.y * sp; this.vel[i * 3 + 2] = dir.z * sp;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
      this.base[i * 3] = color.r; this.base[i * 3 + 1] = color.g; this.base[i * 3 + 2] = color.b;
      this.grav[i] = gravity;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -100; this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.colors[i * 3] = this.base[i * 3] * f; this.colors[i * 3 + 1] = this.base[i * 3 + 1] * f; this.colors[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---- wizard -----------------------------------------------------------------------
type Std = THREE.MeshLambertMaterial;

class Wizard {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private staffPivot: THREE.Object3D = new THREE.Group();
  private mats: Record<string, Std> = {};
  private allMats: THREE.Material[] = [];
  private orbMat!: THREE.MeshBasicMaterial;
  private orbGlow!: THREE.Sprite;
  private shield: THREE.Mesh;
  private shieldWire: THREE.Mesh;
  private shieldMat: THREE.MeshBasicMaterial;
  private shieldWireMat: THREE.MeshBasicMaterial;
  private hatNodes: Partial<Record<HatStyle, THREE.Object3D>> = {};
  private staffNodes: Partial<Record<StaffStyle, THREE.Object3D>> = {};
  private beardNode: THREE.Object3D | null = null;
  private capeNode: THREE.Object3D | null = null;
  readonly orb = new THREE.Object3D();
  bob = Math.random() * 6;
  castT = 0;
  hold = false;
  hitT = 0;
  tilt = 0;
  deathT = -1;
  frozen = false;
  phased = false;
  x = 0;

  constructor(look: WizardLook, facing: 1 | -1) {
    if (wizardModel) this.buildFromModel(look); else this.buildPrimitive(look);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; this.group.add(shadow);

    this.shieldMat = new THREE.MeshBasicMaterial({ color: col('#6ea8ff'), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.shieldWireMat = new THREE.MeshBasicMaterial({ color: col('#bfe0ff'), transparent: true, opacity: 0, wireframe: true, depthWrite: false });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 10), this.shieldMat); this.shield.position.y = 1.5;
    this.shieldWire = new THREE.Mesh(new THREE.SphereGeometry(1.37, 10, 8), this.shieldWireMat); this.shieldWire.position.y = 1.5;
    this.group.add(this.shield, this.shieldWire);

    this.body.rotation.y = facing === 1 ? 0 : Math.PI;
    this.group.add(this.body);
  }

  private buildFromModel(look: WizardLook): void {
    const inst = wizardModel!.clone(true);
    const byName = new Map<string, Std>();
    inst.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.Material;
      let mat = byName.get(src.name);
      if (!mat) { mat = toLambert(src, true); byName.set(src.name, mat); }
      m.material = mat;
    });
    for (const [name, m] of byName) { this.mats[name] = m; this.allMats.push(m); }
    const orbNode = inst.getObjectByName('Orb') as THREE.Mesh | undefined;
    this.orbMat = new THREE.MeshBasicMaterial({ color: col(look.trim), transparent: true });
    if (orbNode) { orbNode.material = this.orbMat; this.allMats.push(this.orbMat); }
    this.staffPivot = inst.getObjectByName('ArmPivot') ?? new THREE.Group();
    for (const [style, node] of Object.entries(HAT_NODES) as [HatStyle, string][]) { const n = inst.getObjectByName(node); if (n) this.hatNodes[style] = n; }
    for (const [style, node] of Object.entries(STAFF_NODES) as [StaffStyle, string][]) { const n = inst.getObjectByName(node); if (n) this.staffNodes[style] = n; }
    this.beardNode = inst.getObjectByName('Beard') ?? null;
    this.capeNode = inst.getObjectByName('Cape') ?? null;
    this.orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: col(look.trim), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
    this.orbGlow.scale.set(1, 1, 1);
    if (orbNode) { orbNode.add(this.orb, this.orbGlow); }
    this.body.add(inst);
    this.setLook(look);
  }

  private buildPrimitive(look: WizardLook): void {
    const mk = (name: string, c: string): Std => { const m = new THREE.MeshLambertMaterial({ color: col(c), map: texture(MATERIAL_TEXTURE[name] ?? 'cloth') }); m.name = name; m.transparent = true; this.mats[name] = m; this.allMats.push(m); return m; };
    const robe = mk('Robe', look.robe), hat = mk('Hat', look.hat), trim = mk('Trim', look.trim), skin = mk('Skin', '#e8c39e'), wood = mk('Wood', '#6b4a2b');
    const b = this.body;
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = b): THREE.Mesh => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    add(new THREE.ConeGeometry(0.62, 1.75, 7), robe, 0, 0.87, 0);
    add(new THREE.SphereGeometry(0.28, 10, 8), skin, 0, 1.92, 0);
    add(new THREE.CylinderGeometry(0.64, 0.64, 0.06, 12), hat, 0, 2.12, 0);
    add(new THREE.ConeGeometry(0.42, 0.95, 7), hat, 0, 2.6, 0);
    add(new THREE.CylinderGeometry(0.36, 0.42, 0.12, 8), trim, 0, 1.15, 0);
    const piv = new THREE.Group(); piv.position.set(0.42, 1.5, 0); b.add(piv); this.staffPivot = piv;
    add(new THREE.CylinderGeometry(0.04, 0.05, 2.1, 6), wood, 0.28, -0.35, 0, piv);
    this.orbMat = new THREE.MeshBasicMaterial({ color: col(look.trim), transparent: true }); this.allMats.push(this.orbMat);
    const orb = add(new THREE.SphereGeometry(0.14, 8, 8), this.orbMat, 0.28, 0.75, 0, piv);
    this.orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: col(look.trim), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    orb.add(this.orb, this.orbGlow);
  }

  setLook(look: WizardLook): void {
    this.mats.Robe?.color.set(look.robe);
    this.mats.Cape?.color.set(look.hat);
    this.mats.Hat?.color.set(look.hat);
    this.mats.Trim?.color.set(look.trim);
    this.mats.Skin?.color.set(look.skin);
    this.orbMat.color.set(look.trim);
    (this.orbGlow.material as THREE.SpriteMaterial).color.set(look.trim);
    for (const [style, node] of Object.entries(this.hatNodes) as [HatStyle, THREE.Object3D][]) node.visible = style === look.hatStyle || (!this.hatNodes[look.hatStyle] && style === 'pointy');
    for (const [style, node] of Object.entries(this.staffNodes) as [StaffStyle, THREE.Object3D][]) node.visible = style === look.staffStyle || (!this.staffNodes[look.staffStyle] && style === 'claw');
    if (this.beardNode) this.beardNode.visible = look.beard;
    if (this.capeNode) this.capeNode.visible = look.cape;
  }

  reset(): void { this.deathT = -1; this.hitT = 0; this.castT = 0; this.hold = false; this.frozen = false; this.phased = false; this.tilt = 0; this.body.rotation.x = 0; this.group.position.y = 0; }

  orbWorld(target: THREE.Vector3): THREE.Vector3 { return this.orb.getWorldPosition(target); }

  setShield(amount: number, reflect: boolean): void {
    const on = amount > 0 || reflect;
    const target = on ? (reflect ? 0.45 : 0.22) : 0;
    this.shieldMat.opacity += (target - this.shieldMat.opacity) * 0.25;
    this.shieldWireMat.opacity += ((on ? 0.25 : 0) - this.shieldWireMat.opacity) * 0.25;
    this.shieldMat.color.set(reflect ? '#f2f7ff' : '#6ea8ff');
  }

  update(dt: number, time: number): void {
    this.bob += dt;
    this.group.position.x += (this.x - this.group.position.x) * Math.min(1, dt * 14);
    this.tilt *= Math.max(0, 1 - dt * 6);
    this.body.rotation.z = this.tilt;
    this.body.position.y = this.frozen ? 0 : Math.sin(this.bob * 2.2) * 0.04;

    if (this.castT > 0) this.castT = Math.max(0, this.castT - dt * 2.4);
    const raise = this.hold ? 1 : Math.sin(Math.min(1, this.castT) * Math.PI);
    this.staffPivot.rotation.x += (-1.15 * raise - this.staffPivot.rotation.x) * Math.min(1, dt * 16);
    const glow = 1 + raise * 0.9 + (this.hold ? Math.sin(time * 14) * 0.25 : 0);
    this.orbGlow.scale.set(glow, glow, 1);

    this.hitT = Math.max(0, this.hitT - dt * 3);
    const em = new THREE.Color();
    if (this.frozen) em.set('#3a8fd0'); else em.setRGB(this.hitT, this.hitT * 0.6, this.hitT * 0.6);
    for (const [name, m] of Object.entries(this.mats)) {
      const k = name === 'Robe' || name === 'Cape' ? 1 : name === 'Hat' ? 0.6 : 0.35;
      m.emissive.copy(em).multiplyScalar(k);
    }
    const op = this.phased ? 0.35 : 1;
    for (const m of this.allMats) m.opacity += (op - m.opacity) * Math.min(1, dt * 10);

    if (this.deathT >= 0) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 1.1);
      this.body.rotation.x = -k * k * 1.5;
      this.group.position.y = -k * 0.6;
    }
    this.shield.scale.setScalar(1 + Math.sin(time * 5) * 0.03);
    this.shieldWire.rotation.y = time * 0.6;
  }
}

// ---- sky ---------------------------------------------------------------------------
function makeSky(): { mesh: THREE.Mesh; top: THREE.Color; bottom: THREE.Color } {
  const top = col('#1b2140'), bottom = col('#3a3f6e');
  const mat = new THREE.ShaderMaterial({
    uniforms: { top: { value: top }, bottom: { value: bottom } },
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float vY; void main(){ float t = clamp(vY * 2.2 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), mat);
  return { mesh, top, bottom };
}

// ---- arena ---------------------------------------------------------------------------
interface ProjView { group: THREE.Group; p: Projectile; ring?: THREE.Mesh; last: THREE.Vector3 }

/**
 * The player's own wizard on a turntable, for the loadout screen: its own tiny scene, its own
 * renderer, and nothing in it but the hero, a floor disc and a light rig warm enough to read the
 * robe colour. Equipping something calls setLook and the model changes while it is being looked at,
 * which is the whole point of the screen.
 *
 * It keeps its own rAF loop, and that loop must be stopped when the screen is hidden — a phone will
 * happily render an invisible canvas until the battery is gone.
 */
export class WizardView {
  readonly ok: boolean;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private wizard!: Wizard;
  private turn = new THREE.Group();
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private time = 0;
  /** Where the turntable is being dragged to, and how fast it is drifting back to idle. */
  private spin = 0;
  private dragging = false;
  private dragFrom = 0;
  private dragSpin = 0;

  constructor(canvas: HTMLCanvasElement, look: WizardLook) {
    this.canvas = canvas;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
    } catch {
      this.ok = false;
      return;
    }
    this.ok = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * 0.75);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);

    // Brighter than the arena on purpose: this is a shop window, not a night battle.
    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x3a2f55, 0.85));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.15); key.position.set(3, 6, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8ab4ff, 0.7); rim.position.set(-4, 3, -4); this.scene.add(rim);

    // A disc to stand on, so the wizard is somewhere rather than floating.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 28),
      new THREE.MeshBasicMaterial({ color: col('#2c2492'), transparent: true, opacity: 0.85 }),
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.005; this.turn.add(disc);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.12, 28),
      new THREE.MeshBasicMaterial({ color: col('#ffcc33'), transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006; this.turn.add(ring);

    // facing 1 means the model looks down +Z, which is where the camera is.
    this.wizard = new Wizard(look, 1);
    this.turn.add(this.wizard.group);
    this.scene.add(this.turn);

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
  }

  private onDown = (e: PointerEvent): void => {
    this.dragging = true; this.dragFrom = e.clientX; this.dragSpin = this.spin;
    this.canvas.setPointerCapture(e.pointerId);
  };
  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.spin = this.dragSpin + (e.clientX - this.dragFrom) * 0.012;
  };
  private onUp = (): void => { this.dragging = false; };

  setLook(look: WizardLook): void { if (this.ok) this.wizard.setLook(look); }

  /** The staff comes up once, the way it does on a cast. Used when something is equipped. */
  flourish(): void { if (this.ok) this.wizard.castT = 1; }

  start(): void {
    if (!this.ok || this.raf) return;
    this.last = performance.now();
    const step = (now: number): void => {
      this.raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now; this.time += dt;
      this.resize();
      // Idle sway when nobody is holding it, and a slow drift back to front-on afterwards.
      if (!this.dragging) this.spin += (Math.sin(this.time * 0.55) * 0.38 - this.spin) * Math.min(1, dt * 1.2);
      this.turn.rotation.y = this.spin;
      this.wizard.update(dt, this.time);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; } }

  private resize(): void {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    if (this.canvas.width === Math.round(w * this.renderer.getPixelRatio())
      && this.canvas.height === Math.round(h * this.renderer.getPixelRatio())) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Pull back on a narrow box so the hat and the staff stay inside it.
    const back = this.camera.aspect < 1 ? (1 - this.camera.aspect) * 2.2 : 0;
    this.camera.position.set(0, 2.05, 5.2 + back);
    this.camera.lookAt(0, 1.45, 0);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.stop();
    if (!this.ok) return;
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.renderer.dispose();
  }
}

export class Arena {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly player: Wizard;
  readonly enemy: Wizard;
  private particles = new Particles();
  private projViews = new Map<number, ProjView>();
  private laneT: number[] = [0, 0, 0];
  private laneMat: THREE.MeshBasicMaterial[] = [];
  private portal: THREE.Mesh;
  private portalMat: THREE.MeshBasicMaterial;
  private torches: THREE.Sprite[] = [];
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sky: { mesh: THREE.Mesh; top: THREE.Color; bottom: THREE.Color };
  private bannerMat: Std | null = null;
  private env: THREE.Object3D | null = null;
  private stage: StageId | null = null;
  private fallbackFloor: THREE.Mesh;
  private moon: THREE.Sprite;
  private shake = 0;
  private time = 0;
  private tmp = new THREE.Vector3();
  private running = true;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * RENDER_SCALE);
    this.renderer.domElement.className = 'arena-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    this.camera.position.set(0, 6.2, 9.4);
    this.camera.lookAt(0, 0.8, -6.5);

    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x30281f, 0.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.0); this.sun.position.set(4, 10, 6); this.scene.add(this.sun);
    const rim = new THREE.DirectionalLight(0x8ab4ff, 0.5); rim.position.set(-4, 5, -10); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffb060, 0.45); fill.position.set(0, 2, 6); this.scene.add(fill);

    this.sky = makeSky();
    this.scene.add(this.sky.mesh);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: col('#e8ecff'), transparent: true, depthWrite: false, fog: false }));
    this.moon.position.set(-38, 48, -110); this.moon.scale.set(26, 26, 1); this.scene.add(this.moon);

    // Fallback floor, shown only when a stage model failed to load.
    this.fallbackFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 70), new THREE.MeshLambertMaterial({ color: col('#7a7a90'), map: texture('stone', 12) }));
    this.fallbackFloor.rotation.x = -Math.PI / 2; this.fallbackFloor.position.z = -12; this.fallbackFloor.visible = false; this.scene.add(this.fallbackFloor);
    this.setStage('castle');

    // Rune rings under each wizard.
    for (const z of [0, ENEMY_Z]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.03, z); this.scene.add(ring);
    }
    // Lane telegraph strips.
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({ color: col('#ff4040'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.35, -ENEMY_Z + 1), m);
      strip.rotation.x = -Math.PI / 2; strip.position.set(LANE_X[i], 0.04, ENEMY_Z / 2 + 0.5);
      this.scene.add(strip); this.laneMat.push(m);
    }
    // Magic portal in the castle gate.
    this.portalMat = new THREE.MeshBasicMaterial({ color: col('#8ab4ff'), transparent: true, opacity: 0.75 });
    this.portal = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.2, 8, 40), this.portalMat);
    this.portal.position.set(0, 3.4, ENEMY_Z - 12.5); this.scene.add(this.portal);
    const portalInner = new THREE.Mesh(new THREE.CircleGeometry(2.85, 40), new THREE.MeshBasicMaterial({ color: col('#0a0a1a'), transparent: true, opacity: 0.9 }));
    portalInner.position.copy(this.portal.position); this.scene.add(portalInner);

    this.player = new Wizard(PLAYER_LOOK, -1);
    this.enemy = new Wizard({ ...PLAYER_LOOK, robe: '#6a7fd8', hat: '#4a56b0', trim: '#e0e8ff' }, 1);
    this.enemy.group.position.set(0, 0, ENEMY_Z);
    this.scene.add(this.player.group, this.enemy.group, this.particles.points);

    this.setTheme({ sky: '#2438a0', fog: '#4a62c8', spell: '#8ab4ff', robe: '#6a7fd8' });
    this.resize();
  }

  /** Swaps the environment model and its light sprites. Models are converted to the PS2 materials once. */
  setStage(id: StageId): void {
    if (this.stage === id) return;
    this.stage = id;
    if (this.env) { this.scene.remove(this.env); this.env = null; }
    for (const t of this.torches) this.scene.remove(t);
    this.torches = [];
    this.bannerMat = null;
    const model = stageModels[id] ?? null;
    if (model) {
      if (!model.userData.converted) {
        const converted = new Map<string, THREE.Material>();
        model.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const src = m.material as THREE.Material;
          let mat = converted.get(src.name);
          if (!mat) {
            if (UNLIT_MATERIALS.has(src.name)) mat = toUnlit(src);
            else { const lam = toLambert(src, false); if (src.name === 'Banner') model.userData.bannerMat = lam; if (src.name.startsWith('Stone')) lam.color.multiplyScalar(0.95); mat = lam; }
            converted.set(src.name, mat);
          }
          m.material = mat;
        });
        model.userData.converted = true;
      }
      this.bannerMat = (model.userData.bannerMat as Std | undefined) ?? null;
      this.env = model;
      this.scene.add(model);
    }
    this.fallbackFloor.visible = !model;
    const lights = STAGE_LIGHTS[id];
    for (const [x, y, z] of lights.pos) {
      const t = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: col(lights.color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      t.position.set(x, y, z); t.scale.set(lights.size, lights.size, 1); this.scene.add(t); this.torches.push(t);
    }
  }

  setTheme(t: { sky: string; fog: string; spell: string; robe: string }): void {
    const over = this.stage ? STAGE_THEME[this.stage] : undefined;
    const sky = over?.sky ?? t.sky, fog = over?.fog ?? t.fog;
    this.scene.background = col(sky);
    this.scene.fog = new THREE.Fog(col(fog), this.stage === 'cave' ? 12 : 20, this.stage === 'cave' ? 45 : 70);
    this.sky.top.set(sky);
    this.sky.bottom.set(fog).lerp(col(t.spell), 0.35);
    this.portalMat.color.set(t.spell);
    this.hemi.color.set(t.spell).lerp(new THREE.Color(0xffffff), 0.4);
    this.hemi.groundColor.set(fog);
    this.hemi.intensity = this.stage === 'cave' ? 0.95 : 0.55;
    this.sun.color.set('#fff1d6').lerp(col(t.spell), 0.3);
    if (this.bannerMat) this.bannerMat.color.set(t.robe).lerp(col(t.spell), 0.25);
  }

  /** The hero's cosmetic hat and colours (chosen in settings). */
  setPlayerLook(look: WizardLook): void { this.player.setLook(look); }

  /** Two duellists in a chosen arena; the opponent is dressed from its own look. */
  setDuelLook(opponent: WizardLook, stage: StageId, tierIndex = 0): void {
    this.enemy.setLook(opponent);
    this.enemy.group.scale.setScalar(1);
    this.enemy.reset();
    this.player.reset();
    this.setStage(stage);
    this.setTheme(TIERS[Math.max(0, Math.min(TIERS.length - 1, tierIndex))]);
    for (const v of this.projViews.values()) this.scene.remove(v.group);
    this.projViews.clear();
    this.laneT = [0, 0, 0];
  }

  /** Dresses the enemy for this level, picks the stage and applies the palette. */
  setEnemyLook(def: EnemyDef, boss: boolean): void {
    this.enemy.setLook(enemyLook(def));
    this.enemy.group.scale.setScalar(boss ? 1.35 : 1);
    this.enemy.reset();
    this.player.reset();
    this.setStage(stageForLevel(def.level, boss));
    this.setTheme(def.tier);
    for (const v of this.projViews.values()) this.scene.remove(v.group);
    this.projViews.clear();
    this.laneT = [0, 0, 0];
  }

  resize(): void {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const vfov = (2 * Math.atan(Math.tan((21 * Math.PI) / 360) / aspect) * 180) / Math.PI;
    this.camera.fov = Math.min(94, Math.max(44, vfov));
    this.camera.aspect = aspect;
    const back = aspect < 0.7 ? (0.7 - aspect) * 4 : 0;
    this.camera.position.set(0, 6.2 + back * 0.4, 9.4 + back);
    this.camera.lookAt(0, 0.8, -6.5);
    this.camera.updateProjectionMatrix();
  }

  project(v: THREE.Vector3): { x: number; y: number } {
    const p = this.tmp.copy(v).project(this.camera);
    return { x: ((p.x + 1) / 2) * this.container.clientWidth, y: ((1 - p.y) / 2) * this.container.clientHeight };
  }

  playerAnchor(): THREE.Vector3 { return new THREE.Vector3(this.player.group.position.x, 2.4, 0); }
  enemyAnchor(): THREE.Vector3 { return new THREE.Vector3(this.enemy.group.position.x, 3.0 * this.enemy.group.scale.x, ENEMY_Z); }

  private spawnProjectile(p: Projectile): void {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 10, 8), new THREE.MeshBasicMaterial({ color: col(p.color) }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: col(p.color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(p.radius * 7, p.radius * 7, 1);
    g.add(core, glow);
    let ring: THREE.Mesh | undefined;
    if (p.homing && p.owner === 'enemy') {
      ring = new THREE.Mesh(new THREE.TorusGeometry(p.radius * 1.9, 0.05, 6, 18), new THREE.MeshBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.8 }));
      g.add(ring);
    }
    const start = (p.owner === 'player' ? this.player : this.enemy).orbWorld(new THREE.Vector3());
    g.position.copy(start);
    this.scene.add(g);
    this.projViews.set(p.id, { group: g, p, ring, last: start.clone() });
  }

  private removeProjectile(id: number, burst: boolean, big: boolean): void {
    const v = this.projViews.get(id);
    if (!v) return;
    this.scene.remove(v.group);
    v.group.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = (m as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && !(mat instanceof THREE.SpriteMaterial && mat.map === GLOW)) mat.dispose?.();
    });
    this.projViews.delete(id);
    if (burst) this.particles.emit(v.last, col(v.p.color), big ? 40 : 12, big ? 5 : 2.5, big ? 0.7 : 0.4, big ? 4 : 1, 0.2);
  }

  handleEvents(events: BattleEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'spawn': this.spawnProjectile(e.p); break;
        case 'impact': this.removeProjectile(e.p.id, true, e.hit); if (e.hit) (e.who === 'player' ? this.player : this.enemy).hitT = 1; break;
        case 'reflect': { const v = this.projViews.get(e.p.id); if (v) { this.particles.emit(v.last, col('#ffffff'), 25, 4, 0.5); (v.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.color.set('#e6f2ff'); ((v.group.children[1] as THREE.Sprite).material as THREE.SpriteMaterial).color.set('#e6f2ff'); } break; }
        case 'cast':
          if (e.who === 'player') { this.player.castT = 1; this.particles.emit(this.player.orbWorld(new THREE.Vector3()), col(e.color), 14, 2, 0.4); }
          else { this.enemy.hold = false; this.enemy.castT = 1; }
          break;
        case 'telegraph':
          this.enemy.hold = true;
          if (e.kind !== 'heal' && e.kind !== 'shield') for (const l of e.lanes) this.laneT[l] = e.dur + 0.4;
          for (let i = 0; i < 3; i++) this.laneMat[i].color.set(e.kind === 'homing' ? '#ff4df2' : '#ff4040');
          if (e.kind === 'heal') this.particles.emit(this.enemyAnchor().setY(1), col('#7dff9b'), 30, 2, 1.2, -2, 1);
          break;
        case 'interrupt': this.enemy.hold = false; this.enemy.castT = 0; this.particles.emit(this.enemyAnchor().setY(1.5), col('#ffffff'), 20, 3, 0.5); break;
        case 'heal': this.particles.emit((e.who === 'player' ? this.playerAnchor() : this.enemyAnchor()).setY(0.8), col('#7dff9b'), 30, 1.5, 1.1, -2.5, 1.2); break;
        case 'shield': this.particles.emit((e.who === 'player' ? this.playerAnchor() : this.enemyAnchor()).setY(1.4), col('#6ea8ff'), 30, 3, 0.7, 0, 1.5); break;
        case 'phase': this.particles.emit(this.playerAnchor().setY(1.4), col('#c4c4ff'), 18, 2, 0.5, 0, 1.2); break;
        case 'freeze': this.enemy.hold = false; this.enemy.castT = 0; this.particles.emit(this.enemyAnchor().setY(1.4), col('#b8f4ff'), 40, 3, 0.9, 2, 1.4); break;
        case 'revive': this.particles.emit(this.playerAnchor().setY(1), col('#ffd166'), 80, 5, 1.3, -1, 1); break;
        case 'death': {
          const w = e.who === 'player' ? this.player : this.enemy;
          w.deathT = 0; w.hold = false;
          this.particles.emit((e.who === 'player' ? this.playerAnchor() : this.enemyAnchor()).setY(1.2), col(e.who === 'player' ? '#ff6060' : '#ffffff'), 90, 5, 1.4, 3, 1.4);
          if (e.who === 'player') this.shake = 1;
          break;
        }
        default: break;
      }
    }
  }

  update(dt: number, battle: BattleLike | null): void {
    this.time += dt;
    if (battle) {
      const p = battle.player, en = battle.enemy;
      this.player.x = LANE_X[p.lane];
      if (p.dodgeT < 0.05 && p.dodgeDir) this.player.tilt = -p.dodgeDir * 0.35;
      this.player.phased = p.phaseCharges > 0;
      this.player.setShield(p.shield, p.reflectT > 0);
      this.enemy.x = en.x;
      this.enemy.frozen = en.freezeT > 0;
      this.enemy.setShield(en.shield, false);
      if (en.freezeT > 0 || battle.over) this.enemy.hold = false;

      for (const pr of battle.projectiles) {
        if (pr.delayZ > 0) continue;
        let v = this.projViews.get(pr.id);
        if (!v) { this.spawnProjectile(pr); v = this.projViews.get(pr.id)!; }
        const prog = pr.owner === 'enemy' ? (pr.z - ENEMY_Z) / -ENEMY_Z : pr.z / ENEMY_Z;
        const k = Math.max(0, Math.min(1, prog));
        const x = pr.x0 + (pr.x1 - pr.x0) * k;
        const lob = pr.speed < 12 ? 2.2 : 0.5;
        const y = 1.5 + Math.sin(k * Math.PI) * lob + (pr.owner === 'enemy' ? 0 : 0.3);
        v.group.position.set(x, y, pr.z);
        v.last.copy(v.group.position);
        if (v.ring) { v.ring.rotation.x = this.time * 5; v.ring.rotation.y = this.time * 3; }
        this.particles.emit(v.group.position, col(pr.color), 2, 0.6, 0.35, 0, pr.radius);
      }
      for (const id of [...this.projViews.keys()]) if (!battle.projectiles.some(pr => pr.id === id)) this.removeProjectile(id, true, false);
    }

    for (let i = 0; i < 3; i++) {
      this.laneT[i] = Math.max(0, this.laneT[i] - dt);
      const on = this.laneT[i] > 0 ? 0.28 + Math.sin(this.time * 18) * 0.12 : 0;
      this.laneMat[i].opacity += (on - this.laneMat[i].opacity) * Math.min(1, dt * 12);
    }
    this.torches.forEach((t, i) => { const f = 2.0 + Math.sin(this.time * 9 + i * 1.7) * 0.3 + Math.random() * 0.15; t.scale.set(f, f, 1); });
    this.portal.rotation.z = this.time * 0.4;
    this.player.update(dt, this.time);
    this.enemy.update(dt, this.time);
    this.particles.update(dt);

    this.shake = Math.max(0, this.shake - dt * 2.5);
    const s = this.shake * this.shake * 0.25;
    const baseX = this.camera.position.x, baseY = this.camera.position.y;
    this.camera.position.x += (Math.random() - 0.5) * s;
    this.camera.position.y += (Math.random() - 0.5) * s;
    if (this.running) this.renderer.render(this.scene, this.camera);
    this.camera.position.x = baseX; this.camera.position.y = baseY;
    this.resizeIfNeeded();
  }

  private resizeIfNeeded(): void {
    const c = this.renderer.domElement;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (Math.abs(c.clientWidth - w) > 1 || Math.abs(c.clientHeight - h) > 1) this.resize();
  }

  setRunning(on: boolean): void { this.running = on; }

  /** A burst of an element's colour around the hero: the visual punctuation of a discovery. */
  /**
   * A camera kick, 0 to 1. Landing a spell used to move the camera not at all, so the player's own
   * successful action — the entire point of the game — had no physical feedback while being hit did.
   */
  kick(strength: number): void {
    this.shake = Math.max(this.shake, Math.max(0, Math.min(1, strength)));
  }

  flashDiscovery(color: string): void {
    const p = this.playerAnchor();
    this.particles.emit(p.clone().setY(1.4), col(color), 90, 5, 1.4, -1.5, 1.4);
    this.particles.emit(p.clone().setY(2.4), col('#ffffff'), 40, 3, 1.0, -1, 1.0);
    this.shake = 0.5;
  }
}
