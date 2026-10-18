// Ceilings: the underside of the slab, seen from below (one-sided, so from above you still look straight into the room).
// Without them the roof is hidden indoors and you would see the night sky instead of the slab.
// POP design: a dropped border with a glowing cove, diamond grooves in the middle panel, and spot lights.
import { realScene, H, PLINTH, S, fx, fz, col, makeTexture, speckle, textured } from './core.js';

export const ceilingG = new THREE.Group();   // all ceilings, hidden in Services (X-ray) mode
realScene.add(ceilingG);

let mats;
const materials = () => (mats ||= {
  ceil: new THREE.MeshStandardMaterial({ color: col(0xf6f5f1), roughness: 0.9 }),
  pop: textured(makeTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8ded0'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 800, 2, 0.015);
    const diamond = (ox, oy, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(0, h / 2 + oy); ctx.lineTo(w / 2 + ox, 0); ctx.lineTo(w, h / 2 + oy);
      ctx.moveTo(0, h / 2 + oy); ctx.lineTo(w / 2 + ox, h); ctx.lineTo(w, h / 2 + oy); ctx.stroke();
    };
    diamond(0, 0, '#b9ad99', 5);      // groove
    diamond(0, 3, '#fbf7ee', 2);      // highlight on the lower lip of the groove
  }), 1.3, 0.9),
  cove: new THREE.MeshBasicMaterial({ color: col(0xffd9a0), transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  spot: new THREE.MeshBasicMaterial({ color: col(0xfff3d8) }),
});

const flat = (w, d, mat, x, y, z) => {            // a rectangle facing downwards
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  ceilingG.add(m);
  return m;
};
function ceiling(x1, z1, x2, z2, y) {
  const M = materials();
  const w = (x2 - x1) * S, d = (z2 - z1) * S, cx = fx((x1 + x2) / 2), cz = fz((z1 + z2) / 2);
  const bw = Math.min(0.45, Math.min(w, d) * 0.18), drop = 0.14, cove = 0.1;   // border width, how far it drops, glow strip width
  // Middle panel with diamond grooves (UVs scaled so every diamond is about 1.3 m wide)
  const iw = w - 2 * bw, id = d - 2 * bw;
  const panel = flat(iw, id, M.pop, cx, y, cz);
  const uv = panel.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * iw / 1.3, uv.getY(i) * id / 1.3);
  // Dropped border (four boxes) with a soft glow on the ceiling beside it, like cove lighting
  const band = (bwid, bdep, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bwid, drop, bdep), M.ceil);
    m.position.set(x, y - drop / 2, z);
    ceilingG.add(m);
  };
  band(w, bw, cx, cz - d / 2 + bw / 2); band(w, bw, cx, cz + d / 2 - bw / 2);
  band(bw, d - 2 * bw, cx - w / 2 + bw / 2, cz); band(bw, d - 2 * bw, cx + w / 2 - bw / 2, cz);
  flat(iw, cove, M.cove, cx, y - 0.004, cz - id / 2 + cove / 2); flat(iw, cove, M.cove, cx, y - 0.004, cz + id / 2 - cove / 2);
  flat(cove, id - 2 * cove, M.cove, cx - iw / 2 + cove / 2, y - 0.004, cz); flat(cove, id - 2 * cove, M.cove, cx + iw / 2 - cove / 2, y - 0.004, cz);
  // Recessed spot lights near the corners of the middle panel
  const sx = Math.max(0.2, iw / 2 - 0.45), sz = Math.max(0.2, id / 2 - 0.45);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), M.spot);
    s.rotation.x = Math.PI / 2;
    s.position.set(cx + a * sx, y - 0.008, cz + b * sz);
    ceilingG.add(s);
  });
}

// One ceiling per room (at "ceilingY" above the plinth when given, else under the roof slab), plus the extra areas between rooms
export function buildCeilings(rooms, extra = []) {
  const slabBottom = PLINTH + H - 0.2 - 0.005;
  rooms.forEach((r) => ceiling(r.x1, r.z1, r.x2, r.z2, r.ceilingY !== undefined ? PLINTH + r.ceilingY - 0.005 : slabBottom));
  extra.forEach(([x1, z1, x2, z2]) => ceiling(x1, z1, x2, z2, slabBottom));
}
