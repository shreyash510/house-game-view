// Furniture: blocks you bump into, and a few ready-made pieces (bed, kitchen counter, sink, stove, wash basin).
import { scene, rect, box, glow, furn, label, fx, fz, S, FLOOR_Y, steel, makeTexture, textured, rand, hex, col, ghost, paint, obstacle } from '../core.js';

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
  if (c.sideTables !== false) [cx - 3.9, cx + 3.0].forEach((x) => {                      // side tables (no lamps on them); "sideTables": false leaves them out
    furn(x, z0 - 0.1, x + 1.2, z0 + 1.1, 0.5, 0x6b2e22);
    if (c.lamps) glow([0.14, 0.14, 0.14], [fx(x + 0.6), FLOOR_Y + 0.62, fz(z0 + 0.5)]);   // "lamps": true puts them back
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

// Single-door fridge (Whirlpool style): glossy body, one door with a shut line and a vertical handle, a base drawer and a badge.
// { "rect": [x1, z1, x2, z2], "face": "+x" | "-x" | "+z" | "-z" (the door side), "height" (m, default 1.52 = 5 ft), "color", "badge" }
export function fridge(c) {
  const [x1, z1, x2, z2] = c.rect, h = c.height ?? 1.52, face = c.face ?? '-x', out = face[0] === '+' ? 1 : -1, onX = face[1] === 'x';
  const body = new THREE.MeshStandardMaterial({ color: col(hex(c.color ?? '#8a4a2c')), roughness: 0.22, metalness: 0.35 });
  const dark = paint(0x2a1610, 0.6), y0 = FLOOR_Y, baseH = 0.16;
  rect(x1, z1, x2, z2, y0, h, 0, scene, body);
  obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, 0, h);
  // Things on the door face: "a" is metres across the face from its centre, y up from the floor, "d" how far they stand out
  const faceM = onX ? fx(out > 0 ? x2 : x1) : fz(out > 0 ? z2 : z1), across = onX ? (z2 - z1) * S : (x2 - x1) * S;
  const cA = onX ? fz((z1 + z2) / 2) : fx((x1 + x2) / 2);
  const put = (a, y, w, hh, d, mat) => {
    const pos = onX ? [faceM + out * d / 2, y, cA + a] : [cA + a, y, faceM + out * d / 2];
    return box(onX ? [d, hh, w] : [w, hh, d], pos, 0, scene, mat);
  };
  put(0, y0 + baseH / 2, across - 0.04, baseH - 0.02, 0.012, dark);                       // base drawer, darker
  put(0, y0 + baseH + 0.005, across, 0.01, 0.006, paint(0x120a07));                       // shut line above the drawer
  put(0, y0 + baseH + (h - baseH) / 2, across - 0.02, h - baseH - 0.03, 0.006, body);    // the door itself, standing a hair proud
  const side = across / 2 - 0.06;                                                        // handle on the opening edge
  put(side, y0 + h * 0.62, 0.025, 0.42, 0.04, steel);
  // Badge near the top of the door
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d'); g.fillStyle = '#e8e2d8'; g.font = 'italic bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(c.badge ?? 'Whirlpool', 128, 34);
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.055), new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(cv), { encoding: THREE.sRGBEncoding }), transparent: true }));
  const by = y0 + h - 0.12, bd = 0.008;
  if (onX) { badge.position.set(faceM + out * bd, by, cA); badge.rotation.y = out * Math.PI / 2; } else { badge.position.set(cA, by, faceM + out * bd); if (out < 0) badge.rotation.y = Math.PI; }
  scene.add(badge);
}

// Marble rack against a wall: shelves of the same white marble as the worktop between two marble side panels.
// { "rect": [x1, z1, x2, z2], "shelves": [heights above the floor, m] (default four), "height" (side panels, m) }
export function marbleRack(c) {
  const [x1, z1, x2, z2] = c.rect, shelves = c.shelves ?? [0.4, 0.85, 1.3, 1.75], top = c.height ?? Math.max(...shelves) + 0.04;
  const alongZ = z2 - z1 >= x2 - x1, t = 0.12;   // side panels at the two ends of the long side, 0.12 ft (about 4 cm) thick
  if (alongZ) { rect(x1, z1, x2, z1 + t, FLOOR_Y, top, 0, scene, worktopMat()); rect(x1, z2 - t, x2, z2, FLOOR_Y, top, 0, scene, worktopMat()); }
  else { rect(x1, z1, x1 + t, z2, FLOOR_Y, top, 0, scene, worktopMat()); rect(x2 - t, z1, x2, z2, FLOOR_Y, top, 0, scene, worktopMat()); }
  shelves.forEach((y) => rect(x1, z1, x2, z2, FLOOR_Y + y - 0.04, 0.04, 0, scene, worktopMat()));
  obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, 0, top);   // solid: you cannot walk through the rack
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

// Three-burner glass-top gas stove (gas shegadi) on the worktop; "at" is its north-west (front-left) corner: { "at": [xf, zf] }
const brass = new THREE.MeshStandardMaterial({ color: col(0xc9a24a), roughness: 0.3, metalness: 0.9 });
const glass = new THREE.MeshStandardMaterial({ color: col(0x0b0c0e), roughness: 0.05, metalness: 0.6 });
export function stove(c) {
  const [x0, z0] = c.at, w = 2.7, d = 1.4, top = FLOOR_Y + 0.95;
  box([w * S, 0.012, d * S], [fx(x0 + w / 2), top + 0.026, fz(z0 + d / 2)], 0, scene, glass);          // black glass top
  box([(w - 0.2) * S, 0.02, (d - 0.2) * S], [fx(x0 + w / 2), top + 0.01, fz(z0 + d / 2)], 0x222222);  // body under the glass
  for (let i = 0; i < 3; i++) {
    const x = x0 + 0.45 + i * 0.9, z = z0 + d / 2 + 0.05, X = fx(x), Z = fz(z), y = top + 0.032;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.025, 20), brass);     // brass burner ring
    ring.position.set(X, y + 0.012, Z); scene.add(ring);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 16), brass);     // burner cap
    cap.position.set(X, y + 0.03, Z); scene.add(cap);
    const grate = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 6, 24), steel);          // pan-support ring
    grate.rotation.x = Math.PI / 2; grate.position.set(X, y + 0.05, Z); scene.add(grate);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12), steel);   // knob on the front edge
    knob.rotation.x = Math.PI / 2; knob.position.set(X, top + 0.02, fz(z0) - 0.012); scene.add(knob);
  }
  obstacle(fx(x0 + w / 2), fz(z0 + d / 2), w * S, d * S, 0, 1.2);
}

// Hand-wash basin against a wall that runs along z (the wall face is just west of x): cabinet, bowl, tap and mirror
// { "x": front-left corner of the cabinet, "z": centre line, "label": true }
const mirrorMat = new THREE.MeshStandardMaterial({ color: col(0xdfe8ee), roughness: 0.04, metalness: 1 });
export function washBasin(c) {
  // x = the wall-side edge of the basin; "face": "+x" (default: on a west wall, facing east) or "-x" (on an east wall, facing west)
  const d = c.face === '-x' ? -1 : 1, x0 = c.x, zc = c.z;
  const span = (a, b) => (d > 0 ? [x0 + a, x0 + b] : [x0 - b, x0 - a]);   // from a to b feet out from the wall
  const [c1, c2] = span(0, 1.4), [t1, t2] = span(0, 1.3), [b1, b2] = span(0.3, 1.0);
  furn(c1, zc - 0.8, c2, zc + 0.8, 0.8, 0xe8e4dc);                                              // cabinet
  furn(t1, zc - 0.7, t2, zc + 0.7, 0.07, 0xf4f8fa, FLOOR_Y + 0.8, false);                       // basin top
  furn(b1, zc - 0.3, b2, zc + 0.3, 0.02, 0xaeb8bf, FLOOR_Y + 0.87, false);                      // bowl
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), steel);
  tap.position.set(fx(x0 + d * 0.25), FLOOR_Y + 0.96, fz(zc));
  scene.add(tap);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), steel);
  spout.rotation.z = Math.PI / 2;
  spout.position.set(fx(x0 + d * 0.25) + d * 0.05, FLOOR_Y + 1.03, fz(zc));
  scene.add(spout);
  box([0.03, 0.62, 0.56], [fx(x0 - d * 0.05) + d * 0.05, FLOOR_Y + 1.55, fz(zc)], 0x2b2b2b);              // mirror frame
  box([0.02, 0.56, 0.5], [fx(x0 - d * 0.05) + d * 0.07, FLOOR_Y + 1.55, fz(zc)], 0, scene, mirrorMat);
  if (c.label !== false) label(['WASH BASIN', ''], x0 + d * 2.2, zc, 1.6);
}

// Floor label: { "text": ["NAME", "size"], "at": [xf, zf], "width" }
export function floorLabel(c) { label(c.text, c.at[0], c.at[1], c.width ?? 3.6); }
