// Ceilings: the underside of the slab, seen from below (one-sided, so from above you still look straight into the room).
// Without them the roof is hidden indoors and you would see the night sky instead of the slab.
// Plain white ceiling: one flat panel per room, no POP design and no spot lights.
import { realScene, H, PLINTH, S, fx, fz, col } from './core.js';

export const ceilingG = new THREE.Group();   // all ceilings, hidden in Services (X-ray) mode
realScene.add(ceilingG);

let ceilMat;
function ceiling(x1, z1, x2, z2, y) {
  ceilMat ||= new THREE.MeshStandardMaterial({ color: col(0xf6f5f1), roughness: 0.9 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry((x2 - x1) * S, (z2 - z1) * S), ceilMat);
  m.rotation.x = Math.PI / 2;   // facing down
  m.position.set(fx((x1 + x2) / 2), y, fz((z1 + z2) / 2));
  ceilingG.add(m);
}

// One ceiling per room (at "ceilingY" above the plinth when given, else under the roof slab), plus the extra areas between rooms
export function buildCeilings(rooms, extra = []) {
  const slabBottom = PLINTH + H - 0.2 - 0.005;
  rooms.forEach((r) => ceiling(r.x1, r.z1, r.x2, r.z2, r.ceilingY !== undefined ? PLINTH + r.ceilingY - 0.005 : slabBottom));
  extra.forEach(([x1, z1, x2, z2]) => ceiling(x1, z1, x2, z2, slabBottom));
}
