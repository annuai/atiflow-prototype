import * as THREE from 'three';
export function labelSprite(text: string, opts: { color?: string; bg?: string; size?: number } = {}) {
  const size = opts.size ?? 56; const c = document.createElement('canvas'); const ctx = c.getContext('2d')!;
  ctx.font = `600 ${size}px Blinker, system-ui, sans-serif`; const w = Math.ceil(ctx.measureText(text).width) + size; c.width = w; c.height = size * 1.7;
  ctx.font = `600 ${size}px Blinker, system-ui, sans-serif`;
  ctx.fillStyle = opts.bg ?? 'rgba(15,27,36,.82)'; const r = size * 0.45; const h = c.height;
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, r); ctx.fill();
  ctx.fillStyle = opts.color ?? '#e2e8f0'; ctx.textBaseline = 'middle'; ctx.fillText(text, size / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.userData.aspect = w / h; return sp;
}
export function dotSprite(color: string) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill();
  x.fillStyle = color; x.beginPath(); x.arc(32, 32, 20, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
}

/** A label sprite whose text can change (zone status etc.). Fixed-size canvas so the sprite scale stays constant. */
export function liveLabel(w = 480, h = 88) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d')!; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sprite.userData.aspect = w / h; let cur = '';
  const set = (text: string, bg = 'rgba(15,27,36,.88)', fg = '#f1f5f9') => {
    const k = text + bg; if (k === cur) return; cur = k; ctx.clearRect(0, 0, w, h); ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, h * 0.4); ctx.fill();
    ctx.fillStyle = fg; ctx.font = `600 ${h * 0.5}px Blinker, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2 + 2); tex.needsUpdate = true;
  };
  return { sprite, set };
}
export function stripeTexture(color = '#ef4444') {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; x.fillStyle = 'rgba(239,68,68,.18)'; x.fillRect(0, 0, 64, 64); x.strokeStyle = color; x.lineWidth = 10;
  for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 64, 0); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
