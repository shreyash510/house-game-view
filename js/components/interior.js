// Interior design pieces (Settings > Interior, key V). They are built from interior.json into their own group, which
// replaces the plain furniture while the switch is on. Plan positions in FEET, heights in METRES above the plinth top
// (the floor is at FLOOR_Y = 0.11, the slab underside at H - 0.2 = 3.4).
// "face" on seating = the way you look when you sit in it: "+z" (south), "-z" (north), "+x" (east), "-x" (west).
import { scene, rect, box, glow, furn, fx, fz, S, H, FLOOR_Y, hex, col, paint, wallMats, makeTexture, rand } from '../core.js';
import { material } from '../materials.js';

// A material from a JSON value: "#rrggbb" = plain paint, a name = a named material (materials.js), else the fallback colour
const mat = (v, fallback = '#cccccc') => (typeof v === 'string' && !v.startsWith('#') ? material(v) : paint(hex(v ?? fallback)));
const FT = S;                      // metres per foot
const SLAB = () => H - 0.2;        // underside of the roof slab

// Box from plan feet and heights in metres, in the current group
const block = (x1, z1, x2, z2, y0, h, m, parent = scene) => rect(Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2), y0, h, 0, parent, m);

// Paints and tiles on the walls fade with the walls when you are inside (see-through mode), like the walls they cover
const finishCache = {};
function finishMat(v) {
  if (typeof v === 'string' && !v.startsWith('#')) return material(v);
  const key = v ?? '#efe9df';
  if (!finishCache[key]) {
    finishCache[key] = new THREE.MeshStandardMaterial({ color: col(hex(key)), roughness: 0.85, metalness: 0, transparent: true });
    wallMats.push(finishCache[key]);
  }
  return finishCache[key];
}

// A warm additive wash of light (cove light on the slab, glow behind a panel)
const washTex = makeTexture(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,214,150,0.9)'); g.addColorStop(0.6, 'rgba(255,200,130,0.35)'); g.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}, false);
function wash(w, d, pos, rotX, parent = scene, opacity = 0.55) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: washTex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.set(...pos);
  m.rotation.x = rotX;
  parent.add(m);
  return m;
}

// Map seat-local coordinates (u along the width from the left end, v from the back towards the front, both in feet)
// to a plan rect, for a piece in rect [x1, z1, x2, z2] facing `face`
function frameOf([x1, z1, x2, z2], face = '+z') {
  const alongX = face[1] === 'z';
  const width = alongX ? x2 - x1 : z2 - z1, depth = alongX ? z2 - z1 : x2 - x1;
  const map = (u0, u1, v0, v1) => {
    if (face === '+z') return [x1 + u0, z1 + v0, x1 + u1, z1 + v1];
    if (face === '-z') return [x1 + u0, z2 - v1, x1 + u1, z2 - v0];
    if (face === '+x') return [x1 + v0, z1 + u0, x1 + v1, z1 + u1];
    return [x2 - v1, z1 + u0, x2 - v0, z1 + u1];   // '-x'
  };
  return { width, depth, map };
}

// ---------- POP false ceiling ----------
// Every POP ceiling goes in a group main.js hides when the camera is above it (looking down into a room) or in X-ray
export const popGroups = [];
let popMat, trayMat;
// { "rect": room's inner faces [x1, z1, x2, z2], "drop": bottom of the perimeter band (m, default 3.05), "band": its width (ft, 2),
//   "tray": { "width": ft (1.5), "y": m (3.22) } a second, higher ring inside the band, "cove": true (warm LED in the step),
//   "grooves": [[x1, z1, x2, z2]...] 4" V-grooves cut into the band, "spots": [[x, z]...] recessed spot lights,
//   "rafts": [{ "rect", "y", "h", "cove" }] a lower floating island (over a dining table...) }
// The middle stays open up to the slab, so ceiling fans keep hanging from it.
export function popCeiling(c) {
  popMat ||= new THREE.MeshStandardMaterial({ color: col(0xf7f5f0), roughness: 0.9 });
  trayMat ||= new THREE.MeshStandardMaterial({ color: col(0xf7f3ea), roughness: 0.9, emissive: col(0xffcf8a), emissiveIntensity: 0.18 });
  const g = new THREE.Group();
  scene.add(g);
  popGroups.push(g);
  const [x1, z1, x2, z2] = c.rect, top = SLAB(), drop = c.drop ?? 3.05, band = c.band ?? 2;
  const ring = (a, w, y0, m) => {   // ring of width w (ft), a (ft) in from the room's faces, from y0 up to the slab
    const [ax1, az1, ax2, az2] = [x1 + a, z1 + a, x2 - a, z2 - a];
    block(ax1, az1, ax2, az1 + w, y0, top - y0, m, g);
    block(ax1, az2 - w, ax2, az2, y0, top - y0, m, g);
    block(ax1, az1 + w, ax1 + w, az2 - w, y0, top - y0, m, g);
    block(ax2 - w, az1 + w, ax2, az2 - w, y0, top - y0, m, g);
  };
  // Warm LED strip along the inner edge of a ring, just under the next level up
  const cove = (a, y) => {
    const [ax1, az1, ax2, az2] = [x1 + a, z1 + a, x2 - a, z2 - a], t = 0.012, hh = 0.03;
    glow([(ax2 - ax1) * FT, hh, t], [fx((ax1 + ax2) / 2), y, fz(az1) + t], 0xffd59a, g);
    glow([(ax2 - ax1) * FT, hh, t], [fx((ax1 + ax2) / 2), y, fz(az2) - t], 0xffd59a, g);
    glow([t, hh, (az2 - az1) * FT], [fx(ax1) + t, y, fz((az1 + az2) / 2)], 0xffd59a, g);
    glow([t, hh, (az2 - az1) * FT], [fx(ax2) - t, y, fz((az1 + az2) / 2)], 0xffd59a, g);
  };
  ring(0, band, drop, popMat);
  if (c.tray) {
    const tw = c.tray.width ?? 1.5, ty = c.tray.y ?? 3.22;
    ring(band, tw, ty, trayMat);
    if (c.cove !== false) cove(band, ty - 0.02);
    if (c.cove !== false) cove(band + tw, top - 0.03);
  } else if (c.cove !== false) cove(band, top - 0.03);
  (c.grooves || []).forEach(([gx1, gz1, gx2, gz2]) => block(gx1, gz1, gx2, gz2, drop - 0.004, 0.004, paint(0xb9b2a6), g));
  (c.spots || []).forEach(([sx, sz]) => {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 20), paint(0xd9d6cf));
    rim.position.set(fx(sx), drop - 0.004, fz(sz));
    g.add(rim);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.01, 20), new THREE.MeshBasicMaterial({ color: col(0xfff1d2) }));
    lens.position.set(fx(sx), drop - 0.007, fz(sz));
    g.add(lens);
  });
  (c.rafts || []).forEach((r) => {
    const [rx1, rz1, rx2, rz2] = r.rect, ry = r.y ?? 2.95, rh = r.h ?? 0.1;
    block(rx1, rz1, rx2, rz2, ry, rh, popMat, g);
    if (r.cove !== false) wash((rx2 - rx1 + 1.5) * FT, (rz2 - rz1 + 1.5) * FT, [fx((rx1 + rx2) / 2), top - 0.01, fz((rz1 + rz2) / 2)], Math.PI / 2, g, 0.5);
  });
}

// ---------- Paint / tiles on a wall face ----------
// { "along": "x" (wall runs along x, face at z = at) | "z" (face at x = at), "at": the room-side face (ft),
//   "dir": +1 | -1 (which way the room is), "from", "to" (ft), "y0" (0.11), "y1" (slab), "gaps": [[from, to, bottom, top]...]
//   for doors and windows, "color" | "material" }
export function wallFinish(c) {
  const m = finishMat(c.material ?? c.color), y0 = c.y0 ?? FLOOR_Y, y1 = c.y1 ?? SLAB(), t = 0.012;
  const piece = (a, b, ya, yb) => {
    if (b - a < 0.01 || yb - ya < 0.01) return;
    if (c.along === 'x') box([(b - a) * FT, yb - ya, t], [fx((a + b) / 2), ya + (yb - ya) / 2, fz(c.at) + c.dir * t / 2], 0, scene, m).castShadow = false;
    else box([t, yb - ya, (b - a) * FT], [fx(c.at) + c.dir * t / 2, ya + (yb - ya) / 2, fz((a + b) / 2)], 0, scene, m).castShadow = false;
  };
  const gaps = (c.gaps || []).slice().sort((p, q) => p[0] - q[0]);
  let a = c.from;
  gaps.forEach(([g1, g2, gb, gt]) => {
    piece(a, g1, y0, y1);
    piece(g1, g2, y0, Math.min(gb, y1));
    piece(g1, g2, Math.max(gt, y0), y1);
    a = g2;
  });
  piece(a, c.to, y0, y1);
}

// ---------- Panel on a wall: fluted wood, upholstery, marble... ----------
// { "along", "at", "dir", "from", "to", "y0", "y1", "depth" (m, 0.03), "material" | "color",
//   "frame": colour/material of a thin edge frame, "backlight": true (warm glow spilling round its edges) }
export function wallPanel(c) {
  const m = mat(c.material ?? c.color, '#5b3d2a'), y0 = c.y0 ?? FLOOR_Y, y1 = c.y1 ?? 3.05, d = c.depth ?? 0.03;
  const len = (c.to - c.from) * FT, mid = (c.from + c.to) / 2, h = y1 - y0;
  const along = c.along === 'x';
  const at = (off) => (along ? [fx(mid), 0, fz(c.at) + c.dir * off] : [fx(c.at) + c.dir * off, 0, fz(mid)]);
  const size = (l, hh, dd) => (along ? [l, hh, dd] : [dd, hh, l]);
  const p = at(d / 2 + (c.offset ?? 0)); p[1] = y0 + h / 2;
  box(size(len, h, d), p, 0, scene, m);
  if (c.frame) {
    const fm = mat(c.frame), fw = 0.03;
    [[y1 - fw / 2], [y0 + fw / 2]].forEach(([y]) => { const q = at(d + 0.005); q[1] = y; box(size(len + fw * 2, fw, 0.02), q, 0, scene, fm); });
    [-1, 1].forEach((s) => {
      const q = at(d + 0.005); q[1] = y0 + h / 2;
      if (along) q[0] += s * (len / 2 + fw / 2); else q[2] += s * (len / 2 + fw / 2);
      box(size(fw, h + fw * 2, 0.02), q, 0, scene, fm);
    });
  }
  if (c.backlight) {
    const q = at(0.01); q[1] = y0 + h / 2;
    const w = wash(len + 0.6, h + 0.5, q, 0, scene, 0.35);
    if (!along) w.rotation.y = Math.PI / 2;
  }
}

// ---------- Plain box with a material (console tops, TV, shoe cabinet...) ----------
// { "rect", "y0" (floor), "h", "color" | "material", "glow": "#rrggbb" (lit, ignores light), "solid" (false) }
export function ibox(c) {
  const [x1, z1, x2, z2] = c.rect, y0 = c.y0 ?? FLOOR_Y, h = c.h ?? 0.5;
  if (c.glow) glow([(x2 - x1) * FT, h, (z2 - z1) * FT], [fx((x1 + x2) / 2), y0 + h / 2, fz((z1 + z2) / 2)], hex(c.glow));
  else block(x1, z1, x2, z2, y0, h, mat(c.material ?? c.color, '#7c5a3a'));
  if (c.solid) furn(x1, z1, x2, z2, 0, 0, y0, true).visible = false;
}

// ---------- Sofa / armchair ----------
// { "rect", "face", "seats" (3), "fabric" (material or colour), "cushions": [colours of throw cushions], "legs": colour,
//   "arms": ft (0.55) }
export function sofa(c) {
  const { width, depth, map } = frameOf(c.rect, c.face), fab = mat(c.fabric, '#d8ccb8'), legM = mat(c.legs ?? '#2b2420');
  const seats = c.seats ?? 3, arm = c.arms ?? 0.55, back = 0.6, legH = 0.1;
  const B = (u0, u1, v0, v1, y0, h, m) => block(...map(u0, u1, v0, v1), y0, h, m);
  const base = FLOOR_Y + legH;
  [[0.15, 0.15], [width - 0.35, 0.15], [0.15, depth - 0.35], [width - 0.35, depth - 0.35]].forEach(([u, v]) => B(u, u + 0.2, v, v + 0.2, FLOOR_Y, legH, legM));
  B(0, width, 0, depth, base, 0.26, fab);                                   // plinth of the sofa
  B(0, width, 0, back, base, 0.75, fab);                                    // back frame
  B(0, arm, 0, depth, base, 0.52, fab);                                     // arms
  B(width - arm, width, 0, depth, base, 0.52, fab);
  const inner = width - 2 * arm, sw = inner / seats;
  for (let i = 0; i < seats; i++) {
    const u0 = arm + i * sw + 0.02, u1 = arm + (i + 1) * sw - 0.02;
    B(u0, u1, back + 0.02, depth - 0.02, base + 0.26, 0.14, fab);           // seat cushion
    B(u0, u1, back, back + 0.5, base + 0.4, 0.42, fab);                     // back cushion
  }
  (c.cushions || []).forEach((cc, i) => {                                    // throw cushions, at the two ends
    const left = i % 2 === 0, k = Math.floor(i / 2) * 0.35;
    const u0 = left ? arm + 0.1 + k : width - arm - 1.3 - k;
    B(u0, u0 + 1.2, back + 0.45, back + 0.85, base + 0.4, 0.36, mat(cc));
  });
  furn(...map(0, width, 0, depth), 0, 0, FLOOR_Y, true).visible = false;
}

// ---------- Tables ----------
// { "rect", "h" (top height, 0.76), "top" (material), "base" (material), "round": true, "thick" (m, 0.04),
//   "pedestal": true (one central stand instead of four legs) }
export function table(c) {
  const [x1, z1, x2, z2] = c.rect, h = c.h ?? 0.76, t = c.thick ?? 0.04, topM = mat(c.top, '#5b3d2a'), baseM = mat(c.base ?? '#2b2420');
  const cx = fx((x1 + x2) / 2), cz = fz((z1 + z2) / 2);
  if (c.round) {
    const r = ((x2 - x1) * FT) / 2;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 40), topM);
    top.position.set(cx, FLOOR_Y + h - t / 2, cz); top.castShadow = top.receiveShadow = true; scene.add(top);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.3, h - t, 24), baseM);
    stem.position.set(cx, FLOOR_Y + (h - t) / 2, cz); stem.castShadow = true; scene.add(stem);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.6, 0.03, 32), baseM);
    foot.position.set(cx, FLOOR_Y + 0.015, cz); scene.add(foot);
  } else {
    block(x1, z1, x2, z2, FLOOR_Y + h - t, t, topM);
    if (c.pedestal) block(x1 + (x2 - x1) * 0.35, z1 + (z2 - z1) * 0.3, x2 - (x2 - x1) * 0.35, z2 - (z2 - z1) * 0.3, FLOOR_Y, h - t, baseM);
    else [[x1 + 0.15, z1 + 0.15], [x2 - 0.3, z1 + 0.15], [x1 + 0.15, z2 - 0.3], [x2 - 0.3, z2 - 0.3]].forEach(([lx, lz]) => block(lx, lz, lx + 0.15, lz + 0.15, FLOOR_Y, h - t, baseM));
  }
  furn(x1, z1, x2, z2, 0, 0, FLOOR_Y, true).visible = false;
}

// Dining chair: { "rect", "face", "seat" (material/colour), "frame" (material/colour) }
export function chair(c) {
  const { width, depth, map } = frameOf(c.rect, c.face), seatM = mat(c.seat, '#d8ccb8'), frM = mat(c.frame, '#5b3d2a');
  const B = (u0, u1, v0, v1, y0, h, m) => block(...map(u0, u1, v0, v1), y0, h, m);
  [[0.05, 0.05], [width - 0.17, 0.05], [0.05, depth - 0.17], [width - 0.17, depth - 0.17]].forEach(([u, v]) => B(u, u + 0.12, v, v + 0.12, FLOOR_Y, 0.42, frM));
  B(0, width, 0, depth, FLOOR_Y + 0.42, 0.06, seatM);
  B(0.05, width - 0.05, 0, 0.15, FLOOR_Y + 0.48, 0.45, frM);
  B(0.15, width - 0.15, 0.15, 0.25, FLOOR_Y + 0.55, 0.33, seatM);
}

// ---------- Rug ----------
// { "rect", "material" | "color" }
export function rug(c) {
  const [x1, z1, x2, z2] = c.rect;
  block(x1, z1, x2, z2, FLOOR_Y, 0.01, mat(c.material ?? c.color, '#b9a58a')).castShadow = false;
}

// ---------- Curtains on a ceiling track ----------
// { "along", "at" (wall face), "dir", "from", "to" (track ends, ft), "y1" (track height, 3.0), "drape" (colour/material),
//   "sheer": colour (light see-through layer across the whole width), "stack": ft each side (1.3), "offset": m from the wall (0.12) }
export function curtain(c) {
  const along = c.along === 'x', y1 = c.y1 ?? 3.0, off = c.offset ?? 0.12, y0 = FLOOR_Y + 0.02, h = y1 - y0 - 0.03;
  const P = (a, o, y) => (along ? [fx(a), y, fz(c.at) + c.dir * o] : [fx(c.at) + c.dir * o, y, fz(a)]);
  const Z = (l, hh, d) => (along ? [l, hh, d] : [d, hh, l]);
  const len = (c.to - c.from) * FT, mid = (c.from + c.to) / 2;
  box(Z(len, 0.025, 0.03), P(mid, off, y1), 0x2b2b2b);                                        // track
  if (c.sheer) {
    const sm = new THREE.MeshStandardMaterial({ color: col(hex(c.sheer)), roughness: 1, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    box(Z(len, h, 0.006), P(mid, off - 0.04, y0 + h / 2), 0, scene, sm).castShadow = false;
  }
  const dm = mat(c.drape, '#c9b9a0'), stack = c.stack ?? 1.3, folds = 5;
  [[c.from, c.from + stack], [c.to - stack, c.to]].forEach(([a, b]) => {
    const fw = (b - a) / folds;
    for (let i = 0; i < folds; i++) {
      const o = off + (i % 2 ? 0.03 : -0.01);
      box(Z(fw * FT + 0.02, h, 0.04), P(a + fw * (i + 0.5), o, y0 + h / 2), 0, scene, dm);
    }
  });
}

// ---------- Lights ----------
// Pendant: { "at": [x, z], "y": bottom of the shade (m), "top": where the cord hangs from (slab), "r" (m, 0.2),
//   "shape": "dome" | "drum", "color" (shade, default brass) }
export function pendant(c) {
  const [x, z] = c.at, y = c.y ?? 1.8, top = c.top ?? SLAB(), r = c.r ?? 0.2, sm = mat(c.color ?? 'brass');
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, top - y - r * 0.6, 6), paint(0x1a1a1a));
  cord.position.set(fx(x), y + r * 0.6 + (top - y - r * 0.6) / 2, fz(z)); scene.add(cord);
  const shade = c.shape === 'drum'
    ? new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.9, 32, 1, true), sm)
    : new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), sm);
  shade.material.side = THREE.DoubleSide;
  shade.position.set(fx(x), c.shape === 'drum' ? y + r * 0.45 : y, fz(z)); shade.castShadow = true; scene.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 16, 10), new THREE.MeshBasicMaterial({ color: col(0xffe2b0) }));
  bulb.position.set(fx(x), y + r * 0.15, fz(z)); scene.add(bulb);
}

// Floor lamp: { "at": [x, z], "h" (1.6), "color" (shade) }
export function floorLamp(c) {
  const [x, z] = c.at, h = c.h ?? 1.6, metal = mat('brass');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.03, 24), metal); base.position.set(fx(x), FLOOR_Y + 0.015, fz(z)); scene.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.3, 8), metal); pole.position.set(fx(x), FLOOR_Y + (h - 0.3) / 2, fz(z)); scene.add(pole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.3, 28, 1, true), new THREE.MeshStandardMaterial({ color: col(hex(c.color ?? '#efe2c8')), roughness: 1, side: THREE.DoubleSide, emissive: col(0xffcf8a), emissiveIntensity: 0.45 }));
  shade.position.set(fx(x), FLOOR_Y + h - 0.15, fz(z)); scene.add(shade);
}

// ---------- Plant in a pot ----------
// { "at": [x, z], "h" (m, 1.4), "pot": colour/material, "r" (pot radius, m, 0.18), "kind": "palm" | "bush" }
export function plant(c) {
  const [x, z] = c.at, h = c.h ?? 1.4, r = c.r ?? 0.18, potH = Math.min(0.45, h * 0.3);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, potH, 24), mat(c.pot ?? '#d9cfc0'));
  pot.position.set(fx(x), FLOOR_Y + potH / 2, fz(z)); pot.castShadow = true; scene.add(pot);
  const leafM = [paint(0x3f6b34), paint(0x55833f), paint(0x2f5a2c)];
  const g = new THREE.Group(); g.position.set(fx(x), FLOOR_Y + potH, fz(z)); scene.add(g);
  if (c.kind === 'bush') {
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rand(0.12, 0.2), 10, 8), leafM[i % 3]);
      s.position.set(rand(-r, r), rand(0.1, h - potH - 0.1), rand(-r, r)); s.castShadow = true; g.add(s);
    }
    return;
  }
  // Palm-like: thin stems with long leaves fanning out
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2), len = (h - potH) * rand(0.65, 1);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.09, len, 0.01), leafM[i % 3]);
    leaf.geometry.translate(0, len / 2, 0);
    leaf.rotation.set(Math.cos(a) * rand(0.25, 0.6), a, Math.sin(a) * rand(0.25, 0.6));
    leaf.castShadow = true;
    g.add(leaf);
  }
}

// ---------- Picture frame / mirror on a wall ----------
// { "along", "at", "dir", "from", "to", "y0", "y1", "art": "abstract" | "mirror" | "roundMirror", "frame": colour/material,
//   "palette": ["#..", ...] colours for the abstract art }
const artTex = (palette, seed) => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = palette[0]; ctx.fillRect(0, 0, w, h);
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = palette[1 + (i % (palette.length - 1))];
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    if (i % 2) ctx.ellipse(r() * w, r() * h, 30 + r() * 70, 30 + r() * 70, 0, 0, 7);
    else { const x = r() * w, y = r() * h; ctx.moveTo(x, y); ctx.quadraticCurveTo(r() * w, r() * h, x + 120 * r(), y + 90 * r()); ctx.lineTo(x, y + 60); }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#2b2420'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.75); ctx.bezierCurveTo(w * 0.4, h * 0.2, w * 0.6, h * 0.9, w * 0.9, h * 0.3); ctx.stroke();
}, false);
export function frame(c) {
  const along = c.along === 'x', len = (c.to - c.from) * FT, mid = (c.from + c.to) / 2, y0 = c.y0 ?? 1.3, y1 = c.y1 ?? 2.1, h = y1 - y0;
  const fm = mat(c.frame ?? 'brass');
  const P = (o) => (along ? [fx(mid), y0 + h / 2, fz(c.at) + c.dir * o] : [fx(c.at) + c.dir * o, y0 + h / 2, fz(mid)]);
  if (c.art === 'roundMirror') {
    const r = Math.min(len, h) / 2;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 48), fm);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.035, r - 0.035, 0.032, 48), material('mirror'));
    [ring, glass].forEach((m, i) => {
      m.rotation[along ? 'x' : 'z'] = Math.PI / 2;
      m.position.set(...P(0.016 + i * 0.002));
      scene.add(m);
    });
    return;
  }
  const Z = (l, hh, d) => (along ? [l, hh, d] : [d, hh, l]);
  box(Z(len, h, 0.03), P(0.015), 0, scene, fm);
  const inner = c.art === 'mirror' ? material('mirror')
    : new THREE.MeshStandardMaterial({ map: artTex(c.palette ?? ['#efe6d6', '#8a9a7b', '#b5644a', '#2f5455', '#c9a477'], c.seed ?? 7), roughness: 0.9 });
  box(Z(len - 0.08, h - 0.08, 0.01), P(0.034), 0, scene, inner);
}

// ---------- Open shelf (bookcase, niche) ----------
// { "rect", "y0", "h", "shelves" (count, 4), "material" (carcass), "back": colour/material, "backlight": true (LED under each shelf) }
export function shelf(c) {
  const [x1, z1, x2, z2] = c.rect, y0 = c.y0 ?? FLOOR_Y, h = c.h ?? 2.0, n = c.shelves ?? 4, m = mat(c.material, '#5b3d2a'), t = 0.025;
  const alongX = x2 - x1 >= z2 - z1;
  const side = 0.08;   // board thickness in feet
  if (alongX) { block(x1, z1, x1 + side, z2, y0, h, m); block(x2 - side, z1, x2, z2, y0, h, m); }
  else { block(x1, z1, x2, z1 + side, y0, h, m); block(x1, z2 - side, x2, z2, y0, h, m); }
  if (c.back) { if (alongX) block(x1, z1, x2, z1 + 0.03, y0, h, mat(c.back)); else block(x1, z1, x1 + 0.03, z2, y0, h, mat(c.back)); }
  for (let i = 0; i <= n; i++) {
    const y = y0 + (h - t) * (i / n);
    block(x1, z1, x2, z2, y, t, m);
    if (c.backlight && i > 0) glow([(x2 - x1 - 0.2) * FT, 0.008, 0.01], [fx((x1 + x2) / 2), y - 0.005, fz(alongX ? z1 : (z1 + z2) / 2) + (alongX ? 0.05 : 0)], 0xffd59a);
  }
  // A few books and a vase on the shelves
  const bookM = [paint(0x8a3b2a), paint(0x2f5455), paint(0xc9a477), paint(0x3b3a38)];
  for (let i = 1; i < n; i++) {
    const y = y0 + (h - t) * (i / n) + t;
    const len = alongX ? x2 - x1 : z2 - z1, cnt = 4 + (i % 3);
    for (let k = 0; k < cnt; k++) {
      const a = 0.2 + k * 0.17, bh = 0.18 + ((k * 7 + i) % 4) * 0.025;
      if (a + 0.15 > len - 0.2) break;
      if (alongX) block(x1 + a, z1 + 0.1, x1 + a + 0.13, z2 - 0.15, y, bh, bookM[(k + i) % 4]);
      else block(x1 + 0.1, z1 + a, x2 - 0.15, z1 + a + 0.13, y, bh, bookM[(k + i) % 4]);
    }
  }
}
