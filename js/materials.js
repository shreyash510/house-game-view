// Named materials, so house.json can say "material": "charcoalClad" instead of building textures.
// Each one is made the first time it is asked for. Add new names to MAKERS.
import { paint, textured, claddingTex, makeTexture, speckle, rand, wallMats, wallMaterials, frameWhite, steel, glassMat, white, hex } from './core.js';

const brickTex = () => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#6b5a4a'; ctx.fillRect(0, 0, w, h);   // mortar
  const rows = 8, bh = h / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 32 : 0;
    for (let x = -64; x < w + 64; x += 64) {
      const l = rand(0.85, 1.1);
      ctx.fillStyle = `rgb(${Math.min(255, 176 * l)},${Math.min(255, 128 * l)},${Math.min(255, 92 * l)})`;
      ctx.fillRect(x + off + 2, r * bh + 2, 60, bh - 4);
    }
  }
  speckle(ctx, w, h, 5000, 2, 0.08);
});

// Climbing vine on a wall: dense small leaves in several greens over dark gaps
const vineTex = () => makeTexture(128, 256, (ctx, w, h) => {
  ctx.fillStyle = '#1d3317'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const g = rand(90, 170) | 0;
    ctx.fillStyle = `rgb(${rand(30, 70) | 0},${g},${rand(25, 55) | 0})`;
    ctx.beginPath(); ctx.ellipse(rand(0, w), rand(0, h), rand(3, 7), rand(2, 4), rand(0, 3.14), 0, 7); ctx.fill();
  }
});

// ---------- Interior design materials (interior.json) ----------
// Wood grain: long wavy streaks over a base colour
const woodTex = (base, dark, light) => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = i % 3 ? dark : light; ctx.globalAlpha = rand(0.12, 0.35); ctx.lineWidth = rand(0.6, 2.2);
    let y = rand(0, h); ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) { y += rand(-1.5, 1.5); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
});
// Fluted panel: vertical rounded ribs (light edge, dark groove) over walnut
const flutedTex = () => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#5b3d2a'; ctx.fillRect(0, 0, w, h);
  const rib = 16;
  for (let x = 0; x < w; x += rib) {
    const g = ctx.createLinearGradient(x, 0, x + rib, 0);
    g.addColorStop(0, '#3a2618'); g.addColorStop(0.25, '#6e4c35'); g.addColorStop(0.55, '#7a5640'); g.addColorStop(0.9, '#4a3121'); g.addColorStop(1, '#2a1b11');
    ctx.fillStyle = g; ctx.fillRect(x, 0, rib, h);
  }
  speckle(ctx, w, h, 1500, 1, 0.08);
});
// Woven fabric: fine cross-hatch with a little slub
const fabricTex = (base) => makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 2) {
    ctx.fillStyle = `rgba(0,0,0,${rand(0.03, 0.08)})`; ctx.fillRect(i, 0, 1, h);
    ctx.fillStyle = `rgba(255,255,255,${rand(0.02, 0.06)})`; ctx.fillRect(0, i, w, 1);
  }
});
// White marble with soft grey veins
const marbleTex = () => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#f1efea'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    let x = rand(0, w), y = rand(0, h), a = rand(0, 6.28);
    ctx.strokeStyle = `rgba(110,110,115,${rand(0.2, 0.45)})`; ctx.lineWidth = rand(0.6, 2);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 12; k++) { a += rand(-0.6, 0.6); x += Math.cos(a) * 24; y += Math.sin(a) * 24; ctx.lineTo(x, y); }
    ctx.stroke();
  }
});
// Hand-woven dhurrie: ivory field, terracotta and sage bands, a diamond row, dark border
const dhurrieTex = () => makeTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#e9dfcc'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3b3a38'; ctx.fillRect(0, 0, w, 18); ctx.fillRect(0, h - 18, w, 18); ctx.fillRect(0, 0, 18, h); ctx.fillRect(w - 18, 0, 18, h);
  [[60, '#b5644a'], [h - 84, '#b5644a'], [110, '#8a9a7b'], [h - 134, '#8a9a7b']].forEach(([y, c]) => { ctx.fillStyle = c; ctx.fillRect(18, y, w - 36, 22); });
  ctx.fillStyle = '#2f5455';
  for (let x = 40; x < w - 30; x += 56) { ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x + 20, h / 2 - 26); ctx.lineTo(x + 40, h / 2); ctx.lineTo(x + 20, h / 2 + 26); ctx.fill(); }
  for (let i = 0; i < h; i += 3) { ctx.fillStyle = `rgba(0,0,0,${rand(0.01, 0.05)})`; ctx.fillRect(0, i, w, 1); }
}, false);

const MAKERS = {
  white: () => paint(white),
  frameWhite: () => frameWhite,                                         // white window surround (fades with the walls)
  steel: () => steel,
  glass: () => glassMat,
  brick: () => {                                                        // brick cladding, fades with the walls
    const m = textured(brickTex(), 1.0, 0.85, 1.2);
    m.transparent = true;
    wallMats.push(m);
    return m;
  },
  charcoalClad: () => textured(claddingTex('#55534f'), 0.7, 0.9),      // grooved charcoal panels
  towerClad: () => textured(claddingTex('#64625e'), 0.45, 0.9),        // grey tower over the windows
  porchClad: () => textured(claddingTex('#8f8579'), 0.7, 0.9),         // warm brown panels
  greyClad: () => textured(claddingTex('#8b8a84'), 0.9, 0.9),          // balcony parapet
  mumtyLower: () => textured(claddingTex('#a39c86'), 0.7, 0.9),        // stair room on the terrace: tan lower band
  mumtyUpper: () => textured(claddingTex('#7b7a6e'), 0.7, 0.9),        // ...and darker grey-olive upper part
  brownCladding: () => textured(claddingTex('#85766a'), 0.7, 0.9),     // brown-grey paint with horizontal lines
  vine: () => textured(vineTex(), 0.6, 1),                             // green climbing vine strip
  // interior design
  walnut: () => textured(woodTex('#5b3d2a', '#3a2618', '#7a5640'), 1.2, 0.55),
  oak: () => textured(woodTex('#c9a477', '#a07c52', '#dcbf95'), 1.2, 0.55),
  flutedWalnut: () => textured(flutedTex(), 0.5, 0.6, 0.6),
  fabricBeige: () => textured(fabricTex('#d8ccb8'), 0.4, 1),
  fabricTeal: () => textured(fabricTex('#2f5455'), 0.4, 1),
  fabricRust: () => textured(fabricTex('#b5644a'), 0.4, 1),
  fabricSage: () => textured(fabricTex('#8a9a7b'), 0.4, 1),
  marbleWhite: () => textured(marbleTex(), 1.0, 0.18),
  rugDhurrie: () => { const m = textured(dhurrieTex(), 1, 1); m.userData.tile = 0; return m; },
  brass: () => new THREE.MeshStandardMaterial({ color: 0xb08a48, roughness: 0.35, metalness: 0.9 }),
  blackMetal: () => new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: 0.45, metalness: 0.6 }),
  mirror: () => new THREE.MeshStandardMaterial({ color: 0xdfe8ec, roughness: 0.04, metalness: 1 }),
  sageLacquer: () => paint(0x8a9a7b, 0.35),
  popWhite: () => paint(0xf7f5f0, 0.9),
};
const made = {};
export function material(name) {
  if (wallMaterials[name]) return wallMaterials[name];
  if (!MAKERS[name]) throw new Error(`Unknown material "${name}". Known: ${[...Object.keys(wallMaterials), ...Object.keys(MAKERS)].join(', ')}`);
  return (made[name] ||= MAKERS[name]());
}
// The material for a JSON entry: { "material": "name" } or { "color": "#rrggbb" }
export const matOf = (cfg, fallbackColor = white) => (cfg.material ? material(cfg.material) : paint(hex(cfg.color ?? fallbackColor)));
