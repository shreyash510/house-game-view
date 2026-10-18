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
};
const made = {};
export function material(name) {
  if (wallMaterials[name]) return wallMaterials[name];
  if (!MAKERS[name]) throw new Error(`Unknown material "${name}". Known: ${[...Object.keys(wallMaterials), ...Object.keys(MAKERS)].join(', ')}`);
  return (made[name] ||= MAKERS[name]());
}
// The material for a JSON entry: { "material": "name" } or { "color": "#rrggbb" }
export const matOf = (cfg, fallbackColor = white) => (cfg.material ? material(cfg.material) : paint(hex(cfg.color ?? fallbackColor)));
