// usage: node build.mjs in.glb out.glb cfg.json
import {NodeIO, Document} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {weld, simplify, quantize, prune, dedup} from '@gltf-transform/functions';
import {MeshoptSimplifier, MeshoptEncoder} from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import fs from 'fs';
import {Vector3} from 'three';
import {ConvexHull} from 'three/examples/jsm/math/ConvexHull.js';
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const [,, inp, outp, cfgp] = process.argv; const cfg = JSON.parse(fs.readFileSync(cfgp));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.encoder': MeshoptEncoder});
const src = await io.read(inp); const mats = src.getRoot().listMaterials();
// gather world-space triangles per group
const groups = {}; // name -> {pos:[], idx:[]}
function add(g, p, wm, a, ind){ const G = groups[g] ??= {pos:[], idx:[]}; const base = G.pos.length/3; const v=[0,0,0];
  for(let i=0;i<a.getCount();i++){ a.getElement(i,v); G.pos.push(wm[0]*v[0]+wm[4]*v[1]+wm[8]*v[2]+wm[12], wm[1]*v[0]+wm[5]*v[1]+wm[9]*v[2]+wm[13], wm[2]*v[0]+wm[6]*v[1]+wm[10]*v[2]+wm[14]); }
  const n = ind ? ind.getCount() : a.getCount(); for(let i=0;i<n;i++) G.idx.push(base + (ind ? ind.getScalar(i) : i)); }
const dim = (a, wm)=>{ let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9]; const v=[0,0,0]; for(let i=0;i<a.getCount();i++){a.getElement(i,v); const w=[wm[0]*v[0]+wm[4]*v[1]+wm[8]*v[2]+wm[12], wm[1]*v[0]+wm[5]*v[1]+wm[9]*v[2]+wm[13], wm[2]*v[0]+wm[6]*v[1]+wm[10]*v[2]+wm[14]]; for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],w[k]);mx[k]=Math.max(mx[k],w[k]);}} return {size:Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]), mn, mx}; };
let dropped = 0, culled = 0; if (cfg.bbox) cfg.inner = {mn: cfg.bbox.slice(0,3), mx: cfg.bbox.slice(3)};
for (const n of src.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; const wm = n.getWorldMatrix();
  for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'); const mi = mats.indexOf(p.getMaterial());
    if (n.getName() === 'Cube') continue;
    let g = null; for (const [name, spec] of Object.entries(cfg.groups)) { if (new RegExp(spec.name, 'i').test(n.getName()) && (spec.mat === undefined || spec.mat.includes(mi))) { g = name; break; } }
    if (!g) { const d = dim(a, wm); if (d.size < cfg.minPart && !(cfg.keep && new RegExp(cfg.keep,'i').test(n.getName()))) { dropped++; continue; } if (cfg.inner && [0,1,2].every(k => d.mn[k] > cfg.inner.mn[k] + cfg.margin && d.mx[k] < cfg.inner.mx[k] - cfg.margin)) { culled++; continue; } g = 'mat' + mi; }
    add(g, p, wm, a, p.getIndices()); } }
console.log('groups', Object.fromEntries(Object.entries(groups).map(([k,v])=>[k, v.idx.length/3])), 'dropped', dropped, 'culled', culled);
// bounds for recentre/scale
let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9]; for (const [k,G] of Object.entries(groups)) { if (k.startsWith('mat')) for(let i=0;i<G.pos.length;i+=3) for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],G.pos[i+a]);mx[a]=Math.max(mx[a],G.pos[i+a]);} }
console.log('body bbox', mn.map(Math.round), mx.map(Math.round));
for (const name of cfg.hull ?? []) { const G = groups[name]; const pts=[]; for(let i=0;i<G.pos.length;i+=3) pts.push([G.pos[i],G.pos[i+1],G.pos[i+2]]);
  const hull = new ConvexHull().setFromPoints(pts.map(p=>new Vector3(...p))); const pos=[], idx=[]; const faces=hull.faces; 
  for(const f of faces){ let e=f.edge; const base=pos.length/3; const vs=[]; do{ vs.push(e.head().point); e=e.next; }while(e!==f.edge); for(const v of vs) pos.push(v.x,v.y,v.z); for(let k=1;k<vs.length-1;k++) idx.push(base,base+k,base+k+1); }
  groups[name]={pos,idx}; console.log('hull',name,idx.length/3,'tris'); }
for (const b of cfg.boxes ?? []) { const [cx,cy,cz,sx,sy,sz]=b.box; const G = groups[b.group] ??= {pos:[],idx:[]}; const base=G.pos.length/3;
  for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1]) G.pos.push(cx+x*sx/2,cy+y*sy/2,cz+z*sz/2);
  for (const t of [[0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]]) G.idx.push(...t.map(i=>base+i)); }
const out = new Document(); const buf = out.createBuffer(); const scene = out.createScene('s');
// transform: axis map -> engine frame (+X forward, +Y up, Z across), metres, ground at y=0, centred on footprint
const fwd = cfg.forward, up = cfg.up; // e.g. "-z", "+y"
const ax = s => ({i:'xyz'.indexOf(s[1]), s: s[0]==='-'?-1:1});
const F = ax(fwd), U = ax(up); const R = [0,1,2].find(i=>i!==F.i && i!==U.i);
// right-handed: X=fwd, Y=up, Z = X cross Y => compute across axis sign so determinant +1
function det(sf,su,sr){ const m=[[0,0,0],[0,0,0],[0,0,0]]; m[0][F.i]=sf; m[1][U.i]=su; m[2][R]=sr; return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]); }
const sr = det(F.s,U.s,1) > 0 ? 1 : -1;
const cF=(mn[F.i]+mx[F.i])/2, cR=(mn[R]+mx[R])/2, base = cfg.groundY ?? (U.s>0?mn[U.i]:mx[U.i]);
const lenMm = (mx[F.i]-mn[F.i]); const k = cfg.length / lenMm; console.log('scale', k, 'width m', (mx[R]-mn[R])*k, 'height m', (mx[U.i]-mn[U.i])*k);
const colorOf = cfg.colors; 
for (const [name, G] of Object.entries(groups)) {
  const P = new Float32Array(G.pos.length);
  for (let i=0;i<G.pos.length;i+=3){ const p=[G.pos[i],G.pos[i+1],G.pos[i+2]]; P[i]=(p[F.i]-cF)*F.s*k; P[i+1]=(p[U.i]-base)*U.s*k; P[i+2]=(p[R]-cR)*sr*k; }
  const idx = new Uint32Array(G.idx);
  const acc = out.createAccessor().setType('VEC3').setArray(P).setBuffer(buf); const ia = out.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buf);
  const mat = out.createMaterial(name).setBaseColorFactor(colorOf[name] ?? (name.startsWith('mat') ? mats[+name.slice(3)].getBaseColorFactor() : [0.5,0.5,0.5,1])).setRoughnessFactor(0.6).setMetallicFactor(0);
  const prim = out.createPrimitive().setAttribute('POSITION', acc).setIndices(ia).setMaterial(mat);
  const mesh = out.createMesh(name).addPrimitive(prim); const node = out.createNode(name).setMesh(mesh); scene.addChild(node); }
await out.transform(weld({tolerance: cfg.weld}), simplify({simplifier: MeshoptSimplifier, ratio: cfg.ratio, error: cfg.error, lockBorder:!!cfg.lockBorder}), prune(), dedup(), quantize({quantizePosition: 12}));
out.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE});
await io.write(outp, out); let tr=0; for (const m of out.getRoot().listMeshes()) for (const p of m.listPrimitives()) tr += p.getIndices().getCount()/3;
console.log('out tris', tr, 'bytes', fs.statSync(outp).size);
