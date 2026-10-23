import * as THREE from 'three';

/** A rounded-rectangle path. `CanvasRenderingContext2D.roundRect` is missing in Safari before 16 (and older browsers): there, one missing method would stop the whole 3D scene from being built, so draw the corners ourselves. */
export function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') return ctx.roundRect(x, y, w, h, r);
  const k = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}
export function labelSprite(text: string, opts: { color?: string; bg?: string; size?: number } = {}) {
  const size = opts.size ?? 56;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = `600 ${size}px Blinker, system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + size;
  c.width = w;
  c.height = size * 1.7;
  ctx.font = `600 ${size}px Blinker, system-ui, sans-serif`;
  ctx.fillStyle = opts.bg ?? 'rgba(15,27,36,.82)';
  const r = size * 0.45;
  const h = c.height;
  ctx.beginPath();
  roundedRectPath(ctx, 0, 0, w, h, r);
  ctx.fill();
  ctx.fillStyle = opts.color ?? '#e2e8f0';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.userData.aspect = w / h;
  return sp;
}
export function dotSprite(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(255,255,255,.95)';
  x.beginPath();
  x.arc(32, 32, 28, 0, 7);
  x.fill();
  x.fillStyle = color;
  x.beginPath();
  x.arc(32, 32, 20, 0, 7);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
}

/** A label sprite whose text can change (zone status etc.). Fixed-size canvas so the sprite scale stays constant. */
export function liveLabel(w = 480, h = 88) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.userData.aspect = w / h;
  let cur = '';
  const set = (text: string, bg = 'rgba(15,27,36,.88)', fg = '#f1f5f9') => {
    const k = text + bg;
    if (k === cur) return;
    cur = k;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.beginPath();
    roundedRectPath(ctx, 2, 2, w - 4, h - 4, h * 0.4);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = `600 ${h * 0.5}px Blinker, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
    tex.needsUpdate = true;
  };
  return { sprite, set };
}
export function stripeTexture(color = '#ef4444') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(239,68,68,.18)';
  x.fillRect(0, 0, 64, 64);
  x.strokeStyle = color;
  x.lineWidth = 10;
  for (let i = -64; i < 128; i += 32) {
    x.beginPath();
    x.moveTo(i, 64);
    x.lineTo(i + 64, 0);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Hides labels that would sit on top of another one. Walks the labels nearest first, measures the rectangle each covers on the screen and keeps a label only when it
 * overlaps none already kept (`userData.crowded` marks the ones left out; the caller turns that into opacity). Sprites that are off screen or behind the camera are left alone.
 */
export function declutterLabels(
  sprites: THREE.Sprite[],
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
) {
  const v = new THREE.Vector3();
  const pxPerWorld = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const items: { s: THREE.Sprite; d: number; x: number; y: number; hw: number; hh: number }[] = [];
  for (const s of sprites) {
    s.userData.crowded = false;
    s.getWorldPosition(v);
    const d = v.distanceTo(camera.position);
    v.project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.3 || Math.abs(v.y) > 1.3) continue;
    const k = pxPerWorld / d;
    items.push({
      s,
      d,
      x: ((v.x + 1) * width) / 2,
      y: ((1 - v.y) * height) / 2,
      hw: (s.scale.x * k) / 2 + 4,
      hh: (s.scale.y * k) / 2 + 4,
    });
  }
  items.sort((a, b) => a.d - b.d);
  const kept: typeof items = [];
  for (const it of items) {
    const hit = kept.some((o) => Math.abs(o.x - it.x) < o.hw + it.hw && Math.abs(o.y - it.y) < o.hh + it.hh);
    if (hit) it.s.userData.crowded = true;
    else kept.push(it);
  }
}
