/**
 * The living sky (Phase 14). A plain three.js scene, ported from the approved
 * Phase 10 prototype, with its look kept as approved: quiet galaxy centres,
 * goal stars as the brightest points, planets lit by their star with rings of
 * light, thoughts as moons and drifting clouds.
 *
 * The engine knows nothing about routes or storage. It draws a SkyModel,
 * flies to a SkyView, and reports taps through callbacks.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, ColorManagement, DoubleSide, Group,
  Line, LineBasicMaterial, LinearSRGBColorSpace, MathUtils, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera,
  Points, Quaternion, RingGeometry, Scene, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3, WebGLRenderer,
} from 'three';
import { hashString, mulberry32 } from '@/lib/rng';
import { measureSurface, type Surface } from '@/lib/surface';
import type { SkyGalaxy, SkyGoal, SkyModel, SkyPlanet } from './model';

export type SkyLevel = 'mind' | 'galaxy' | 'system' | 'page' | 'project' | 'rest';
export interface SkyView { level: SkyLevel; galaxyId?: string | null; goalId?: string | null; projectId?: string | null }
export type SkyTarget =
  | { kind: 'galaxy'; id: string }
  | { kind: 'goal'; id: string }
  | { kind: 'open-goal'; id: string }
  | { kind: 'project'; id: string }
  | { kind: 'thought'; id: string; goalId: string }
  | { kind: 'question'; id: string }
  | { kind: 'unsorted'; galaxyId: string | null }
  | { kind: 'new-galaxy' };
export interface SkyCallbacks { select: (t: SkyTarget) => void; zoomOut: () => void }
export type MoteTarget = { kind: 'galaxy' | 'goal' | 'project'; id: string } | { kind: 'drift' } | { kind: 'mind' };

interface Colors { [k: string]: Color }
interface Label { el: HTMLDivElement; n: HTMLSpanElement; c: HTMLSpanElement; base: string; world: () => Vector3; visible: () => boolean; cls2?: () => string; dy: (L: Label) => number; low: 'moon' | 'planet' | null; on: boolean; hidden: boolean; clash: boolean; w: number; h: number; key: string; text?: () => [string, string]; id: string }
interface PlanetObj { data: SkyPlanet; pivot: Object3D; mesh: Mesh; orbit: Line; bill: Group; ring: Mesh | null; glowS: Sprite; label: Label; frozen: boolean; ringR: number; light: Color }
interface MoonObj { id: string; spin: Object3D; sprite: Sprite; ph: number; sp: number; label: Label }
interface GoalObj { data: SkyGoal; star: Group; halo: Sprite; core: Sprite; flare: [Sprite, Sprite]; planets: PlanetObj[]; moons: MoonObj[]; label: Label; galaxy: GalaxyObj }
interface MoteObj { sprite: Sprite; a: number; b: number; c: number; ph: number; sp: number }
interface GalaxyObj { data: SkyGalaxy; group: Group; disk: Points; haze: Points; coreGlow: Sprite; neb: Group; cloud: Points; motes: MoteObj[]; goals: GoalObj[]; questions: { id: string; sprite: Sprite; label: Label }[]; label: Label; nebLabel: Label }

/** Up to this many goal stars per galaxy get a clearing in the arms around them. */
const MAX_CLEAR = 12;
/** Arms keep this much of their light at a goal's star, rising back to full between these distances. */
const CLEAR_KEEP = 0.6, CLEAR_IN = 3.5, CLEAR_OUT = 11;
const VS = `#define MAX_CLEAR ${MAX_CLEAR}
#define CLEAR_IN ${CLEAR_IN.toFixed(1)}
#define CLEAR_OUT ${CLEAR_OUT.toFixed(1)}

attribute float aSize; attribute float aPhase; attribute float aAlpha; attribute vec3 aColor;
uniform float uTime, uPixel, uScale, uFade, uTwinkle, uMax;
uniform vec3 uClear[MAX_CLEAR]; uniform float uClearN, uClearK, uClearS;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // A calm clearing in the arms around each goal's star, so the star and its name read clearly.
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float keep = 1.0;
  for (int i = 0; i < MAX_CLEAR; i++) {
    if (float(i) >= uClearN) break;
    keep = min(keep, mix(uClearK, 1.0, smoothstep(CLEAR_IN * uClearS, CLEAR_OUT * uClearS, distance(wp, uClear[i]))));
  }
  gl_Position = projectionMatrix * mv;
  float s = aSize * uPixel * uScale / max(-mv.z, 0.01);
  float tw = 1.0 - uTwinkle * 0.45 * (0.5 + 0.5 * sin(uTime * (0.5 + fract(aPhase * 7.13) * 1.7) + aPhase));
  vAlpha = aAlpha * tw * uFade * keep * clamp(s, 0.0, 1.0);
  gl_PointSize = clamp(s, 1.0, uMax * uPixel);
  vColor = aColor;
}`;
const FS = `
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.7);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;
const PLANET_VS = 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const PLANET_FS = 'uniform vec3 uColor; uniform vec3 uStar; uniform float uDim; varying vec3 vN; varying vec3 vW; void main(){ vec3 n = normalize(vN); vec3 L = normalize(uStar - vW); float diff = max(dot(n, L), 0.0); vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - max(dot(n, V), 0.0), 2.6); vec3 c = uColor * (0.22 + 0.78 * diff) + vec3(0.79, 0.66, 0.38) * rim * 0.32 * (0.3 + diff); gl_FragColor = vec4(c * uDim, 1.0); }';

const UP = new Vector3(0, 1, 0);
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export class SkyEngine {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(50, 1, 0.1, 6000);
  private U = { uTime: { value: 0 }, uPixel: { value: 1 } };
  private glowTex: CanvasTexture;
  private colors: Colors;
  private rnd = mulberry32(20261010);
  private galaxies: GalaxyObj[] = [];
  private goalIndex = new Map<string, GoalObj>();
  private planetIndex = new Map<string, PlanetObj>();
  private labels: Label[] = [];
  private ghost = new Group();
  private ghostLabel: Label;
  private drift = new Group();
  private driftMotes: MoteObj[] = [];
  private driftLabel: Label;
  private driftCount = 0;
  private model: SkyModel | null = null;
  private view: SkyView = { level: 'rest' };
  private W = 1; private H = 1; private wide = true;
  private mindBox = { hw: 100, hh: 80 };
  /** Shifts every view sideways (laptop) or upwards (phone), for when text sits beside the sky. */
  private bias = { x: 0, y: 0 };
  private cam = { pos: new Vector3(0, 420, 1500), target: new Vector3(), sx: 0, sy: 0 };
  private flight: null | { from: { pos: Vector3; target: Vector3; sx: number; sy: number }; to: { pos: Vector3; target: Vector3; sx: number; sy: number }; t0: number; dur: number; lift: number; fn: (k: number) => number } = null;
  private yaw = 0; private yawT = 0; private pitch = 0; private pitchT = 0; private zoom = 1; private zoomT = 1;
  private px = 0; private py = 0; private pxT = 0; private pyT = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private down: null | { x: number; y: number; t: number; moved: number } = null;
  private pinch0 = 0; private zoom0 = 1; private wheelLock = 0;
  private hot: Label | null = null;
  private orbitT = 0; private orbitRate = 1;
  private anims: ((now: number) => boolean)[] = [];
  private raf = 0; private last = performance.now();
  private disposed = false;
  private tmp1 = new Vector3(); private tmp2 = new Vector3(); private tmp3 = new Vector3();
  private boxes: { l: number; r: number; t: number; b: number }[] = [];
  private cleanup: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private layer: HTMLElement, private cb: SkyCallbacks, private reduce: boolean) {
    ColorManagement.enabled = false;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => new Color((css.getPropertyValue(name).trim() || fallback));
    this.colors = {
      ground: v('--obsidian', '#0a0b10'), parchment: v('--parchment', '#e8dcc4'), gold: v('--gold', '#c9a961'), goldDim: v('--gold-dim', '#8a7440'),
      verdigris: v('--verdigris', '#5e8b6e'), question: v('--question', '#dfe2ea'), starCore: v('--star-core', '#fff6e2'), starHalo: v('--star-halo', '#f3d9a0'),
      navyLight: new Color('#46557f'), coolWhite: new Color('#c9d3e6'), parchmentDim: v('--parchment-dim', '#a89f8c'),
      'gold-tint': v('--hue-gold', '#e2c486'), 'gold-core': v('--hue-gold-core', '#efe0bf'),
      'verdigris-tint': v('--hue-verdigris', '#8fbb9f'), 'verdigris-core': v('--hue-verdigris-core', '#d3e5d8'),
      'copper-tint': v('--hue-copper', '#d2a283'), 'copper-core': v('--hue-copper-core', '#f0ddcd'),
      'steel-tint': v('--hue-steel', '#9eb0cf'), 'steel-core': v('--hue-steel-core', '#dfe5f0'),
      'parchment-tint': v('--hue-parchment', '#e8dcc4'), 'parchment-core': v('--hue-parchment-core', '#f5efe2'),
    };
    this.renderer.setClearColor(this.colors.ground!, 1);
    this.glowTex = this.makeGlowTexture();
    this.buildDeepSky();
    this.scene.add(this.ghost, this.drift);
    this.ghost.rotation.set(0.95, 0.1, 0.1);
    this.ghost.add(this.makePoints(72, (i, pos, col, size, alpha) => {
      const a = (i / 72) * Math.PI * 2; pos[i * 3] = Math.cos(a) * 22; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = Math.sin(a) * 22;
      const g = this.colors.gold!; col[i * 3] = g.r; col[i * 3 + 1] = g.g; col[i * 3 + 2] = g.b; size[i] = 1.6; alpha[i] = 0.45;
    }, 560, 3, 0));
    this.ghostLabel = this.addLabel({ id: 'ghost', cls: 'ghost', name: '+ New galaxy', cap: 'as many as you like', world: () => this.ghost.getWorldPosition(this.tmp1), dy: () => -22, visible: () => this.view.level === 'mind', click: () => this.cb.select({ kind: 'new-galaxy' }) });
    this.drift.add(this.makePoints(200, (i, pos, col, size, alpha) => {
      pos[i * 3] = this.gauss() * 7; pos[i * 3 + 1] = this.gauss() * 3; pos[i * 3 + 2] = this.gauss() * 7;
      const c = this.rnd() > 0.5 ? this.colors.navyLight! : this.colors.parchmentDim!; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = 8 + this.rnd() * 18; alpha[i] = 0.035 + this.rnd() * 0.05;
    }, 150, 46, 0.3));
    this.driftLabel = this.addLabel({ id: 'drift', cls: 'nebula', name: '', cap: '', world: () => this.drift.getWorldPosition(this.tmp1).add(this.tmp2.set(0, 9, 0)), dy: () => -20, visible: () => this.view.level === 'mind' && this.driftCount > 0, text: () => [`${this.driftCount} ${this.driftCount === 1 ? 'thought' : 'thoughts'} drifting`, 'no galaxy yet'], click: () => this.cb.select({ kind: 'unsorted', galaxyId: null }) });
    this.bindInput();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ---------- building blocks ---------- */
  private gauss() { return (this.rnd() + this.rnd() + this.rnd() + this.rnd() - 2) / 2; }
  private makeGlowTexture(): CanvasTexture {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!; const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.7)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  }
  private pointsMat(scale: number, max: number, twinkle: number): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: { uTime: this.U.uTime, uPixel: this.U.uPixel, uScale: { value: scale }, uFade: { value: 1 }, uTwinkle: { value: this.reduce ? 0 : twinkle }, uMax: { value: max }, uClear: { value: Array.from({ length: MAX_CLEAR }, () => new Vector3()) }, uClearN: { value: 0 }, uClearK: { value: CLEAR_KEEP }, uClearS: { value: 1 } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
  }
  private makePoints(n: number, fill: (i: number, pos: Float32Array, col: Float32Array, size: Float32Array, alpha: Float32Array, phase: Float32Array) => void, scale: number, max: number, twinkle: number): Points {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), phase = new Float32Array(n);
    for (let i = 0; i < n; i++) { phase[i] = this.rnd() * 100; fill(i, pos, col, size, alpha, phase); }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('aColor', new BufferAttribute(col, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1)); g.setAttribute('aAlpha', new BufferAttribute(alpha, 1)); g.setAttribute('aPhase', new BufferAttribute(phase, 1));
    const p = new Points(g, this.pointsMat(scale, max, twinkle)); p.frustumCulled = false; return p;
  }
  private glow(color: Color, size: number, opacity: number): Sprite {
    const s = new Sprite(new SpriteMaterial({ map: this.glowTex, color: color.clone(), transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(size); return s;
  }
  private density(): number { return Math.min(window.innerWidth, window.innerHeight) < 600 ? 0.6 : 1; }

  private buildDeepSky() {
    const D = this.density(), C = this.colors;
    this.scene.add(this.makePoints(Math.round(3200 * D), (i, pos, col, size, alpha) => {
      const u = this.rnd() * 2 - 1, th = this.rnd() * Math.PI * 2, r = 900 + this.rnd() * 1400, s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(th) * s * r; pos[i * 3 + 1] = u * r * 0.7; pos[i * 3 + 2] = Math.sin(th) * s * r - 300;
      const k = this.rnd(), c = k > 0.94 ? C['gold-tint']! : k > 0.8 ? C.coolWhite! : C.parchment!;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = 1.2 + Math.pow(this.rnd(), 3) * 3.4; alpha[i] = 0.25 + this.rnd() * 0.6;
    }, 1300, 5, 1));
    this.scene.add(this.makePoints(Math.round(700 * D), (i, pos, col, size, alpha) => {
      pos[i * 3] = (this.rnd() - 0.5) * 800; pos[i * 3 + 1] = (this.rnd() - 0.5) * 460; pos[i * 3 + 2] = (this.rnd() - 0.5) * 600 - 80;
      const c = this.rnd() > 0.7 ? C.goldDim! : new Color('#5f6a8a'); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = 1 + this.rnd() * 2.2; alpha[i] = 0.18 + this.rnd() * 0.35;
    }, 260, 4, 0.6));
  }

  /* ---------- the mind ---------- */
  setModel(model: SkyModel) {
    const prev = this.model;
    this.model = model;
    if (prev && prev.structure === model.structure) { this.updateInPlace(model); return; }
    this.clearMind();
    model.galaxies.forEach((g, i) => this.buildGalaxy(g, i));
    this.driftCount = model.drifting.length;
    this.rebuildDriftMotes(model.drifting.length);
    this.layout();
    if (!this.flight) this.flyTo(this.viewFor(this.view), 600);
  }

  private clearMind() {
    for (const g of this.galaxies) { this.scene.remove(g.group); g.group.traverse((o) => { const m = o as Mesh; m.geometry?.dispose?.(); }); }
    for (const L of this.labels.filter((x) => x !== this.ghostLabel && x !== this.driftLabel)) L.el.remove();
    this.labels = this.labels.filter((x) => x === this.ghostLabel || x === this.driftLabel);
    this.galaxies = []; this.goalIndex.clear(); this.planetIndex.clear();
  }

  private rebuildDriftMotes(n: number) {
    for (const m of this.driftMotes) this.drift.remove(m.sprite);
    this.driftMotes = [];
    for (let i = 0; i < n; i++) this.driftMotes.push(this.addMote(this.drift));
  }

  private addMote(parent: Object3D): MoteObj {
    const s = this.glow(new Color('#f1e3c2'), 1.1, 0.85);
    parent.add(s);
    return { sprite: s, a: 2 + this.rnd() * 4.5, b: 0.6 + this.rnd() * 1.4, c: 2 + this.rnd() * 4.5, ph: this.rnd() * 6.28, sp: 0.05 + this.rnd() * 0.06 };
  }

  private lightFor(shape: SkyPlanet['shape']): Color {
    return shape === 'habit' ? this.colors['verdigris-tint']! : shape === 'explore' ? this.colors.coolWhite! : this.colors['gold-tint']!;
  }
  private bodyFor(shape: SkyPlanet['shape']): Color {
    return ({ list: new Color('#d9c9a6'), number: new Color('#c08f52'), habit: new Color('#6f9a7d'), date: new Color('#c9a98a'), levels: new Color('#b9a27a'), explore: new Color('#a7b8c9') } as const)[shape];
  }

  private buildGalaxy(data: SkyGalaxy, gi: number) {
    // Seeded from the galaxy's id, so rebuilding after a change draws exactly the same galaxy.
    this.rnd = mulberry32(hashString(data.id));
    const C = this.colors, D = this.density();
    const tint = C[`${data.hue}-tint`]!, core = C[`${data.hue}-core`]!;
    const group = new Group();
    group.rotation.set(0.88 + (gi % 3) * 0.08, gi % 2 ? -0.25 : 0.2, gi % 2 ? -0.3 : 0.24);
    this.scene.add(group);
    const R = data.R;
    const armPoint = (i: number, pos: Float32Array, bulge: boolean) => {
      let rr: number, ang: number, y: number;
      if (bulge) { rr = Math.abs(this.gauss()) * R * 0.25; ang = this.rnd() * Math.PI * 2; y = this.gauss() * 2.2 * (1 - rr / R); }
      else if (this.rnd() < 0.25) { rr = Math.sqrt(this.rnd()) * R * 1.05; ang = this.rnd() * Math.PI * 2; y = this.gauss() * 1.2; }
      else { const arm = i % 2; rr = (0.1 + Math.pow(this.rnd(), 0.85) * 0.9) * R; ang = arm * Math.PI + rr * (4.4 / R) + this.gauss() * 0.55 * (1.25 - (rr / R) * 0.55); y = this.gauss() * 1.6 * (1 - (rr / R) * 0.7); }
      pos[i * 3] = Math.cos(ang) * rr; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(ang) * rr;
      return rr;
    };
    // A galaxy's centre is not a goal, so it stays quiet: brightness rises outwards and the stars carry the light.
    const disk = this.makePoints(Math.round(Math.pow(R / 40, 2) * 5200 * D), (i, pos, col, size, alpha) => {
      const bulge = this.rnd() < 0.1, rr = armPoint(i, pos, bulge);
      const k = Math.min(1, (rr / R) * 1.4); let c = core.clone().lerp(tint, k);
      if (this.rnd() > 0.94) c = C.coolWhite!;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      const calm = 0.25 + 0.75 * Math.min(1, Math.pow(rr / (R * 0.4), 1.4));
      size[i] = 0.7 + Math.pow(this.rnd(), 2.5) * 2.4; alpha[i] = (0.2 + this.rnd() * 0.42) * (bulge ? 0.3 : 1) * calm;
    }, 560, 5, 0.8);
    group.add(disk);
    const haze = this.makePoints(Math.round(Math.pow(R / 40, 2) * 520 * D), (i, pos, col, size, alpha) => {
      const rr = armPoint(i, pos, false);
      const k = Math.min(1, (rr / R) * 1.3), c = core.clone().lerp(tint, k).lerp(C.navyLight!, 0.3 * k);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = 7 + this.rnd() * 12; alpha[i] = (0.04 + this.rnd() * 0.05) * Math.min(1, rr / (R * 0.35));
    }, 560, 60, 0);
    disk.add(haze);
    const coreGlow = this.glow(core, R * 0.6, 0.07); group.add(coreGlow);

    const neb = new Group(); neb.position.set(...data.nebulaAt); group.add(neb);
    const cloud = this.makePoints(Math.round(260 * D), (i, pos, col, size, alpha) => {
      pos[i * 3] = this.gauss() * 6.5; pos[i * 3 + 1] = this.gauss() * 3; pos[i * 3 + 2] = this.gauss() * 6.5;
      const c = this.rnd() > 0.55 ? C.navyLight! : tint; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = 8 + this.rnd() * 18; alpha[i] = 0.03 + this.rnd() * 0.05;
    }, 150, 46, 0.3);
    neb.add(cloud);
    cloud.visible = data.unsorted.length > 0;

    const G: GalaxyObj = { data, group, disk, haze, coreGlow, neb, cloud, motes: [], goals: [], questions: [], label: null as unknown as Label, nebLabel: null as unknown as Label };
    for (let i = 0; i < data.unsorted.length; i++) G.motes.push(this.addMote(neb));

    for (const goal of data.goals) this.buildGoal(G, goal);

    for (const q of data.questions) {
      const s = this.glow(C.question!, 2.0, 0.6); s.position.set(...q.at); group.add(s);
      s.add(this.glow(C.coolWhite!, 3.5, 0.15));
      const label = this.addLabel({ id: q.id, cls: 'question', name: q.text, cap: 'open question', world: () => s.getWorldPosition(this.tmp1), dy: () => 8, visible: () => this.view.level === 'galaxy' && this.view.galaxyId === data.id, click: () => this.cb.select({ kind: 'question', id: q.id }) });
      G.questions.push({ id: q.id, sprite: s, label });
    }

    G.nebLabel = this.addLabel({ id: `neb-${data.id}`, cls: 'nebula', name: '', cap: '', world: () => neb.getWorldPosition(this.tmp1).add(this.tmp2.set(0, 9, 0).applyQuaternion(group.quaternion)), dy: () => -20,
      text: () => { const n = G.data.unsorted.length; return [`${n} ${n === 1 ? 'thought' : 'thoughts'} drifting`, 'unsorted']; },
      visible: () => this.view.level === 'galaxy' && this.view.galaxyId === data.id && G.data.unsorted.length > 0, click: () => this.cb.select({ kind: 'unsorted', galaxyId: data.id }) });
    G.label = this.addLabel({ id: `gx-${data.id}`, cls: 'galaxy', tint: `var(--hue-${data.hue})`, name: data.name, cap: '', world: () => this.tmp1.copy(group.position).add(this.tmp2.set(0, 0, data.R * 0.95).applyQuaternion(group.quaternion)), dy: () => 6,
      text: () => { const n = G.data.unsorted.length, k = G.data.goals.length; return [G.data.name, `${k} ${k === 1 ? 'goal' : 'goals'}${n ? ` · ${n} unsorted` : ''}`]; },
      visible: () => this.view.level === 'mind' || (this.view.level === 'galaxy' && this.view.galaxyId !== data.id), click: () => this.cb.select({ kind: 'galaxy', id: data.id }) });
    this.galaxies.push(G);
  }

  /** Tells a galaxy's arms where its goal stars are, so they thin out around them. */
  private clearAround(G: GalaxyObj, scale: number, damp: number) {
    for (const m of [G.disk.material, G.haze.material] as ShaderMaterial[]) {
      const at = m.uniforms.uClear!.value as Vector3[];
      const n = Math.min(MAX_CLEAR, G.goals.length);
      for (let i = 0; i < n; i++) G.goals[i]!.star.getWorldPosition(at[i]!);
      m.uniforms.uClearN!.value = n;
      // From far away the clearing is wider, so it still reaches past the star's name.
      const sc = m.uniforms.uClearS!; sc.value += (scale - sc.value) * damp * 0.6;
    }
  }

  private buildGoal(G: GalaxyObj, goal: SkyGoal) {
    const C = this.colors;
    const star = new Group(); star.position.set(...goal.at); G.group.add(star);
    // Goals are the brightest things in the sky: a white-gold core, a warm halo, and a faint line of light.
    const halo = this.glow(C.starHalo!, 9, 0.3), core = this.glow(C.starCore!, 2.4, 1);
    const fh = this.glow(new Color('#f7e6c0'), 1, 0), fv = this.glow(new Color('#f7e6c0'), 1, 0);
    star.add(halo, core, fh, fv);
    const O: GoalObj = { data: goal, star, halo, core, flare: [fh, fv], planets: [], moons: [], label: null as unknown as Label, galaxy: G };
    for (const p of goal.planets) O.planets.push(this.buildPlanet(O, p));
    goal.moons.forEach((m) => O.moons.push(this.buildMoon(O, m.id, m.text, m.question)));
    O.label = this.addLabel({ id: `goal-${goal.id}`, cls: `goal${goal.bright < 0.5 ? ' dim' : ''}`, name: goal.name, cap: goal.caption, world: () => star.getWorldPosition(this.tmp1),
      visible: () => (this.view.level === 'mind' && this.wide) || (this.view.level === 'galaxy' && this.view.galaxyId === G.data.id) || (this.view.level === 'system' && this.view.goalId === goal.id),
      cls2: () => (this.view.level === 'mind' ? 'faint' : this.view.level === 'system' ? 'big' : ''),
      dy: (L) => (this.view.level === 'system' ? -((L.h || 60) + 10) : 12),
      click: () => this.cb.select(this.view.level === 'system' ? { kind: 'open-goal', id: goal.id } : { kind: 'goal', id: goal.id }) });
    G.goals.push(O);
    this.goalIndex.set(goal.id, O);
  }

  private buildPlanet(O: GoalObj, p: SkyPlanet): PlanetObj {
    const pivot = new Object3D(); O.star.add(pivot);
    const pts: Vector3[] = []; for (let a = 0; a <= 128; a++) { const t = (a / 128) * Math.PI * 2; pts.push(new Vector3(Math.cos(t) * p.r, 0, Math.sin(t) * p.r)); }
    const orbit = new Line(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ color: this.colors.gold!, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
    O.star.add(orbit);
    const mesh = new Mesh(new SphereGeometry(p.size, 40, 28), new ShaderMaterial({ uniforms: { uColor: { value: this.bodyFor(p.shape) }, uStar: { value: new Vector3() }, uDim: { value: p.finished ? 0.55 : 1 } }, vertexShader: PLANET_VS, fragmentShader: PLANET_FS }));
    mesh.position.set(p.r, 0, 0); pivot.add(mesh);
    const light = this.lightFor(p.shape);
    const glowS = this.glow(light, p.size * 5.5, 0.06 + p.progress * 0.34); mesh.add(glowS);
    const bill = new Group(); mesh.add(bill);
    const ringR = p.size * 1.9;
    bill.add(new Mesh(new RingGeometry(ringR, ringR + 0.05, 96), new MeshBasicMaterial({ color: this.colors.parchment!, transparent: true, opacity: 0.12, side: DoubleSide, depthWrite: false, blending: AdditiveBlending })));
    const P: PlanetObj = { data: p, pivot, mesh, orbit, bill, ring: null, glowS, label: null as unknown as Label, frozen: false, ringR, light };
    this.setRing(P, p.progress);
    P.label = this.addLabel({ id: `p-${p.id}`, cls: 'planet', name: p.name, cap: p.caption, world: () => mesh.getWorldPosition(this.tmp1), dy: () => 12, low: 'planet',
      visible: () => this.view.level === 'system' && this.view.goalId === O.data.id, click: () => this.cb.select({ kind: 'project', id: p.id }) });
    this.planetIndex.set(p.id, P);
    return P;
  }

  private setRing(P: PlanetObj, progress: number) {
    if (P.ring) { P.bill.remove(P.ring); P.ring.geometry.dispose(); P.ring = null; }
    if (progress <= 0) return;
    const f = Math.min(1, progress);
    P.ring = new Mesh(new RingGeometry(P.ringR - 0.01, P.ringR + 0.09, 96, 1, Math.PI / 2 - f * Math.PI * 2, f * Math.PI * 2), new MeshBasicMaterial({ color: P.light, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false, blending: AdditiveBlending }));
    P.bill.add(P.ring);
    (P.glowS.material as SpriteMaterial).opacity = 0.06 + f * 0.34;
  }

  private buildMoon(O: GoalObj, id: string, text: string, question: boolean): MoonObj {
    const tilt = new Object3D(); tilt.rotation.set((this.rnd() - 0.5) * 0.9, 0, (this.rnd() - 0.5) * 0.9); O.star.add(tilt);
    const spin = new Object3D(); tilt.add(spin);
    const r = 2 + O.moons.length * 0.55;
    const s = this.glow(question ? this.colors.question! : new Color('#efe4cc'), 0.7, 0.9); s.position.set(r, 0, 0); spin.add(s);
    const label = this.addLabel({ id: `m-${id}`, cls: `moon${question ? ' q' : ''}`, name: text, cap: '', world: () => s.getWorldPosition(this.tmp1), dy: () => 4, low: 'moon',
      visible: () => this.view.level === 'system' && this.view.goalId === O.data.id, click: () => this.cb.select({ kind: 'thought', id, goalId: O.data.id }) });
    return { id, spin, sprite: s, ph: this.rnd() * 6.28, sp: 0.18 + this.rnd() * 0.12, label };
  }

  /** Same structure, new details: names, counts, progress, brightness. No rebuild, no jump. */
  private updateInPlace(model: SkyModel) {
    for (const G of this.galaxies) {
      const g = model.galaxies.find((x) => x.id === G.data.id); if (!g) continue;
      G.data = g; G.label.n.textContent = g.name;
      for (const O of G.goals) {
        const goal = g.goals.find((x) => x.id === O.data.id); if (!goal) continue;
        O.data = goal; O.label.n.textContent = goal.name; O.label.c.textContent = goal.caption;
        for (const P of O.planets) {
          const p = goal.planets.find((x) => x.id === P.data.id); if (!p) continue;
          if (Math.abs(p.progress - P.data.progress) > 1e-6) this.setRing(P, p.progress);
          P.data = p; P.label.n.textContent = p.name; P.label.c.textContent = p.caption;
        }
        goal.moons.forEach((m, i) => { const M = O.moons[i]; if (M) M.label.n.textContent = m.text; });
      }
    }
    this.driftCount = model.drifting.length;
  }

  /* ---------- labels ---------- */
  private addLabel(o: { id: string; cls: string; name: string; cap?: string; tint?: string; world: () => Vector3; visible: () => boolean; click: () => void; dy: (L: Label) => number; cls2?: () => string; text?: () => [string, string]; low?: 'moon' | 'planet' }): Label {
    const el = document.createElement('div'); el.className = `skylbl ${o.cls}`;
    if (o.tint) el.style.setProperty('--tint', o.tint);
    const b = document.createElement('button'); b.type = 'button';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = o.name;
    const c = document.createElement('span'); c.className = 'c'; c.textContent = o.cap ?? '';
    b.append(n, c);
    b.addEventListener('click', (e) => { e.stopPropagation(); o.click(); });
    el.appendChild(b); this.layer.appendChild(el);
    const L: Label = { el, n, c, base: `skylbl ${o.cls}`, world: o.world, visible: o.visible, dy: o.dy, low: o.low ?? null, on: false, hidden: false, clash: false, w: 0, h: 0, key: '', id: o.id, ...(o.cls2 ? { cls2: o.cls2 } : {}), ...(o.text ? { text: o.text } : {}) };
    this.labels.push(L);
    return L;
  }

  private updateLabels() {
    this.boxes.length = 0;
    const order = [...this.labels.filter((L) => !L.low), ...this.labels.filter((L) => L.low === 'planet'), ...this.labels.filter((L) => L.low === 'moon')];
    for (const L of order) {
      const vis = L.visible() && !L.hidden;
      const cls = `${L.base}${L.cls2 ? ` ${L.cls2()}` : ''}${vis ? ' on' : ''}${vis && L.clash ? ' clash' : ''}${L === this.hot ? ' hot' : ''}`;
      if (L.el.className !== cls) L.el.className = cls;
      if (L.text) { const [a, b] = L.text(); if (L.n.textContent !== a) L.n.textContent = a; if (L.c.textContent !== b) L.c.textContent = b; }
      if (!vis && !L.on) continue;
      L.on = vis;
      this.tmp3.copy(L.world()).project(this.camera);
      if (this.tmp3.z > 1 || this.tmp3.z < -1) { L.el.style.visibility = 'hidden'; continue; }
      L.el.style.visibility = '';
      const x = ((this.tmp3.x + 1) / 2) * this.W, y = ((1 - this.tmp3.y) / 2) * this.H, dy = L.dy(L);
      L.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,${dy}px)`;
      if (vis) {
        const key = cls.replace(/ (hot|clash)/g, '');
        if (!L.w || L.key !== key) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; L.key = key; }
        const bx = { l: x - L.w / 2, r: x + L.w / 2, t: y + dy + 6, b: y + dy + L.h - 6 };
        let hit = false;
        if (L.low) for (const B of this.boxes) if (bx.l < B.r && bx.r > B.l && bx.t < B.b && bx.b > B.t) { hit = true; break; }
        if (hit !== L.clash) { L.clash = hit; L.el.classList.toggle('clash', hit); }
        if (!hit) this.boxes.push(bx);
      }
    }
  }

  /* ---------- views and flights ---------- */
  private layout() {
    const n = this.galaxies.length + 1 + (this.driftCount ? 1 : 0);
    const cols = this.wide ? (n <= 3 ? n : Math.ceil(n / 2)) : n <= 2 ? 1 : 2, rows = Math.ceil(n / cols);
    const S = this.wide ? 100 : 86, SY = this.wide ? 92 : 104;
    const cells: Object3D[] = [...this.galaxies.map((g) => g.group), ...(this.driftCount ? [this.drift] : []), this.ghost];
    cells.forEach((obj, i) => {
      const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols), off = (cols - inRow) / 2;
      obj.position.set((c + off - (cols - 1) / 2) * S, -(r - (rows - 1) / 2) * SY + (c % 2 ? -9 : 9), -((i * 37) % 3) * 12);
    });
    this.drift.visible = this.driftCount > 0;
    this.mindBox = { hw: ((cols - 1) / 2) * S + 48, hh: ((rows - 1) / 2) * SY + 66 };
  }

  private fitDist(hw: number, hh: number) {
    const vf = MathUtils.degToRad(this.camera.fov) / 2, hf = Math.atan(Math.tan(vf) * this.camera.aspect);
    return Math.max(hw / Math.tan(hf), hh / Math.tan(vf));
  }

  private viewFor(v: SkyView) {
    let center: Vector3, dir: Vector3, hw: number, hh: number, sx = 0, sy = 0;
    const G = v.galaxyId ? this.galaxies.find((g) => g.data.id === v.galaxyId) : undefined;
    const O = v.goalId ? this.goalIndex.get(v.goalId) : undefined;
    const P = v.projectId ? this.planetIndex.get(v.projectId) : undefined;
    const side = v.level === 'page' || v.level === 'project';
    const close = v.level === 'system' || side;
    if (G && (v.level === 'galaxy' || (close && !O))) {
      center = G.group.position.clone(); dir = new Vector3(0, 0.9, 1).applyQuaternion(G.group.quaternion).normalize(); hw = hh = G.data.R + 6;
      if (!this.wide) { hw = G.data.R; hh = G.data.R + 14; }
    } else if (O && close) {
      dir = new Vector3(0, 0.55, 1).applyQuaternion(O.galaxy.group.quaternion).normalize();
      if (v.level === 'project' && P) { center = P.mesh.getWorldPosition(new Vector3()); hw = hh = 3.6; }
      else { center = O.star.getWorldPosition(new Vector3()); hw = hh = 11.5; }
      if (side) { if (this.wide) { hw *= 1.9; hh *= 1.15; sx = 0.24; } else { hh *= 2.2; hw *= 1.15; sy = 0.29; } }
      else if (!this.wide) { sy = 0.12; hh *= 1.25; } else sx = -0.08;
    } else {
      center = new Vector3(0, -6, 0); dir = new Vector3(0, 0.28, 1).normalize(); hw = this.mindBox.hw; hh = this.mindBox.hh;
    }
    if (this.bias.x || this.bias.y) { if (this.wide) { sx += this.bias.x; hw *= 1.5; } else { sy += this.bias.y; hh *= 1.5; } }
    const d = this.fitDist(hw, hh) + Math.min(hw, hh) * 0.3;
    return { pos: center.clone().addScaledVector(dir, d), target: center, sx, sy };
  }

  private flyTo(to: { pos: Vector3; target: Vector3; sx: number; sy: number }, dur?: number, fn = ease) {
    if (this.reduce) { Object.assign(this.cam, { sx: to.sx, sy: to.sy }); this.cam.pos.copy(to.pos); this.cam.target.copy(to.target); this.flight = null; return; }
    const dist = this.cam.pos.distanceTo(to.pos);
    this.flight = { from: { pos: this.cam.pos.clone(), target: this.cam.target.clone(), sx: this.cam.sx, sy: this.cam.sy }, to, t0: performance.now(), dur: dur ?? Math.min(2600, Math.max(1100, 900 + dist * 2.2)), lift: dist * 0.1, fn };
  }

  setBias(x: number, y: number) { this.bias = { x, y }; if (this.flight) this.flight.to = this.viewFor(this.view); else this.flyTo(this.viewFor(this.view), 400); }

  setView(v: SkyView) {
    const same = v.level === this.view.level && v.galaxyId === this.view.galaxyId && v.goalId === this.view.goalId && v.projectId === this.view.projectId;
    this.view = v;
    for (const P of this.planetIndex.values()) { P.frozen = v.level === 'project' && v.projectId === P.data.id; }
    for (const O of this.goalIndex.values()) O.label.hidden = v.level === 'page' && v.goalId === O.data.id;
    if (same) return;
    this.yawT = 0; this.pitchT = 0;
    this.flyTo(this.viewFor(v));
  }

  /** The slow drift in from deep space, once per visit. */
  arrive() {
    const v = this.viewFor(this.view);
    if (this.reduce) { this.cam.pos.copy(v.pos); this.cam.target.copy(v.target); return; }
    this.cam.pos.set(-160, 520, 1700); this.cam.target.set(0, -40, -200);
    this.flyTo(v, 4200, (k) => 1 - Math.pow(1 - k, 3.4));
    if (this.flight) this.flight.lift = 0;
  }
  skipArrival() { if (this.flight && this.flight.dur >= 4000) this.flyTo(this.viewFor(this.view), 800); }

  /** A captured thought leaves the sheet as a point of light and settles where it was sent. */
  launchMote(sx: number, sy: number, target: MoteTarget, onArrive?: () => void) {
    const world = (): Vector3 => {
      if (target.kind === 'goal') return this.goalIndex.get(target.id)?.star.getWorldPosition(this.tmp2) ?? this.tmp2.set(0, 0, 0);
      if (target.kind === 'project') return this.planetIndex.get(target.id)?.mesh.getWorldPosition(this.tmp2) ?? this.tmp2.set(0, 0, 0);
      if (target.kind === 'galaxy') { const G = this.galaxies.find((g) => g.data.id === target.id); return G ? G.neb.getWorldPosition(this.tmp2) : this.tmp2.set(0, 0, 0); }
      if (target.kind === 'drift') return this.drift.getWorldPosition(this.tmp2);
      return this.tmp2.copy(this.cam.target);
    };
    if (this.reduce) { onArrive?.(); return; }
    const ndc = new Vector3((sx / this.W) * 2 - 1, -((sy / this.H) * 2 - 1), 0.5).unproject(this.camera);
    const start = this.camera.position.clone().addScaledVector(ndc.sub(this.camera.position).normalize(), 8);
    const core = this.glow(this.colors.starCore!, 1, 1), halo = this.glow(this.colors['gold-tint']!, 3.5, 0.5);
    core.add(halo); this.scene.add(core);
    const TN = 28, tpos = new Float32Array(TN * 3), tcol = new Float32Array(TN * 3), tsize = new Float32Array(TN), talpha = new Float32Array(TN), tph = new Float32Array(TN);
    for (let i = 0; i < TN; i++) { tpos.set([start.x, start.y, start.z], i * 3); tcol.set([0.95, 0.82, 0.55], i * 3); }
    const tg = new BufferGeometry();
    tg.setAttribute('position', new BufferAttribute(tpos, 3)); tg.setAttribute('aColor', new BufferAttribute(tcol, 3)); tg.setAttribute('aSize', new BufferAttribute(tsize, 1)); tg.setAttribute('aAlpha', new BufferAttribute(talpha, 1)); tg.setAttribute('aPhase', new BufferAttribute(tph, 1));
    const trail = new Points(tg, this.pointsMat(1, 14, 0)); trail.frustumCulled = false; this.scene.add(trail);
    const t0 = performance.now(), dur = 1700; let done = false; const hist: Vector3[] = [];
    this.anims.push((now) => {
      const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const end = world().clone();
      const ctrl = start.clone().lerp(end, 0.5).addScaledVector(this.camera.up, start.distanceTo(end) * 0.28);
      const p = new Vector3().copy(start).multiplyScalar((1 - e) * (1 - e)).addScaledVector(ctrl, 2 * (1 - e) * e).addScaledVector(end, e * e);
      if (!done) {
        core.position.copy(p);
        const dc = this.camera.position.distanceTo(p);
        core.scale.setScalar(MathUtils.lerp(dc * 0.05, Math.max(0.9, dc * 0.012), e * e));
        hist.unshift(p.clone()); if (hist.length > TN) hist.pop();
      } else hist.pop();
      for (let i = 0; i < TN; i++) { const h = hist[Math.min(i, hist.length - 1)] ?? p; tpos.set([h.x, h.y, h.z], i * 3); tsize[i] = (1 - i / TN) * this.camera.position.distanceTo(h) * 0.02; talpha[i] = i < hist.length ? 0.55 * (1 - i / TN) : 0; }
      tg.attributes.position!.needsUpdate = true; tg.attributes.aSize!.needsUpdate = true; tg.attributes.aAlpha!.needsUpdate = true;
      if (k >= 1 && !done) { done = true; this.scene.remove(core); this.flash(end); onArrive?.(); }
      if (done && hist.length === 0) { this.scene.remove(trail); tg.dispose(); return false; }
      return true;
    });
  }

  private flash(at: Vector3) {
    const s = this.glow(this.colors.starHalo!, 1, 0.9); s.position.copy(at); this.scene.add(s);
    const t0 = performance.now(), base = Math.max(1.5, this.camera.position.distanceTo(at) * 0.02);
    this.anims.push((now) => { const k = Math.min(1, (now - t0) / 1100); s.scale.setScalar(base * (1 + k * 5)); (s.material as SpriteMaterial).opacity = 0.9 * (1 - k) * (1 - k); if (k >= 1) { this.scene.remove(s); return false; } return true; });
  }

  /* ---------- input ---------- */
  private focalPx() { return this.H / 2 / Math.tan(MathUtils.degToRad(this.camera.fov) / 2); }
  private pickAt(x: number, y: number): { act: () => void; label: Label } | null {
    let best: { act: () => void; label: Label } | null = null, bestScore = Infinity;
    const test = (world: Vector3, worldR: number, minPx: number, bonus: number, act: () => void, label: Label) => {
      this.tmp3.copy(world).project(this.camera);
      if (this.tmp3.z > 1 || this.tmp3.z < -1) return;
      const sx = ((this.tmp3.x + 1) / 2) * this.W, sy = ((1 - this.tmp3.y) / 2) * this.H;
      const d = this.camera.position.distanceTo(world), rad = Math.max(minPx, (worldR / d) * this.focalPx());
      const dist = Math.hypot(sx - x, sy - y);
      if (dist <= rad) { const score = dist / rad - bonus; if (score < bestScore) { bestScore = score; best = { act, label }; } }
    };
    const v = this.view;
    if (v.level === 'mind') {
      for (const G of this.galaxies) {
        test(G.group.position, G.data.R * 0.95, 30, 0, () => this.cb.select({ kind: 'galaxy', id: G.data.id }), G.label);
        if (this.wide) for (const O of G.goals) test(O.star.getWorldPosition(new Vector3()), 2, 16, 0.6, () => this.cb.select({ kind: 'goal', id: O.data.id }), O.label);
      }
      test(this.ghost.position, 22, 30, 0, () => this.cb.select({ kind: 'new-galaxy' }), this.ghostLabel);
      if (this.driftCount) test(this.drift.position, 9, 30, 0, () => this.cb.select({ kind: 'unsorted', galaxyId: null }), this.driftLabel);
    } else if (v.level === 'galaxy') {
      const G = this.galaxies.find((g) => g.data.id === v.galaxyId);
      if (G) {
        for (const O of G.goals) test(O.star.getWorldPosition(new Vector3()), 3, 26, 1, () => this.cb.select({ kind: 'goal', id: O.data.id }), O.label);
        for (const q of G.questions) test(q.sprite.getWorldPosition(new Vector3()), 2, 22, 0.8, () => this.cb.select({ kind: 'question', id: q.id }), q.label);
        if (G.data.unsorted.length) test(G.neb.getWorldPosition(new Vector3()), 8, 30, 0.4, () => this.cb.select({ kind: 'unsorted', galaxyId: G.data.id }), G.nebLabel);
      }
      for (const O of this.galaxies) if (O !== G) test(O.group.position, O.data.R * 0.9, 30, 0, () => this.cb.select({ kind: 'galaxy', id: O.data.id }), O.label);
    } else if (v.level === 'system' || v.level === 'page' || v.level === 'project') {
      const O = v.goalId ? this.goalIndex.get(v.goalId) : undefined;
      if (O) {
        for (const P of O.planets) test(P.mesh.getWorldPosition(new Vector3()), P.data.size * 2.4, 24, 1, () => this.cb.select({ kind: 'project', id: P.data.id }), P.label);
        for (const M of O.moons) test(M.sprite.getWorldPosition(new Vector3()), 0.6, 16, 0.6, () => this.cb.select({ kind: 'thought', id: M.id, goalId: O.data.id }), M.label);
        if (v.level === 'system') test(O.star.getWorldPosition(new Vector3()), 1.6, 24, 0.5, () => this.cb.select({ kind: 'open-goal', id: O.data.id }), O.label);
      }
    }
    return best;
  }

  private bindInput() {
    const c = this.canvas;
    const xy = (e: PointerEvent | WheelEvent) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onDown = (e: PointerEvent) => {
      this.skipArrival();
      c.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.down = this.pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 } : null;
      if (this.pointers.size === 2) { const a = [...this.pointers.values()]; this.pinch0 = Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y); this.zoom0 = this.zoomT; }
    };
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      if (e.pointerType === 'mouse') { this.pxT = ((e.clientX - r.left) / r.width - 0.5) * 2; this.pyT = ((e.clientY - r.top) / r.height - 0.5) * 2; }
      const p = this.pointers.get(e.pointerId);
      if (!p) { if (e.pointerType === 'mouse') { const { x, y } = xy(e); const hit = this.pickAt(x, y); c.classList.toggle('hot', !!hit); this.hot = hit ? hit.label : null; } return; }
      if (this.down) this.down.moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
      if (this.pointers.size === 1) { this.yawT = Math.max(-1.2, Math.min(1.2, this.yawT - (e.clientX - p.x) * 0.0045)); this.pitchT = Math.max(-0.5, Math.min(0.35, this.pitchT + (e.clientY - p.y) * 0.003)); }
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2) { const a = [...this.pointers.values()]; const d = Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y); this.zoomT = Math.max(0.6, Math.min(1.5, (this.zoom0 * this.pinch0) / Math.max(d, 1))); }
    };
    const onUp = (e: PointerEvent, cancelled: boolean) => {
      const tap = this.down && !cancelled && this.pointers.size === 1 && this.down.moved < 8 && performance.now() - this.down.t < 600;
      this.pointers.delete(e.pointerId);
      if (tap) { const { x, y } = xy(e); const hit = this.pickAt(x, y); if (hit) { this.yawT = this.yaw; this.pitchT = this.pitch; hit.act(); } }
      this.down = null;
      if (this.pointers.size < 2 && this.zoomT > 1.3) { this.zoomT = 1; this.cb.zoomOut(); }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); this.skipArrival();
      this.zoomT = Math.max(0.62, Math.min(1.45, this.zoomT * (1 + e.deltaY * 0.0012)));
      const now = performance.now();
      if (this.zoomT > 1.36 && now > this.wheelLock) { this.wheelLock = now + 1200; this.zoomT = 1; this.cb.zoomOut(); }
    };
    const onLeave = () => { this.pxT = this.pyT = 0; this.hot = null; c.classList.remove('hot'); };
    const up = (e: PointerEvent) => onUp(e, false), cancel = (e: PointerEvent) => onUp(e, true);
    c.addEventListener('pointerdown', onDown); c.addEventListener('pointermove', onMove); c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', cancel); c.addEventListener('pointerleave', onLeave); c.addEventListener('wheel', onWheel, { passive: false });
    this.cleanup.push(() => { c.removeEventListener('pointerdown', onDown); c.removeEventListener('pointermove', onMove); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', cancel); c.removeEventListener('pointerleave', onLeave); c.removeEventListener('wheel', onWheel); });
  }

  /* ---------- size ---------- */
  resize(s: Surface = measureSurface(this.canvas)) {
    this.W = s.width; this.H = s.height; this.wide = s.width >= 700;
    this.renderer.setPixelRatio(s.dpr); this.renderer.setSize(s.width, s.height, false);
    this.U.uPixel.value = s.dpr;
    this.camera.aspect = s.width / s.height; this.camera.fov = this.wide ? 46 : 58; this.camera.updateProjectionMatrix();
    this.layout();
    const v = this.viewFor(this.view);
    if (this.flight) this.flight.to = v; else this.flyTo(v, 500);
  }

  /* ---------- frame ---------- */
  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const t = now / 1000;
    this.U.uTime.value = t;
    const f = this.flight;
    if (f) {
      const k = Math.min(1, (now - f.t0) / f.dur), e = f.fn(k);
      this.cam.pos.lerpVectors(f.from.pos, f.to.pos, e).addScaledVector(UP, Math.sin(Math.PI * e) * f.lift);
      this.cam.target.lerpVectors(f.from.target, f.to.target, e);
      this.cam.sx = f.from.sx + (f.to.sx - f.from.sx) * e; this.cam.sy = f.from.sy + (f.to.sy - f.from.sy) * e;
      if (k >= 1) this.flight = null;
    }
    const damp = 1 - Math.pow(0.002, dt);
    this.yaw += (this.yawT - this.yaw) * damp; this.pitch += (this.pitchT - this.pitch) * damp; this.zoom += (this.zoomT - this.zoom) * damp;
    this.px += (this.pxT - this.px) * damp * 0.5; this.py += (this.pyT - this.py) * damp * 0.5;
    if (!this.pointers.size && this.zoomT !== 1) this.zoomT += (1 - this.zoomT) * damp * 0.35;
    const off = this.tmp1.copy(this.cam.pos).sub(this.cam.target).applyAxisAngle(UP, this.yaw);
    const right = this.tmp2.crossVectors(off, UP).normalize();
    off.applyAxisAngle(right, this.pitch).multiplyScalar(this.zoom);
    this.camera.position.copy(this.cam.target).add(off);
    const par = off.length() * (this.reduce ? 0 : 0.03);
    this.camera.position.addScaledVector(right, -this.px * par).addScaledVector(UP, this.py * par * 0.6);
    this.camera.lookAt(this.cam.target);
    if (Math.abs(this.cam.sx) > 0.0005 || Math.abs(this.cam.sy) > 0.0005) this.camera.setViewOffset(this.W, this.H, this.cam.sx * this.W, this.cam.sy * this.H, this.W, this.H); else this.camera.clearViewOffset();
    this.camera.updateMatrixWorld();

    const lv = this.view.level, close = lv === 'system' || lv === 'page' || lv === 'project', rest = lv === 'rest';
    const holding = (this.hot && this.hot.low) || (this.down && close);
    this.orbitRate += ((holding ? 0.04 : 1) - this.orbitRate) * (1 - Math.pow(0.02, dt));
    this.orbitT += dt * this.orbitRate;
    const pq = new Quaternion();
    for (const G of this.galaxies) {
      if (!this.reduce) G.disk.rotation.y += dt * 0.012;
      const ft = rest ? 0.55 : lv === 'mind' ? 1 : lv === 'galaxy' ? (this.view.galaxyId === G.data.id ? 0.85 : 0.5) : this.view.galaxyId === G.data.id ? 0.2 : 0.22;
      const u = (G.disk.material as ShaderMaterial).uniforms.uFade!; u.value += (ft - u.value) * damp * 0.6;
      (G.haze.material as ShaderMaterial).uniforms.uFade!.value = u.value;
      this.clearAround(G, lv === 'mind' ? 1.7 : 1, damp);
      (G.coreGlow.material as SpriteMaterial).opacity = 0.07 * u.value;
      const cl = (G.cloud.material as ShaderMaterial).uniforms.uFade!; cl.value += ((close ? 0.3 : rest ? 0.5 : 1) - cl.value) * damp * 0.6;
      G.motes.forEach((m) => this.drift3(m, t));
      for (const q of G.questions) {
        (q.sprite.material as SpriteMaterial).opacity = this.reduce ? 0.8 : 0.55 + 0.25 * Math.sin(t * 2.1 + 1.3) * Math.sin(t * 0.73) + 0.15 * Math.sin(t * 5.3);
        q.sprite.scale.setScalar(Math.max(2, this.camera.position.distanceTo(q.sprite.getWorldPosition(this.tmp3)) * 0.011));
      }
      for (const O of G.goals) {
        const focus = close && this.view.goalId === O.data.id;
        const starPos = O.star.getWorldPosition(new Vector3());
        // Stars stay the brightest points at every distance: their size follows the camera.
        const d = this.camera.position.distanceTo(starPos), b = (0.72 + O.data.bright * 0.28) * (O.data.quiet ? 0.8 : 1);
        O.core.scale.setScalar(Math.max(d * 0.017, Math.min(2.2, d * 0.08)) * b);
        O.halo.scale.setScalar(Math.max(d * 0.07, Math.min(9, d * 0.3)) * b);
        const hm = O.halo.material as SpriteMaterial; hm.opacity += ((0.22 + O.data.bright * 0.22) * (focus ? 1.2 : 1) - hm.opacity) * damp * 0.5;
        const fl = Math.max(d * 0.05, Math.min(5, d * 0.17)) * b;
        O.flare[0].scale.set(fl * 2.2, fl * 0.07, 1); O.flare[1].scale.set(fl * 0.07, fl * 1.4, 1);
        (O.flare[0].material as SpriteMaterial).opacity = (O.flare[1].material as SpriteMaterial).opacity = 0.35 * O.data.bright;
        for (const P of O.planets) {
          if (!P.frozen) P.pivot.rotation.y = this.reduce ? P.data.ph : P.data.ph + this.orbitT * P.data.speed * 0.35;
          ((P.mesh.material as ShaderMaterial).uniforms.uStar!.value as Vector3).copy(starPos);
          P.mesh.updateMatrixWorld(); P.mesh.getWorldQuaternion(pq);
          P.bill.quaternion.copy(pq.invert()).multiply(this.camera.quaternion);
          const om = P.orbit.material as LineBasicMaterial; om.opacity += ((focus ? 0.22 : 0) - om.opacity) * damp * 0.5;
          const near = focus || (lv === 'galaxy' && this.view.galaxyId === G.data.id);
          P.bill.visible = near; P.glowS.visible = near;
        }
        for (const M of O.moons) M.spin.rotation.y = this.reduce ? M.ph : M.ph + this.orbitT * M.sp;
      }
    }
    this.driftMotes.forEach((m) => this.drift3(m, t));
    for (let i = this.anims.length - 1; i >= 0; i--) if (!this.anims[i]!(now)) this.anims.splice(i, 1);
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  };
  private drift3(m: MoteObj, t: number) {
    const a = this.reduce ? m.ph : t * m.sp + m.ph;
    m.sprite.position.set(Math.sin(a) * m.a, Math.sin(a * 0.7 + m.ph) * m.b, Math.cos(a) * m.c);
    (m.sprite.material as SpriteMaterial).opacity = 0.65 + 0.25 * Math.sin(t * 0.8 + m.ph);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const f of this.cleanup) f();
    for (const L of this.labels) L.el.remove();
    this.scene.traverse((o) => { const m = o as Mesh; m.geometry?.dispose?.(); const mat = m.material as { dispose?: () => void } | undefined; mat?.dispose?.(); });
    this.glowTex.dispose();
    this.renderer.dispose();
  }
}
