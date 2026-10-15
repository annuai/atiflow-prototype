import * as THREE from 'three';
import { log } from '@/platform';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ROBOT_TYPES, DEFAULT_ROBOT_TYPE, type RobotTypeId } from '../data/robotTypes';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export interface RobotModelDef {
  footprint: [number, number];
  build(): { group: THREE.Group; light: THREE.Mesh };
}

// Ati Robotics Sherpa look (from the supplied side illustration + KeyShot render):
// yellow hip-roofed body, black bumper skirt, dark roof plate, lidar mast with orange beacon,
// exposed grey front wheels, D-shaped side door, vent slits, red e-stop, black front panel with green lights.
const M = {
  yellow: new THREE.MeshStandardMaterial({ color: 0xfcd900, roughness: 0.42, metalness: 0.05 }),
  black: new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.55 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1a2024, roughness: 0.2, metalness: 0.4 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x6f6f6f, roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
  orange: new THREE.MeshStandardMaterial({
    color: 0xf58a1f,
    roughness: 0.35,
    emissive: 0xf58a1f,
    emissiveIntensity: 0.55,
  }),
  red: new THREE.MeshStandardMaterial({ color: 0xee3a24, roughness: 0.4, emissive: 0xee3a24, emissiveIntensity: 0.4 }),
  green: new THREE.MeshBasicMaterial({ color: 0x4ade80 }),
};
const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 24) };

let decalTex: THREE.CanvasTexture | null = null;
function decal() {
  if (decalTex) return decalTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#111';
  x.font = '700 64px Blinker, Arial, sans-serif';
  x.textBaseline = 'middle';
  x.fillText('Ati', 8, 64);
  x.font = '700 30px Blinker, Arial, sans-serif';
  x.fillText('SHERPA', 130, 38);
  x.fillText('XT LITE', 130, 88);
  decalTex = new THREE.CanvasTexture(c);
  decalTex.colorSpace = THREE.SRGBColorSpace;
  return decalTex;
}

function part(
  g: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  scale: [number, number, number],
  cast = false,
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.castShadow = cast;
  g.add(m);
  return m;
}

/** Local frame: +X forward, +Y up, Z across. Ground at y = 0. */
function sherpa(L: number, W: number, opts: { tug?: boolean } = {}) {
  const g = new THREE.Group();
  const SK = 0.12,
    SK0 = 0.04; // skirt height / ground clearance
  const BH = 0.4,
    BY = SK0 + SK; // lower body height / bottom
  const roofH = 0.15,
    roofY = BY + BH;

  part(g, GEO.box, M.black, [0, SK0 + SK / 2, 0], [L, SK, W], true); // bumper skirt
  const led = part(
    g,
    GEO.box,
    new THREE.MeshBasicMaterial({ color: 0x14b8a6, transparent: true }),
    [0, SK0 + SK + 0.008, 0],
    [L * 1.01, 0.016, W * 1.01],
  ); // state LED band
  const body = new THREE.Mesh(new RoundedBoxGeometry(L * 0.985, BH, W * 0.985, 3, 0.035), M.yellow);
  body.position.y = BY + BH / 2;
  body.castShadow = true;
  g.add(body);

  const roofGeo = new THREE.CylinderGeometry(Math.SQRT2 * 0.5, Math.SQRT2, roofH, 4, 1);
  roofGeo.rotateY(Math.PI / 4); // square frustum, half-extent 1 at base
  const roof = new THREE.Mesh(roofGeo, M.yellow);
  roof.scale.set((L / 2) * 0.985, 1, (W / 2) * 0.985);
  roof.position.y = roofY + roofH / 2;
  roof.castShadow = true;
  g.add(roof);
  part(g, GEO.box, M.glass, [0, roofY + roofH + 0.014, 0], [L * 0.5, 0.028, W * 0.5], true); // dark roof plate

  // lidar mast + beacon
  const my = roofY + roofH + 0.028;
  part(g, GEO.box, M.white, [0.068, my + 0.075, 0], [0.012, 0.15, 0.012]);
  part(g, GEO.box, M.white, [-0.068, my + 0.075, 0], [0.012, 0.15, 0.012]);
  part(g, GEO.box, M.black, [0, my + 0.07, 0], [0.075, 0.06, 0.075]);
  part(g, GEO.box, M.black, [0, my + 0.155, 0], [0.19, 0.01, 0.19]);
  part(g, GEO.cyl, M.black, [0, my + 0.185, 0], [0.032, 0.05, 0.032]);
  part(g, GEO.cyl, M.orange, [0, my + 0.225, 0], [0.032, 0.04, 0.032]);

  // front panel (black, green lights, Ati mark)
  part(g, GEO.box, M.black, [(L / 2) * 0.985 + 0.002, BY + BH * 0.5, 0], [0.01, BH * 0.78, W * 0.8]);
  part(g, GEO.box, M.green, [(L / 2) * 0.985 + 0.009, BY + BH * 0.8, W * 0.27], [0.004, 0.025, 0.16]);
  part(g, GEO.box, M.green, [(L / 2) * 0.985 + 0.009, BY + BH * 0.8, -W * 0.27], [0.004, 0.025, 0.16]);
  part(g, GEO.box, M.white, [(L / 2) * 0.985 + 0.009, BY + BH * 0.42, 0], [0.004, 0.035, 0.08]);

  for (const s of [1, -1]) {
    const zs = s * ((W / 2) * 0.985 + 0.002);
    part(g, GEO.box, M.black, [L * 0.16, BY + 0.2, zs], [L * 0.24, 0.31, 0.008]); // door frame
    part(g, GEO.box, M.yellow, [L * 0.16, BY + 0.2, zs + s * 0.002], [L * 0.215, 0.285, 0.008]); // door
    part(g, GEO.box, M.black, [L * 0.17, BY + 0.2, zs + s * 0.006], [0.03, 0.1, 0.006]); // handle
    for (const f of [0.45, 0.34, -0.36, -0.46])
      part(g, GEO.box, M.black, [L * f, BY + 0.27, zs], [0.026, 0.075, 0.008]); // vent slits
    const e = part(g, GEO.cyl, M.red, [0, roofY + roofH * 0.55, s * W * 0.34], [0.022, 0.016, 0.022]);
    e.rotation.x = Math.PI / 2 - s * 0.45; // e-stop on roof slope
    const dc = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.085),
      new THREE.MeshBasicMaterial({ map: decal(), transparent: true }),
    );
    dc.position.set(-L * 0.17, BY + 0.14, zs + s * 0.006);
    if (s < 0) dc.rotation.y = Math.PI;
    g.add(dc);
    for (const x of [L * 0.34, -L * 0.27]) {
      // wheels (front pair exposed)
      const t = part(g, GEO.cyl, M.tire, [x, 0.115, s * (W / 2 - 0.035)], [0.115, 0.07, 0.115], true);
      t.rotation.x = Math.PI / 2;
      const h = part(g, GEO.cyl, M.black, [x, 0.115, s * (W / 2 - 0.0)], [0.04, 0.075, 0.04]);
      h.rotation.x = Math.PI / 2;
    }
  }
  if (opts.tug) part(g, GEO.box, M.black, [-L / 2 - 0.05, 0.14, 0], [0.12, 0.05, 0.22]); // tow hitch plate
  return { group: g, light: led };
}

// ---- simplified CAD models (public/models/robots/*.glb, made by tools/glb-compress) -----------------------------
// Each file is a few meshes: `mat1` (dark parts), `mat2`/`mat3` (body), `light_status` (the vehicle's own status lights: diffusers + beacon)
// and `light_red` (its red warning lights). The status lights take the robot's state colour; they replace the LED band of the procedural body.
const loaded: Record<string, THREE.Group> = {};
const RED_LIGHT = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

/** Fetches the model files once. Models that fail to load keep the procedural body. */
export function loadRobotModels(): Promise<void> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return Promise.all(
    ROBOT_TYPES.filter((t) => !t.placeholder).map(async ({ id: key }) => {
      const file = `${key}.glb`;
      try {
        const { scene } = await loader.loadAsync(`${import.meta.env.BASE_URL}models/robots/${file}`);
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          if (m.name === 'light_red') m.material = RED_LIGHT;
          else if (m.name !== 'light_status') {
            const c = (m.material as THREE.MeshStandardMaterial).color;
            m.material = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, flatShading: true });
            m.castShadow = true;
          }
        });
        loaded[key] = scene;
      } catch (e) {
        log.child('robot-models').warn(`robot model ${file} not loaded, using the procedural body`, e);
      }
    }),
  ).then(() => undefined);
}

function fromGlb(key: string) {
  const group = loaded[key].clone(true);
  const mat = new THREE.MeshBasicMaterial({ color: 0x14b8a6, transparent: true }); // one per robot: the engine tints it with the robot's state
  let light!: THREE.Mesh;
  group.traverse((o) => {
    if (o.name === 'light_status') {
      (o as THREE.Mesh).material = mat;
      light = o as THREE.Mesh;
    }
  });
  return { group, light };
}

/** 3D side of each robot type of the catalog (`data/robotTypes.ts`): footprint and body. */
export const ROBOT_MODELS: Record<RobotTypeId, RobotModelDef> = {
  // types without a model of their own yet (placeholders) get the generic Sherpa body
  ...(Object.fromEntries(
    ROBOT_TYPES.filter((t) => t.placeholder).map((t) => [
      t.id,
      { footprint: [1.2, 0.85], build: () => sherpa(1.2, 0.85) } as RobotModelDef,
    ]),
  ) as Record<RobotTypeId, RobotModelDef>),
  'sherpa-xt-lite': {
    footprint: [1.2, 0.85],
    build: () => (loaded['sherpa-xt-lite'] ? fromGlb('sherpa-xt-lite') : sherpa(1.2, 0.85)),
  },
  'pallet-mover': {
    footprint: [1.45, 0.9],
    build: () => (loaded['pallet-mover'] ? fromGlb('pallet-mover') : sherpa(1.45, 0.9, { tug: true })),
  },
};
export const DEFAULT_MODEL: RobotTypeId = DEFAULT_ROBOT_TYPE.id;

// ---- trolley (towed cart) ---------------------------------------------------------------------------------
// Local frame like the robot: +X points at the robot (front of the trolley), ground at y = 0. Footprint 1.1 x 0.7 m; the drawbar reaches the robot's rear hitch.
const T = {
  frame: new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.6, metalness: 0.3 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x59636f, roughness: 0.7 }),
  rail: new THREE.MeshStandardMaterial({ color: 0xfcd900, roughness: 0.5 }),
  cardboard: new THREE.MeshStandardMaterial({ color: 0xc89a5f, roughness: 0.85 }),
  tote: new THREE.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.6 }),
  tray: new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 }),
  reel: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.5 }),
};
const trolleyCache = new Map<string, THREE.Group>();
/** A material trolley carrying `qty` units of `kind` ('PCBA tray' = stacked ESD trays, 'Reel box' = component reels, anything else = cartons). Built once per kind/qty and cloned (geometry and materials are shared). */
export function buildTrolley(kind: string, qty = 3): THREE.Group {
  const n = Math.max(1, Math.min(6, Math.round(qty / 1.7))); // 1..6 stacked units
  const key = `${kind}|${n}`;
  const cached = trolleyCache.get(key);
  if (cached) return cached.clone();
  const g = new THREE.Group();
  const L = 1.1,
    W = 0.7,
    deckY = 0.15;
  part(g, GEO.box, T.frame, [0, deckY - 0.025, 0], [L, 0.05, W], true); // chassis
  part(g, GEO.box, T.deck, [0, deckY + 0.008, 0], [L - 0.06, 0.016, W - 0.06]); // deck plate
  for (const sx of [1, -1])
    for (const sz of [1, -1]) {
      const w = part(g, GEO.cyl, M.tire, [sx * (L / 2 - 0.12), 0.07, sz * (W / 2 - 0.05)], [0.07, 0.05, 0.07], true);
      w.rotation.x = Math.PI / 2; // caster wheels
      part(g, GEO.box, T.frame, [sx * (L / 2 - 0.12), 0.115, sz * (W / 2 - 0.05)], [0.07, 0.03, 0.05]);
    }
  part(g, GEO.box, T.frame, [L / 2 + 0.12, deckY + 0.01, 0], [0.26, 0.025, 0.04]); // drawbar to the robot's hitch
  part(g, GEO.box, T.frame, [L / 2 + 0.01, deckY + 0.02, 0.12], [0.02, 0.02, 0.2]);
  part(g, GEO.box, T.frame, [L / 2 + 0.01, deckY + 0.02, -0.12], [0.02, 0.02, 0.2]);
  for (const sz of [1, -1])
    part(g, GEO.box, T.rail, [-0.02, deckY + 0.12, sz * (W / 2 - 0.02)], [L - 0.2, 0.014, 0.014]); // side rails
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const)
    part(g, GEO.box, T.rail, [sx * (L / 2 - 0.06), deckY + 0.07, sz * (W / 2 - 0.02)], [0.014, 0.12, 0.014]); // posts
  part(g, GEO.box, T.rail, [-L / 2 + 0.03, deckY + 0.3, 0], [0.014, 0.014, W - 0.04]);
  for (const sz of [1, -1])
    part(g, GEO.box, T.rail, [-L / 2 + 0.03, deckY + 0.17, sz * (W / 2 - 0.02)], [0.014, 0.3, 0.014]); // push handle at the back
  // load
  const slots: [number, number][] = [
    [0.22, 0.17],
    [0.22, -0.17],
    [-0.2, 0.17],
    [-0.2, -0.17],
    [0.0, 0.0],
    [-0.4, 0.0],
  ];
  for (let i = 0; i < n; i++) {
    const [x, z] = slots[i % slots.length];
    const layer = Math.floor(i / slots.length);
    const y0 = deckY + 0.016 + layer * 0.2;
    if (kind === 'PCBA tray') {
      for (let k = 0; k < 4; k++)
        part(g, GEO.box, k % 2 ? T.tray : T.tote, [x, y0 + 0.03 + k * 0.05, z], [0.4, 0.04, 0.3], true);
    } else if (kind === 'Reel box') {
      for (let k = 0; k < 2; k++) {
        const r = part(g, GEO.cyl, T.reel, [x, y0 + 0.1 + k * 0.001, z + (k ? 0.0 : 0)], [0.15, 0.04, 0.15], true);
        r.rotation.x = Math.PI / 2;
        r.position.y = y0 + 0.15;
        r.position.z = z + (k ? 0.045 : -0.045);
      }
      part(g, GEO.box, T.cardboard, [x, y0 + 0.02, z], [0.34, 0.04, 0.3]);
    } else {
      part(g, GEO.box, T.cardboard, [x, y0 + 0.1, z], [0.36, 0.2, 0.3], true);
      part(g, GEO.box, M.white, [x, y0 + 0.202, z], [0.12, 0.003, 0.3]);
    } // carton with tape
  }
  trolleyCache.set(key, g);
  return g.clone();
}

/**
 * The robot as seen from above, drawn once on a canvas (the plan / 2D view): Ati yellow body, black bumper skirt, dark roof plate, lidar mast with orange beacon,
 * red e-stop and the black front panel with its green lights, like the 3D model. The front points to +x (right) and fills the whole canvas.
 */
let planTexture: THREE.CanvasTexture | null = null;
export function robotPlanTexture(): THREE.CanvasTexture {
  if (planTexture) return planTexture;
  const W = 512,
    H = 362;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rr = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fillStyle = fill;
    g.fill();
  };
  const dot = (x: number, y: number, r: number, fill: string) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  rr(0, 0, W, H, 34, '#17181a'); // bumper skirt
  rr(16, 16, W - 32, H - 32, 26, '#fcd900'); // yellow body
  rr(W * 0.05 + 10, H * 0.2, W * 0.44, H * 0.6, 18, '#2a2c2f'); // dark roof plate (rear)
  rr(W * 0.58, H * 0.14, W * 0.16, H * 0.72, 12, '#e6c400'); // roof ridge towards the nose
  rr(W * 0.8, H * 0.2, W * 0.15, H * 0.6, 14, '#17181a'); // front panel
  dot(W * 0.875, H * 0.36, 11, '#34d058');
  dot(W * 0.875, H * 0.64, 11, '#34d058'); // its lights
  dot(W * 0.27, H * 0.5, 26, '#111214');
  dot(W * 0.27, H * 0.5, 15, '#ff8a1f'); // lidar mast with the orange beacon
  dot(W * 0.12, H * 0.28, 11, '#e11d2e'); // e-stop
  for (let i = 0; i < 3; i++) rr(W * 0.56 + i * 14, H * 0.9 - 6, 8, 12, 3, '#9a8300'); // vent slits on the side
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return (planTexture = t);
}
