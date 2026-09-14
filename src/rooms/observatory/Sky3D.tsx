import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { hashString, mulberry32 } from '@/lib/rng';
import type { Goal, Project } from '@/types';
import { ORBIT_SQUASH, ORBIT_SPEED, resolvePositions, skyTime, type SkyLayout } from './layout';

/**
 * The dome: a lazy-loaded WebGL layer drawn *behind* the 2D sky canvas.
 * It owns depth (distant stars, drifting dust, parallax), the glow of goal
 * and project stars, and the orbital traces. The 2D canvas on top keeps
 * drawing lines, labels, click targets, and the accessible alternative.
 *
 * Everything is procedural: no textures, no models. Bloom is faked with
 * additive halos rather than a post-processing pass, to stay light.
 */

export interface Sky3DProps {
  layout: SkyLayout;
  goals: Goal[];
  projects: Project[];
  litGoalId: string | null;
  selectedGoalId: string | null;
  pointerRef: RefObject<{ x: number; y: number }>;
  onReady: () => void;
  onPoorPerformance: () => void;
  onContextLost: () => void;
}

const GOLD = new THREE.Color('#c9a961');
const PARCHMENT = new THREE.Color('#e8dcc4');
const PARCHMENT_DIM = new THREE.Color('#a89f8c');
const VERDIGRIS = new THREE.Color('#5e8b6e');

export default function Sky3D(props: Sky3DProps) {
  return (
    <Canvas
      className="sky3d"
      orthographic
      camera={{ position: [0, 0, 500], near: 0.1, far: 2000, zoom: 1 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: false, powerPreference: 'low-power', premultipliedAlpha: true, preserveDrawingBuffer: import.meta.env.DEV }}
      frameloop="always"
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); props.onContextLost(); }, { once: true });
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}

function Scene(props: Sky3DProps) {
  const parallax = useRef(new THREE.Vector2(0, 0));
  useFrame(() => {
    const p = props.pointerRef.current ?? { x: 0.5, y: 0.5 };
    parallax.current.x += ((p.x - 0.5) - parallax.current.x) * 0.04;
    parallax.current.y += ((0.5 - p.y) - parallax.current.y) * 0.04;
  });
  return (
    <>
      <DistantStars parallax={parallax} />
      <Dust parallax={parallax} />
      <OrbitTraces layout={props.layout} litGoalId={props.litGoalId} />
      <ProjectStars layout={props.layout} projects={props.projects} litGoalId={props.litGoalId} />
      {props.layout.goals.map((gn) => {
        const goal = props.goals.find((g) => g.id === gn.id);
        if (!goal) return null;
        return (
          <GoalStar
            key={gn.id}
            x={gn.x} y={gn.y}
            projectCount={gn.projectIds.length}
            dormant={goal.state === 'dormant'}
            lit={props.litGoalId === gn.id}
            selected={props.selectedGoalId === gn.id}
          />
        );
      })}
      <PerfGuard onReady={props.onReady} onPoor={props.onPoorPerformance} />
    </>
  );
}

/* ---------- helpers ---------- */

function useWorld() {
  const size = useThree((s) => s.size);
  return { w: size.width, h: size.height, toWorld: (x: number, y: number) => [x - size.width / 2, size.height / 2 - y] as const };
}

const SOFT_POINT_FRAG = `
  uniform vec3 uColor;
  uniform float uTime;
  varying float vAlpha;
  varying float vTwinkle;
  varying float vPhase;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float disc = smoothstep(1.0, 0.15, d);
    float tw = 0.78 + 0.22 * sin(uTime * vTwinkle + vPhase);
    float a = disc * vAlpha * tw;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/* ---------- distant stars ---------- */

function DistantStars({ parallax }: { parallax: RefObject<THREE.Vector2> }) {
  const { w, h } = useWorld();
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const rng = mulberry32(hashString('dome-stars'));
    const n = Math.max(120, Math.min(420, Math.floor((w * h) / 3200)));
    const pos = new Float32Array(n * 3), size = new Float32Array(n), depth = new Float32Array(n), phase = new Float32Array(n), tw = new Float32Array(n), alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const d = rng();                                  // 0 far … 1 near
      pos[i * 3] = rng() - 0.5; pos[i * 3 + 1] = rng() - 0.5; pos[i * 3 + 2] = -600 + d * 300;
      const bright = rng();
      size[i] = (0.9 + d * 1.3) * (bright > 0.92 ? 1.9 : 1);
      depth[i] = d; phase[i] = rng() * Math.PI * 2; tw[i] = 0.4 + rng() * 1.4;
      alpha[i] = (0.26 + rng() * 0.5) * (0.6 + d * 0.4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aTwinkle', new THREE.BufferAttribute(tw, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    return g;
  }, [w, h]);
  useEffect(() => () => geo.dispose(), [geo]);

  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color('#d8cdb6') }, uTime: { value: 0 }, uSize: { value: new THREE.Vector2(w, h) }, uParallax: { value: new THREE.Vector2() }, uDpr: { value: 1 },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime!.value = skyTime();
    mat.current.uniforms.uSize!.value.set(w, h);
    mat.current.uniforms.uParallax!.value.copy(parallax.current!);
    mat.current.uniforms.uDpr!.value = state.viewport.dpr;
  });
  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={mat}
        transparent depthWrite={false} blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float aSize; attribute float aDepth; attribute float aPhase; attribute float aTwinkle; attribute float aAlpha;
          uniform vec2 uSize; uniform vec2 uParallax; uniform float uDpr;
          varying float vAlpha; varying float vTwinkle; varying float vPhase;
          void main() {
            vec2 p = position.xy * (uSize + 60.0) + uParallax * (6.0 + aDepth * 22.0);
            vec4 mv = modelViewMatrix * vec4(p, position.z, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (aSize * 2.8 + 1.4) * uDpr;
            vAlpha = aAlpha; vTwinkle = aTwinkle; vPhase = aPhase;
          }
        `}
        fragmentShader={SOFT_POINT_FRAG}
      />
    </points>
  );
}

/* ---------- drifting dust ---------- */

function Dust({ parallax }: { parallax: RefObject<THREE.Vector2> }) {
  const { w, h } = useWorld();
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const rng = mulberry32(hashString('dome-dust'));
    const n = Math.max(30, Math.min(110, Math.floor((w * h) / 12_000)));
    const pos = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n), alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rng() - 0.5; pos[i * 3 + 1] = rng() - 0.5; pos[i * 3 + 2] = -40 - rng() * 120;
      size[i] = 1.4 + rng() * 2.6; phase[i] = rng() * Math.PI * 2; alpha[i] = 0.05 + rng() * 0.1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    return g;
  }, [w, h]);
  useEffect(() => () => geo.dispose(), [geo]);
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color('#e8dcc4') }, uTime: { value: 0 }, uSize: { value: new THREE.Vector2(w, h) }, uParallax: { value: new THREE.Vector2() }, uDpr: { value: 1 },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime!.value = skyTime();
    mat.current.uniforms.uSize!.value.set(w, h);
    mat.current.uniforms.uParallax!.value.copy(parallax.current!);
    mat.current.uniforms.uDpr!.value = state.viewport.dpr;
  });
  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={mat}
        transparent depthWrite={false} blending={THREE.NormalBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float aSize; attribute float aPhase; attribute float aAlpha;
          uniform vec2 uSize; uniform vec2 uParallax; uniform float uDpr; uniform float uTime;
          varying float vAlpha; varying float vTwinkle; varying float vPhase;
          void main() {
            vec2 wander = vec2(sin(uTime * 0.06 + aPhase), cos(uTime * 0.045 + aPhase * 1.7)) * 26.0;
            vec2 p = position.xy * (uSize + 80.0) + wander + uParallax * 40.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, position.z, 1.0);
            gl_PointSize = aSize * uDpr;
            vAlpha = aAlpha; vTwinkle = 0.3; vPhase = aPhase;
          }
        `}
        fragmentShader={SOFT_POINT_FRAG}
      />
    </points>
  );
}

/* ---------- goal stars ---------- */

const GLOW_FRAG = `
  uniform vec3 uCore; uniform vec3 uHalo; uniform float uHaloStrength; uniform float uCoreStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float core = exp(-d * d * 90.0) * uCoreStrength;
    float inner = exp(-d * d * 14.0) * 0.55 * uHaloStrength;
    float halo = exp(-d * 3.1) * 0.28 * uHaloStrength;
    vec3 c = uCore * core + uHalo * (inner + halo);
    float a = core + inner + halo;
    gl_FragColor = vec4(c, a);
  }
`;

function GoalStar({ x, y, projectCount, dormant, lit, selected }: { x: number; y: number; projectCount: number; dormant: boolean; lit: boolean; selected: boolean }) {
  const { w, h, toWorld } = useWorld();
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const ring = useRef<THREE.Line>(null);
  const ring2 = useRef<THREE.Line>(null);
  const r = 3.2 + Math.min(projectCount, 5) * 0.7;
  const uniforms = useMemo(() => ({
    uCore: { value: PARCHMENT.clone() }, uHalo: { value: GOLD.clone() }, uHaloStrength: { value: 1 }, uCoreStrength: { value: 1 },
  }), []);
  const cur = useRef({ halo: 0.6, core: 1, scale: 1 });

  const arcGeo = useMemo(() => arc(r + 9, 0, Math.PI * 1.5, 48), [r]);
  const ring2Geo = useMemo(() => arc(r + 20, 0, Math.PI * 2, 72), [r]);
  useEffect(() => () => { arcGeo.dispose(); ring2Geo.dispose(); }, [arcGeo, ring2Geo]);

  useFrame(() => {
    if (!mesh.current || !mat.current) return;
    const t = skyTime();
    const [wx, wy] = toWorld(x * w, y * h);
    const targetHalo = dormant ? 0.18 : lit ? 1.0 : 0.55;
    const targetCore = dormant ? 0.45 : 1;
    const breathe = lit ? 1 + 0.05 * Math.sin(t * 0.9) : 1;
    const c = cur.current;
    c.halo += (targetHalo - c.halo) * 0.06;
    c.core += (targetCore - c.core) * 0.06;
    c.scale += (breathe - c.scale) * 0.1;
    const haloR = r * (lit ? 12 : 9);
    mesh.current.position.set(wx, wy, -5);
    mesh.current.scale.setScalar(haloR * 2 * c.scale);
    mat.current.uniforms.uHaloStrength!.value = c.halo;
    mat.current.uniforms.uCoreStrength!.value = c.core;
    mat.current.uniforms.uHalo!.value.copy(lit ? GOLD : dormant ? PARCHMENT_DIM : GOLD);
    mat.current.uniforms.uCore!.value.copy(dormant ? PARCHMENT_DIM : lit ? PARCHMENT : PARCHMENT);
    if (ring.current) {
      ring.current.position.set(wx, wy, -4);
      ring.current.rotation.z = t * 0.18;
      ring.current.visible = selected;
      (ring.current.material as THREE.LineBasicMaterial).opacity = 0.5 + 0.15 * Math.sin(t * 0.9);
    }
    if (ring2.current) {
      ring2.current.position.set(wx, wy, -4);
      ring2.current.visible = selected;
      ring2.current.scale.setScalar(1 + 0.03 * Math.sin(t * 0.45));
      (ring2.current.material as THREE.LineBasicMaterial).opacity = 0.14 + 0.06 * Math.sin(t * 0.45 + 1);
    }
  });

  return (
    <group>
      <mesh ref={mesh}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={mat}
          transparent depthWrite={false} blending={THREE.AdditiveBlending}
          uniforms={uniforms}
          vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
          fragmentShader={GLOW_FRAG}
        />
      </mesh>
      {/* @ts-expect-error three's <line> is the primitive here, not the SVG element */}
      <line ref={ring} geometry={arcGeo}><lineBasicMaterial color={GOLD} transparent opacity={0.5} depthWrite={false} /></line>
      {/* @ts-expect-error see above */}
      <line ref={ring2} geometry={ring2Geo}><lineBasicMaterial color={GOLD} transparent opacity={0.15} depthWrite={false} /></line>
    </group>
  );
}

function arc(radius: number, from: number, to: number, segments: number, squash = 1): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = from + (to - from) * (i / segments);
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * squash, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/* ---------- orbital traces ---------- */

function OrbitTraces({ layout, litGoalId }: { layout: SkyLayout; litGoalId: string | null }) {
  const { w, h, toWorld } = useWorld();
  const minDim = Math.min(w, h);
  const group = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Line>(null);
  const trailGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(Array.from({ length: 20 }, () => new THREE.Vector3())), []);
  useEffect(() => () => trailGeo.dispose(), [trailGeo]);
  const rings = useMemo(() => layout.goals.filter((g) => g.projectIds.length > 0).map((g) => ({ id: g.id, x: g.x, y: g.y, geo: arc(1, 0, Math.PI * 2, 96, ORBIT_SQUASH), orbit: g.orbit })), [layout]);
  useEffect(() => () => rings.forEach((r) => r.geo.dispose()), [rings]);

  useFrame(() => {
    if (!group.current) return;
    const t = skyTime();
    group.current.children.forEach((child, i) => {
      const ring = rings[i]; if (!ring) return;
      const [wx, wy] = toWorld(ring.x * w, ring.y * h);
      child.position.set(wx, wy, -8);
      child.scale.setScalar(ring.orbit * minDim);
      const m = (child as THREE.Line).material as THREE.LineBasicMaterial;
      const target = litGoalId === ring.id ? 0.3 : 0.09;
      m.opacity += (target - m.opacity) * 0.08;
    });
    // A short trailing arc behind each project of the lit goal.
    if (trail.current) {
      const gn = litGoalId ? layout.byId.get(litGoalId) : undefined;
      if (gn && gn.kind === 'goal' && gn.projectIds.length) {
        const pn = layout.projects.find((p) => p.id === gn.projectIds[0]);
        if (pn) {
          const [wx, wy] = toWorld(gn.x * w, gn.y * h);
          const orbit = gn.orbit * minDim;
          const a0 = pn.angle + t * ORBIT_SPEED;
          const pos = trailGeo.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < 20; i++) {
            const a = a0 - (i / 19) * 0.9;
            pos.setXYZ(i, wx + Math.cos(a) * orbit, wy - Math.sin(a) * orbit * ORBIT_SQUASH, -7);
          }
          pos.needsUpdate = true;
          trail.current.visible = true;
          return;
        }
      }
      trail.current.visible = false;
    }
  });

  return (
    <>
      <group ref={group}>
        {rings.map((r) => (
          /* @ts-expect-error three primitive */
          <line key={r.id} geometry={r.geo}><lineBasicMaterial color={GOLD} transparent opacity={0.09} depthWrite={false} /></line>
        ))}
      </group>
      {/* @ts-expect-error three primitive */}
      <line ref={trail} geometry={trailGeo}><lineBasicMaterial color={GOLD} transparent opacity={0.28} depthWrite={false} /></line>
    </>
  );
}

/* ---------- project stars ---------- */

function ProjectStars({ layout, projects, litGoalId }: { layout: SkyLayout; projects: Project[]; litGoalId: string | null }) {
  const { w, h, toWorld } = useWorld();
  const mat = useRef<THREE.ShaderMaterial>(null);
  const n = layout.projects.length;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(n, 1) * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(Math.max(n, 1)), 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(Math.max(n, 1) * 3), 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(Math.max(n, 1)), 1));
    return g;
  }, [n]);
  useEffect(() => () => geo.dispose(), [geo]);
  const uniforms = useMemo(() => ({ uDpr: { value: 1 } }), []);

  useFrame((state) => {
    const t = skyTime();
    const res = resolvePositions(layout, w, h, t);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const size = geo.attributes.aSize as THREE.BufferAttribute;
    const col = geo.attributes.aColor as THREE.BufferAttribute;
    const alpha = geo.attributes.aAlpha as THREE.BufferAttribute;
    const byId = new Map(projects.map((p) => [p.id, p]));
    layout.projects.forEach((pn, i) => {
      const p = res.projects.get(pn.id)!;
      const pr = byId.get(pn.id);
      const [wx, wy] = toWorld(p.x, p.y);
      pos.setXYZ(i, wx, wy, -3);
      const progress = pr?.progress ?? 0;
      size.setX(i, (1.8 + progress * 2.2) * 2 + 16);
      const c = pr?.status === 'done' ? VERDIGRIS : pr?.status === 'paused' ? PARCHMENT_DIM : PARCHMENT;
      col.setXYZ(i, c.r, c.g, c.b);
      const lit = litGoalId !== null && (pn.goalId === litGoalId || (pr?.goalIds.includes(litGoalId) ?? false));
      let a = pr?.status === 'idea' ? 0.45 : pr?.status === 'paused' ? 0.6 : 0.85;
      if (!pn.goalId) a *= 0.6;
      alpha.setX(i, lit ? Math.min(1, a + 0.15) : a * 0.8);
    });
    pos.needsUpdate = size.needsUpdate = col.needsUpdate = alpha.needsUpdate = true;
    if (mat.current) mat.current.uniforms.uDpr!.value = state.viewport.dpr;
  });
  if (n === 0) return null;
  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={mat}
        transparent depthWrite={false} blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float aSize; attribute vec3 aColor; attribute float aAlpha; uniform float uDpr;
          varying vec3 vColor; varying float vAlpha;
          void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uDpr; vColor = aColor; vAlpha = aAlpha; }
        `}
        fragmentShader={`
          varying vec3 vColor; varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float core = exp(-d * d * 14.0);
            float halo = exp(-d * 3.2) * 0.45;
            float a = (core + halo) * vAlpha;
            gl_FragColor = vec4(vColor * a, a);
          }
        `}
      />
    </points>
  );
}

/* ---------- performance guard ---------- */

function PerfGuard({ onReady, onPoor }: { onReady: () => void; onPoor: () => void }) {
  const frames = useRef(0);
  const slow = useRef(0);
  const started = useRef(performance.now());
  const readyFired = useRef(false);
  useFrame((_, delta) => {
    frames.current++;
    if (!readyFired.current && frames.current >= 2) { readyFired.current = true; onReady(); }
    const since = performance.now() - started.current;
    if (since < 800 || since > 5000) return;             // warm-up, then stop sampling
    if (delta > 0.5 || document.hidden) return;           // tab is or was hidden; timers are throttled
    if (delta > 1 / 26) slow.current++;
    if (slow.current > 45) onPoor();                      // ~2s of sub-26fps within the window
  });
  return null;
}
