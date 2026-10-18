// Furniture: blocks you bump into, and a few ready-made pieces (bed, kitchen counter, sink, stove, wash basin).
import { scene, rect, box, glow, furn, label, fx, fz, FLOOR_Y, steel, makeTexture, textured, rand, hex, col, ghost, paint } from '../core.js';

// A plain piece of furniture: { "rect": [x1, z1, x2, z2], "h", "color", "y0" (default: floor level), "solid" (default true) }
export function item(c) {
  const [x1, z1, x2, z2] = c.rect;
  furn(x1, z1, x2, z2, c.h ?? 0.5, hex(c.color ?? '#7c5a3a'), c.y0 ?? FLOOR_Y, c.solid ?? true);
}

// Double bed against the north wall, centred at plan x, with side tables and lamps: { "x", "z" (headboard line, default 0.9) }
const wood = 0x6b4f3a;
export function bed(c) {
  const cx = c.x, z0 = c.z ?? 0.9;
  furn(cx - 2.75, z0 - 0.45, cx + 2.75, z0, 1.0, 0x4a3224);                              // headboard
  furn(cx - 2.75, z0, cx + 2.75, z0 + 6.5, 0.4, wood);                                   // frame
  furn(cx - 2.4, z0 + 0.2, cx + 2.4, z0 + 6.3, 0.25, 0xd9d0e6, FLOOR_Y + 0.4, false);    // mattress
  furn(cx - 2.4, z0 + 2.6, cx + 2.4, z0 + 6.3, 0.08, 0xe0b27a, FLOOR_Y + 0.65, false);   // blanket
  furn(cx - 2.2, z0 + 0.4, cx - 0.2, z0 + 1.6, 0.15, 0xf5ead2, FLOOR_Y + 0.65, false);   // pillows
  furn(cx + 0.2, z0 + 0.4, cx + 2.2, z0 + 1.6, 0.15, 0xf5ead2, FLOOR_Y + 0.65, false);
  [cx - 3.9, cx + 3.0].forEach((x) => {                                                  // side tables + lamps
    furn(x, z0 - 0.1, x + 1.2, z0 + 1.1, 0.5, 0x6b2e22);
    glow([0.14, 0.14, 0.14], [fx(x + 0.6), FLOOR_Y + 0.62, fz(z0 + 0.5)]);
  });
}

// White marble worktop with black veins over dark cabinets
let marbleTop;
const worktopMat = () => (marbleTop ||= textured(makeTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#f2f1ee'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {   // soft grey clouds
    ctx.fillStyle = `rgba(120,120,125,${rand(0.03, 0.07)})`;
    ctx.beginPath(); ctx.ellipse(rand(0, w), rand(0, h), rand(40, 110), rand(10, 30), rand(0, 3), 0, 7); ctx.fill();
  }
  for (let i = 0; i < 9; i++) {    // dark veins
    let x = rand(0, w), y = rand(0, h), a = rand(0, 6.28);
    ctx.strokeStyle = `rgba(25,25,30,${rand(0.55, 0.9)})`; ctx.lineWidth = rand(0.8, 2.6);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 14; k++) { a += rand(-0.7, 0.7); x += Math.cos(a) * rand(14, 34); y += Math.sin(a) * rand(14, 34); ctx.lineTo(x, y); }
    ctx.stroke();
  }
}), 1.5, 0.12));
const CABINET = 0x2b2420;
const worktop = (x1, z1, x2, z2) => rect(x1, z1, x2, z2, FLOOR_Y + 0.9, 0.05, 0, scene, worktopMat());

// Kitchen counter: { "rect": [x1, z1, x2, z2] }
export function counter(c) {
  const [x1, z1, x2, z2] = c.rect;
  ghost(paint(CABINET));   // see-through in Services (X-ray) mode
  furn(x1, z1, x2, z2, 0.9, CABINET);
  worktop(x1, z1, x2, z2);
}

// Sink unit: a low cabinet, worktop round a cut-out, steel basin and a pull-down tap at the back (high z) edge: { "rect" }
export function sink(c) {
  const [x1, z1, x2, z2] = c.rect;
  const bx1 = x1 + 0.5, bx2 = x2 - 0.5, bz1 = z1 + 0.4, bz2 = z2 - 0.4, cx = (x1 + x2) / 2, cz = (bz1 + bz2) / 2;
  furn(x1, z1, x2, z2, 0.5, CABINET);
  worktop(x1, z1, bx1, z2); worktop(bx2, z1, x2, z2); worktop(bx1, z1, bx2, bz1); worktop(bx1, bz2, bx2, z2);
  const basin = (a1, b1, a2, b2, y0, h) => rect(a1, b1, a2, b2, FLOOR_Y + y0, h, 0, scene, steel);
  basin(bx1, bz1, bx2, bz2, 0.5, 0.03);                                                    // basin floor
  basin(bx1, bz1, bx1 + 0.1, bz2, 0.5, 0.45); basin(bx2 - 0.1, bz1, bx2, bz2, 0.5, 0.45);   // basin sides
  basin(bx1, bz1, bx2, bz1 + 0.1, 0.5, 0.45); basin(bx1, bz2 - 0.1, bx2, bz2, 0.5, 0.45);
  rect(cx - 0.2, cz - 0.1, cx + 0.2, cz + 0.2, FLOOR_Y + 0.53, 0.005, 0x1a1a1a);           // drain
  // Pull-down tap: base, stem, curved spout and head, and a side lever
  const tx = fx(cx), tz = fz(z2 - 0.2), baseY = FLOOR_Y + 0.95, R = 0.1, stemH = 0.3;
  const part = (geo, x, y, z) => { const m = new THREE.Mesh(geo, steel); m.position.set(x, y, z); m.castShadow = true; scene.add(m); return m; };
  part(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 12), tx, baseY + 0.015, tz);
  part(new THREE.CylinderGeometry(0.016, 0.016, stemH, 10), tx, baseY + 0.03 + stemH / 2, tz);
  const arc = part(new THREE.TorusGeometry(R, 0.014, 8, 20, Math.PI), tx, baseY + 0.03 + stemH, tz - R);
  arc.rotation.y = Math.PI / 2;                                   // arc leans from the stem toward the front of the basin
  part(new THREE.CylinderGeometry(0.02, 0.016, 0.1, 10), tx, baseY + 0.03 + stemH - 0.05, tz - 2 * R);   // spout head
  part(new THREE.BoxGeometry(0.07, 0.015, 0.015), tx + 0.06, baseY + 0.05, tz);                           // lever
}

// Four-burner hob on the worktop; "at" is the north-west burner: { "at": [xf, zf] }
export function stove(c) {
  const [x0, z0] = c.at;
  [[0, 0], [0, 0.9], [0.7, 0], [0.7, 0.9]].forEach(([dx, dz]) => furn(x0 + dx, z0 + dz, x0 + dx + 0.7, z0 + dz + 0.7, 0.03, 0x111111, FLOOR_Y + 0.95, false));
}

// Hand-wash basin against a wall that runs along z (the wall face is just west of x): cabinet, bowl, tap and mirror
// { "x": front-left corner of the cabinet, "z": centre line, "label": true }
const mirrorMat = new THREE.MeshStandardMaterial({ color: col(0xdfe8ee), roughness: 0.04, metalness: 1 });
export function washBasin(c) {
  const x0 = c.x, zc = c.z;
  furn(x0, zc - 0.8, x0 + 1.4, zc + 0.8, 0.8, 0xe8e4dc);                                        // cabinet
  furn(x0, zc - 0.7, x0 + 1.3, zc + 0.7, 0.07, 0xf4f8fa, FLOOR_Y + 0.8, false);                 // basin top
  furn(x0 + 0.3, zc - 0.3, x0 + 1.0, zc + 0.3, 0.02, 0xaeb8bf, FLOOR_Y + 0.87, false);          // bowl
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), steel);
  tap.position.set(fx(x0 + 0.25), FLOOR_Y + 0.96, fz(zc));
  scene.add(tap);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), steel);
  spout.rotation.z = Math.PI / 2;
  spout.position.set(fx(x0 + 0.25) + 0.05, FLOOR_Y + 1.03, fz(zc));
  scene.add(spout);
  box([0.03, 0.62, 0.56], [fx(x0 - 0.05) + 0.05, FLOOR_Y + 1.55, fz(zc)], 0x2b2b2b);              // mirror frame
  box([0.02, 0.56, 0.5], [fx(x0 - 0.05) + 0.07, FLOOR_Y + 1.55, fz(zc)], 0, scene, mirrorMat);
  if (c.label !== false) label(['WASH BASIN', ''], x0 + 2.2, zc, 1.6);
}

// Floor label: { "text": ["NAME", "size"], "at": [xf, zf], "width" }
export function floorLabel(c) { label(c.text, c.at[0], c.at[1], c.width ?? 3.6); }
