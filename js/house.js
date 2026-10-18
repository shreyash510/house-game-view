// Builds one house from its JSON description (see house.json and README.md for the format):
// plinth, floors, walls with their openings, doors, roof slab and parapets, floor labels, lamps, then every component.
import {
  realScene, useScene, setH, setPlinth, H, PLINTH, S, fx, fz, rect, wallLine, door, label, warmLight, obstacle,
  paint, textured, makeTexture, white, hex, ghost,
} from './core.js';
import { material } from './materials.js';
import { buildComponents } from './components/index.js';

// Plain white marble: large polished slabs with hairline joints
let marbleFloor;
const marble = () => (marbleFloor ||= ghost(textured(makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#f3f2ee'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,120,120,0.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}), 1.2, 0.2, 1.0)));

// A low solid line along the plan (edge of the plinth, side of a flight of steps): [x1, z1, x2, z2] with x1 = x2 or z1 = z2
function solidEdge([x1, z1, x2, z2]) {
  if (z1 === z2) obstacle(fx((x1 + x2) / 2), fz(z1), (x2 - x1) * S, 0.2, 0, 1.0);
  else obstacle(fx(x1), fz((z1 + z2) / 2), 0.2, (z2 - z1) * S, 0, 1.0);
}

export function buildHouse(data) {
  setH(data.wallHeight ?? 3.6);
  setPlinth(data.plinth?.height ?? 0.8);

  // ---------- Plinth: the house stands on a raised base; you get up by steps ----------
  useScene(realScene, 0);
  const plinthColor = hex(data.plinth?.color ?? '#8f897c');
  ghost(paint(plinthColor));
  (data.plinth?.areas || []).forEach(([x1, z1, x2, z2]) => rect(x1, z1, x2, z2, 0, PLINTH, plinthColor));
  (data.plinth?.solidEdges || []).forEach(solidEdge);

  // Everything else rides on the plinth; the roof and terrace go in `upper`, which hides when you walk inside
  const houseG = new THREE.Group();
  houseG.position.y = PLINTH;
  realScene.add(houseG);
  useScene(houseG, PLINTH);
  const upper = new THREE.Group();
  houseG.add(upper);
  const ctx = { houseG, upper };

  // ---------- Floors ----------
  (data.floors?.slabs || []).forEach((s) => { const c = hex(s.color ?? '#cfc8b8'); ghost(paint(c)); rect(...s.rect, 0, 0.1, c); });
  (data.floors?.marble || []).forEach((r) => rect(...r, 0.1, 0.01, 0, houseG, marble()));

  // ---------- Walls and doors ----------
  // wall: { "along": "x" (runs along x at z = at) | "z", "at", "from", "to", "openings": [[from, to, type]], "material", "outside": +1 | -1 }
  (data.walls || []).forEach((w) => wallLine(w.along === 'x', w.at, w.from, w.to, w.openings || [], material(w.material || 'cream'), w.outside || 0));
  // door: { "along", "at", "from", "to", "hingeAtStart", "swing": +1 | -1, "handle" }
  (data.doors || []).forEach((d) => door(d.along === 'x', d.at, d.from, d.to, d.hingeAtStart ?? true, d.swing ?? 1, !!d.handle));

  // ---------- Roof / terrace (hidden while you are inside) ----------
  const roof = data.roof || {};
  // Flat slab, 3 cm above the wall tops so no wall lines show on the terrace
  (roof.slabs || []).forEach(([x1, z1, x2, z2]) => rect(x1, z1, x2, z2, H - 0.2, 0.23, white, upper));
  // Two-layer white canopy slab: a slightly projecting upper layer, a dark shadow groove, then the lower layer
  (roof.canopies || []).forEach(([x1, z1, x2, z2]) => {
    const top = H + 0.03;
    rect(x1, z1, x2, z2, top - 0.36, 0.36, white, upper);
    rect(x1 + 0.05, z1, x2 - 0.05, z2 - 0.18, top - 0.74, 0.35, white, upper);
    rect(x1 + 0.05, z1, x2 - 0.05, z2 - 0.14, top - 0.4, 0.05, 0x3a3a38, upper);
  });
  // Parapet: the low edge wall round the terrace
  (roof.parapets || []).forEach(([x1, z1, x2, z2]) => {
    rect(x1, z1, x2, z2, H, roof.parapetHeight ?? 0.9, white, upper);
    obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, H, H + (roof.parapetHeight ?? 0.9));
  });

  // ---------- Room names on the floor, lamps, components and furniture ----------
  (data.labels || []).forEach((l) => label(l.text, l.at[0], l.at[1], l.width ?? 3.6));
  // Lamp records: only the 4 nearest really light up (see warmLight in core.js)
  (data.lights || []).forEach((l) => warmLight(fx(l.at[0]), l.y ?? 2.4, fz(l.at[1]), l.intensity ?? 1, l.distance ?? 10));
  buildComponents(data.components, ctx);
  buildComponents(data.furniture, ctx);

  useScene(realScene, 0);
  const rooms = (data.rooms || []).map((r) => ({ ...r, x1: r.rect[0], z1: r.rect[1], x2: r.rect[2], z2: r.rect[3] }));
  return { ...ctx, rooms };
}
