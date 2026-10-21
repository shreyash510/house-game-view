// Outdoor components (ground level): road with pavement and street lamps, hedges, fireflies, open farm shed.
import { scene, hex, box, glow, obstacle, textured, tileTex, makeTexture, speckle, paint, glowTex, ghostMats, updaters, fx, fz, S, rand, rect, rod, plasterTex, scaleUV, doors, walkables } from '../core.js';
import { tin } from '../makeHouse.js';

// ---------- Road: asphalt with lane dashes, a pavement and street lamps, running along x ----------
// { "z": road centre line, "width", "pavement": { "z", "width" }, "lamps": { "x": [...], "z" } } (feet)
const asphaltTex = () => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#26262b'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 14000, 2, 0.12);
});
export function road(c) {
  const roadMat = textured(asphaltTex(), 3, 0.85, 1.0), paveMat = textured(tileTex('#a3a29d'), 1.2, 0.8, 1.0);
  ghostMats.push(roadMat, paveMat);
  if (c.pavement) box([240, 0.1, c.pavement.width * S], [0, 0.05, fz(c.pavement.z)], 0, scene, paveMat);
  box([240, 0.06, c.width * S], [0, 0.03, fz(c.z)], 0, scene, roadMat);
  for (let x = -50; x <= 50; x += 6) box([2.5, 0.07, 0.18], [x, 0.04, fz(c.z)], 0xe8e8e8);
  // Street lamps: warm head, light pool on the ground (a cheap glow instead of a real light)
  (c.lamps?.x || []).forEach((xf) => {
    const x = fx(xf), z = fz(c.lamps.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.4, 8), paint(0x2c2f33, 0.5));
    pole.position.set(x, 2.2, z);
    pole.castShadow = true;
    scene.add(pole);
    box([0.9, 0.06, 0.06], [x + 0.4, 4.4, z], 0x2c2f33);
    glow([0.4, 0.1, 0.25], [x + 0.85, 4.33, z], 0xffd9a0);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x + 0.85, 0.13, z + 1.5);
    scene.add(pool);
  });
}

// ---------- Hedge with a rounded top made of overlapping bushes: { "rect": [x1, z1, x2, z2] } ----------
const leafTex = () => makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#1f4a22'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgb(${rand(25, 60)},${rand(70, 125)},${rand(25, 55)})`;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, rand(1.5, 4), 0, 7); ctx.fill();
  }
});
let hedgeMat;
export function hedge(c) {
  hedgeMat ||= textured(leafTex(), 0.8, 1);
  const [x1, z1, x2, z2] = c.rect, cx = fx((x1 + x2) / 2), cz = fz((z1 + z2) / 2), w = (x2 - x1) * S, d = (z2 - z1) * S;
  box([w, 0.9, d], [cx, 0.45, cz], 0, scene, hedgeMat);
  for (let x = -w / 2 + 0.3; x <= w / 2 - 0.2; x += 0.5) {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), hedgeMat);
    bush.scale.set(1, 0.7, Math.max(d, 0.6) * 1.1);
    bush.position.set(cx + x, 0.9, cz);
    bush.castShadow = true;
    scene.add(bush);
  }
  obstacle(cx, cz, w, d, 0, 0.9);
}

// ---------- Fireflies drifting over the garden: { "count" } ----------
export function fireflies(c) {
  const FLY = c.count ?? 60;
  const flyBase = Array.from({ length: FLY }, () => [rand(-25, 25), rand(0.4, 2.2), Math.random() < 0.6 ? rand(9.8, 14) : rand(-14, -8), rand(0, 6.28), rand(0.4, 1.0)]);
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLY * 3), 3));
  const dotTex = makeTexture(32, 32, (ctx) => { const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); }, false);
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ map: dotTex, color: 0xc8ff7a, size: 0.22, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flies.frustumCulled = false;
  scene.add(flies);
  updaters.push((t) => {
    const pos = flyGeo.attributes.position;
    flyBase.forEach(([x, y, z, ph, sp], i) => {
      pos.setXYZ(i, x + Math.sin(t * 0.3 * sp + ph) * 1.5, y + Math.sin(t * 0.7 * sp + ph * 2) * 0.35, z + Math.cos(t * 0.25 * sp + ph) * 1.5);
    });
    pos.needsUpdate = true;
  });
}

// ---------- Open shed: steel posts, triangular trusses and a gable roof of tin sheets, no walls (a farm / storage shed) ----------
// { "rect": [x1, z1, x2, z2] (feet), "eave": post height (m), "rise": ridge above the eaves (m), "ridge": "z" | "x",
//   "bays": number of spaces between trusses, "overhang": sheet overhang (m), "color": steelwork colour, "floor": true,
//   "wall": { "height": 1.22, "door": { "side": "S", "from": 15.5, "width": 4 } } }
//   wall = a low compound wall round the shed on the line of the posts, with one gate (from = feet from the west / north end)
export function openShed(c) {
  const [x1, z1, x2, z2] = c.rect, eave = c.eave ?? 3.6, rise = c.rise ?? 2.2, over = c.overhang ?? 0.35;
  const alongZ = (c.ridge ?? 'z') === 'z', bays = c.bays ?? 4;
  const steel = paint(c.color ? parseInt(c.color.slice(1), 16) : 0x5d6268, 0.5);
  steel.metalness = 0.5;
  // Work in "span" (across the ridge) and "run" (along the ridge) feet, then map to plan x / z
  const [s1, s2, r1, r2] = alongZ ? [x1, x2, z1, z2] : [z1, z2, x1, x2];
  const P = (s, y, r) => (alongZ ? new THREE.Vector3(fx(s), y, fz(r)) : new THREE.Vector3(fx(r), y, fz(s)));
  const sm = (s1 + s2) / 2, half = (s2 - s1) * S / 2;
  if (c.floor !== false) rect(x1, z1, x2, z2, 0, 0.06, 0, scene, textured(plasterTex('#9a968e'), 1.5, 0.9));   // rough concrete floor
  // A truss at every bay line, standing on two posts
  for (let i = 0; i <= bays; i++) {
    const r = r1 + (r2 - r1) * i / bays;
    [s1, s2].forEach((s) => {
      rod(P(s, 0, r), P(s, eave, r), 0.07, steel);   // post
      obstacle(P(s, 0, r).x, P(s, 0, r).z, 0.16, 0.16, 0, eave);
    });
    const L = P(s1, eave, r), R = P(s2, eave, r), top = P(sm, eave + rise, r);
    rod(L, R, 0.035, steel);              // tie beam
    rod(L, top, 0.04, steel); rod(R, top, 0.04, steel);   // rafters
    rod(P(sm, eave, r), top, 0.025, steel);                // king post
    [0.25, 0.75].forEach((t) => {        // two struts from the king post foot up to each rafter
      const sq = s1 + (s2 - s1) * t;
      rod(P(sm, eave, r), P(sq, eave + rise * (t < 0.5 ? t : 1 - t) * 2, r), 0.02, steel);
    });
  }
  // Purlins along the ridge, four per slope, carrying the sheets
  [0.05, 0.35, 0.65, 0.95].forEach((t) => [-1, 1].forEach((side) => {
    const s = sm + side * (s2 - s1) / 2 * (1 - t), y = eave + rise * t + 0.05;
    rod(P(s, y, r1 - over / S), P(s, y, r2 + over / S), 0.025, steel);
  }));
  if (c.wall) compoundWall(c.rect, c.wall, steel);
  // Tin sheets, one per slope, with an overhang at the eaves and the gable ends
  const ang = Math.atan2(rise, half), reach = half + over, slopeLen = reach / Math.cos(ang), len = (r2 - r1) * S + 2 * over;
  const roof = new THREE.Group();
  roof.position.copy(P(sm, 0, (r1 + r2) / 2));
  roof.rotation.y = alongZ ? 0 : Math.PI / 2;
  [-1, 1].forEach((side) => {
    const geo = new THREE.BoxGeometry(slopeLen, 0.04, len);
    scaleUV(geo, slopeLen, 0.04, len, 1.0);
    const sheet = new THREE.Mesh(geo, tin());
    sheet.position.set(side * reach / 2, eave + rise - (reach / 2) * Math.tan(ang) + 0.1, 0);
    sheet.rotation.z = -side * ang;   // high at the ridge, low at the eaves
    sheet.castShadow = sheet.receiveShadow = true;
    roof.add(sheet);
  });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, len), paint(0x8d9297, 0.5));   // ridge cap
  cap.position.set(0, eave + rise + 0.12, 0);
  roof.add(cap);
  scene.add(roof);
}

// ---------- Dumbbell paver blocks (interlocking "I" shaped pavers) over a rectangle of the yard ----------
// Columns of blocks with wavy side joints so the blocks lock into each other, straight end joints staggered
// half a block between columns, laid in bands of red and grey columns.
// { "rect": [x1, z1, x2, z2], "colors": [["#b0523c", ...red shades], ["#9e9c97", ...grey shades]], "band": columns per colour (2),
//   "block": block size in m (0.22) }
const paverTex = (colors, band) => makeTexture(512, 512, (ctx, w, h) => {
  const cols = 8, rows = 8, cw = w / cols, bh = h / rows, amp = cw * 0.16;
  // Fill each column with its colour band, block by block (each block a slightly different shade)
  for (let c = 0; c < cols; c++) {
    const set = colors[Math.floor(c / band) % colors.length];
    for (let r = -1; r <= rows; r++) {
      const y0 = r * bh + (c % 2) * bh / 2;
      ctx.fillStyle = set[Math.floor(Math.random() * set.length)];
      ctx.fillRect(c * cw - amp, y0, cw + 2 * amp, bh);
    }
  }
  speckle(ctx, w, h, 9000, 2, 0.07);
  ctx.strokeStyle = '#4e4a44'; ctx.lineWidth = 2.5;
  // Wavy joints between the columns: the blocks pinch in at the waist and swell at the ends (dumbbell shape)
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    for (let y = 0; y <= h; y += 4) {
      const x = c * cw + amp * Math.cos((2 * Math.PI * y) / bh);
      if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Straight end joints across each column, half a block apart in the next column
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows; r++) {
      const y = r * bh + (c % 2) * bh / 2;
      ctx.beginPath(); ctx.moveTo(c * cw + amp * Math.cos((2 * Math.PI * y) / bh), y); ctx.lineTo((c + 1) * cw + amp * Math.cos((2 * Math.PI * y) / bh), y); ctx.stroke();
    }
  }
});
export function pavers(c) {
  const [x1, z1, x2, z2] = c.rect;
  const colors = c.colors ?? [['#b0523c', '#a84a35', '#b85c43', '#9e4632'], ['#a19f9a', '#9a9893', '#aaa8a2', '#93918c']];
  const m = textured(paverTex(colors, c.band ?? 2), (c.block ?? 0.22) * 8, 0.9, 0.4);
  ghostMats.push(m);
  rect(x1, z1, x2, z2, 0, 0.03, 0, scene, m).castShadow = false;
}

// ---------- Compound wall round the plot: the same plastered brick wall as round the shed, with one steel gate ----------
// { "rect": [x1, z1, x2, z2], "height" (m, default 1.22), "gate": { "side": "N" | "S" | "E" | "W", "from" (ft from the west / north end), "width" (ft) } }
export function compound(c) {
  const steel = paint(0x3b3e42, 0.5);
  steel.metalness = 0.5;
  compoundWall(c.rect, { height: c.height, door: c.gate }, steel);
}
// Low plastered brick wall round a rectangle, with a coping on top and one steel gate that swings open as you come near
function compoundWall([x1, z1, x2, z2], w, steel) {
  const h = w.height ?? 1.22, t = 0.75;   // wall height (m), thickness (ft, a 9-inch brick wall)
  const plaster = textured(plasterTex('#c9c1b1'), 1.5, 0.95), coping = 0x9c978d;
  const d = w.door || {}, side = d.side || 'S', dw = d.width ?? 4;
  const run = (horiz, c, a1, a2) => {   // one straight stretch of wall along x (horiz) at z = c, or along z at x = c
    if (a2 - a1 < 0.01) return;
    const [rx1, rz1, rx2, rz2] = horiz ? [a1, c - t / 2, a2, c + t / 2] : [c - t / 2, a1, c + t / 2, a2];
    rect(rx1, rz1, rx2, rz2, 0, h - 0.06, 0, scene, plaster);
    rect(rx1 - 0.1, rz1 - 0.1, rx2 + 0.1, rz2 + 0.1, h - 0.06, 0.06, coping);   // cement coping, a little wider
    obstacle(fx((rx1 + rx2) / 2), fz((rz1 + rz2) / 2), (rx2 - rx1) * S, (rz2 - rz1) * S, 0, h);
  };
  const sides = { N: [true, z1, x1, x2], S: [true, z2, x1, x2], W: [false, x1, z1, z2], E: [false, x2, z1, z2] };
  Object.entries(sides).forEach(([k, [horiz, c, a1, a2]]) => {
    const e1 = a1 - (horiz ? t / 2 : 0), e2 = a2 + (horiz ? t / 2 : 0);   // the long runs cover the corners
    if (k !== side) return run(horiz, c, e1, e2);
    const g1 = a1 + (d.from ?? ((a2 - a1 - dw) / 2)), g2 = g1 + dw;
    run(horiz, c, e1, g1); run(horiz, c, g2, e2);
    // Gate: a steel frame with vertical bars, hinged on the g1 side, opening inwards
    const pivot = new THREE.Group(), len = dw * S, gh = h - 0.1;
    pivot.position.set(horiz ? fx(g1) : fx(c), 0.05, horiz ? fz(c) : fz(g1));
    const bar = (wd, ht, x, y) => box([wd, ht, 0.04], [x, y, 0], 0, pivot, steel);
    bar(len, 0.05, len / 2, gh); bar(len, 0.05, len / 2, 0.05); bar(len, 0.04, len / 2, gh / 2);
    bar(0.05, gh, 0.03, gh / 2); bar(0.05, gh, len - 0.03, gh / 2);
    for (let x = 0.12; x < len - 0.08; x += 0.12) bar(0.02, gh, x, gh / 2);
    const base = horiz ? 0 : -Math.PI / 2, inward = { S: 1, N: -1, W: 1, E: -1 }[side];
    pivot.rotation.y = base;
    scene.add(pivot);
    const mid = (g1 + g2) / 2;
    doors.push({ pivot, base, open: base + inward * Math.PI / 2, cx: horiz ? fx(mid) : fx(c), cz: horiz ? fz(c) : fz(mid) });
  });
}

// ---------- Concrete road: a cement concrete village road along x, cast in panels with joints ----------
// { "z": centre line (ft), "width" (ft, default 12), "x": [from, to] (ft, default the whole ground), "joint": panel length (ft, default 10) }
const concreteTex = () => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#a8a59e'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 12000, 2, 0.07);
  ctx.strokeStyle = 'rgba(80,78,72,0.08)'; ctx.lineWidth = 1;   // broom marks across the road
  for (let y = 0; y < h; y += 4) { ctx.beginPath(); ctx.moveTo(0, y + rand(-1, 1)); ctx.lineTo(w, y + rand(-1, 1)); ctx.stroke(); }
  for (let i = 0; i < 6; i++) {   // a few darker patches where it has weathered
    const x = rand(0, w), y = rand(0, h), r = rand(20, 50), g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(70,68,62,0.12)'); g.addColorStop(1, 'rgba(70,68,62,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
});
export function concreteRoad(c) {
  const width = (c.width ?? 12) * S, [xa, xb] = c.x ? c.x.map(fx) : [-120, 120], len = xb - xa, cx = (xa + xb) / 2, cz = fz(c.z);
  const mat = textured(concreteTex(), 2, 0.9, 0.6);
  ghostMats.push(mat);
  box([len, 0.12, width], [cx, 0.06, cz], 0, scene, mat);                              // slab, a little above the ground
  const jointMat = paint(0x55534e, 0.9);
  box([len, 0.005, 0.03], [cx, 0.122, cz], 0, scene, jointMat);                        // joint down the middle
  const step = (c.joint ?? 10) * S;
  for (let x = xa + step; x < xb - 0.01; x += step) box([0.03, 0.005, width], [x, 0.122, cz], 0, scene, jointMat);   // cross joints
  [-1, 1].forEach((side) => box([len, 0.12, 0.08], [cx, 0.06, cz + side * (width / 2 + 0.04)], 0, scene, paint(0x8d8a82, 0.9)));   // worn edges
  const half = (c.width ?? 12) / 2, [fa, fb] = c.x || [-1e9, 1e9];
  walkables.push((xf, zf) => (Math.abs(zf - c.z) <= half && xf >= fa && xf <= fb ? 0.12 : null));   // you walk on top of the slab
}

// ---------- Sand road: a plain unpaved (kaccha) road of packed sandy earth, with wheel ruts and loose gravel ----------
// { "along": "z" | "x", "at": centre line (ft), "from", "to" (ft, along the road), "width" (ft, default 10) }
const sandTex = () => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#a08a68'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 14000, 2, 0.1);
  for (let i = 0; i < 10; i++) {   // lighter dusty and darker damp patches
    const x = rand(0, w), y = rand(0, h), r = rand(20, 60), g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = Math.random() < 0.5 ? '200,180,140' : '80,64,44';
    g.addColorStop(0, `rgba(${tone},0.14)`); g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 260; i++) {  // gravel
    ctx.fillStyle = `rgba(${rand(90, 160) | 0},${rand(80, 140) | 0},${rand(60, 110) | 0},0.7)`;
    ctx.beginPath(); ctx.arc(rand(0, w), rand(0, h), rand(0.8, 2.2), 0, 7); ctx.fill();
  }
});
export function sandRoad(c) {
  const alongZ = (c.along ?? 'z') === 'z', width = (c.width ?? 10) * S, toM = alongZ ? fz : fx;
  const a = toM(c.from), b = toM(c.to), len = Math.abs(b - a), mid = (a + b) / 2, cross = alongZ ? fx(c.at) : fz(c.at);
  const mat = textured(sandTex(), 2.5, 1.0, 0.8);
  ghostMats.push(mat);
  const put = (w, h, y, off, m) => box(alongZ ? [w, h, len] : [len, h, w], alongZ ? [cross + off, y, mid] : [mid, y, cross + off], 0, scene, m);
  put(width, 0.04, 0.02, 0, mat);                                                  // the road bed, just above the grass
  const rut = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x6e5c44).convertSRGBToLinear(), roughness: 1, transparent: true, opacity: 0.45 });
  [-0.8, 0.8].forEach((o) => put(0.35, 0.004, 0.042, o, rut));                    // two wheel ruts, a cart / tractor width apart
  const half = (c.width ?? 10) / 2, [lo, hi] = [Math.min(c.from, c.to), Math.max(c.from, c.to)];
  walkables.push((xf, zf) => {
    const along = alongZ ? zf : xf, across = alongZ ? xf : zf;
    return Math.abs(across - c.at) <= half && along >= lo && along <= hi ? 0.04 : null;
  });
}

// ---------- Barbed-wire fence (taaranche compound) round a rectangle: concrete posts and galvanised barbed-wire strands ----------
// { "rect": [x1, z1, x2, z2], "height" (m, default 1.5), "spacing" (ft between posts, default 8), "strands" (default 4),
//   "gaps": [["N" | "S" | "E" | "W", from, to], ...] (openings along a side, in plan feet along that side) }
export function wireFence(c) {
  const [x1, z1, x2, z2] = c.rect, hgt = c.height ?? 1.5, spacing = c.spacing ?? 8, strands = c.strands ?? 4;
  const postMat = paint(0x9a978f, 0.9);
  const wireMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x7a7f86).convertSRGBToLinear(), roughness: 0.45, metalness: 0.8 });
  const sides = { N: [x1, z1, x2, z1], S: [x1, z2, x2, z2], W: [x1, z1, x1, z2], E: [x2, z1, x2, z2] };
  const levels = Array.from({ length: strands }, (_, i) => 0.3 + (hgt - 0.4) * i / Math.max(1, strands - 1));
  const barbs = [];   // [x, y, z, along-x?] for every barb, drawn at the end as one instanced mesh
  Object.entries(sides).filter(([side]) => !c.sides || c.sides.includes(side)).forEach(([side, [ax, az, bx, bz]]) => {   // "sides": ["N"...] = only those sides (a straight divider)
    const alongX = az === bz, a0 = alongX ? ax : az, b0 = alongX ? bx : bz;
    // The side split into runs by its gaps
    let runs = [[a0, b0]];
    (c.gaps || []).filter((g) => g[0] === side).forEach(([, g1, g2]) => {
      runs = runs.flatMap(([a, b]) => (g2 <= a || g1 >= b ? [[a, b]] : [[a, g1], [g2, b]].filter(([p, q]) => q - p > 0.01)));
    });
    const P = (t, y) => new THREE.Vector3(alongX ? fx(t) : fx(ax), y, alongX ? fz(az) : fz(t));
    runs.forEach(([a, b]) => {
      const n = Math.max(1, Math.round((b - a) / spacing));
      for (let i = 0; i <= n; i++) {   // concrete posts, a little taller than the top strand
        const p = P(a + (b - a) * i / n, 0);
        box([0.1, hgt + 0.1, 0.1], [p.x, (hgt + 0.1) / 2, p.z], 0, scene, postMat);
      }
      levels.forEach((y) => {
        rod(P(a, y), P(b, y), 0.006, wireMat);
        for (let t = a + 0.5; t < b; t += 1) { const p = P(t, y); barbs.push([p.x, y, p.z, alongX]); }
      });
      const s = P(a, 0), e = P(b, 0);
      obstacle((s.x + e.x) / 2, (s.z + e.z) / 2, Math.max(Math.abs(e.x - s.x), 0.12), Math.max(Math.abs(e.z - s.z), 0.12), 0, hgt);
    });
  });
  // Barbs: a small cross of wire at every foot along each strand
  const barbGeo = new THREE.BoxGeometry(0.07, 0.007, 0.007), inst = new THREE.InstancedMesh(barbGeo, wireMat, barbs.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  barbs.forEach(([x, y, z, alongX], i) => {
    [0.8, -0.8].forEach((tilt, k) => {
      e.set(0, alongX ? Math.PI / 2 : 0, tilt);
      inst.setMatrixAt(i * 2 + k, m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e), one));
    });
  });
  scene.add(inst);
}

// ---------- Coconut tree: a tall, slightly leaning ringed trunk, a crown of long drooping fronds and a bunch of coconuts ----------
// { "at": [x, z] (ft), "height" (m, default 7), "lean" (degrees, default 6), "leanDir" (degrees round from +x, default random) }
let frondTex = null;
const coconutFrondTex = () => frondTex ||= (() => {   // one frond segment: a midrib with leaflets, transparent between them
  const t = makeTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#7a9636'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();               // midrib
    for (let y = 2; y < h; y += 4) {
      const g = rand(110, 160) | 0;
      ctx.strokeStyle = `rgb(${g - 50},${g},${g - 70})`; ctx.lineWidth = 2.5;
      [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(w / 2, y); ctx.lineTo(w / 2 + s * w * 0.48, y + 14); ctx.stroke(); });   // leaflets slanting out
    }
  }, false);
  return t;
})();
export function coconutTree(c) {
  const [xf, zf] = c.at, height = c.height ?? 7, lean = ((c.lean ?? 6) * Math.PI) / 180, dir = ((c.leanDir ?? rand(0, 360)) * Math.PI) / 180;
  const tree = new THREE.Group();
  tree.position.set(fx(xf), 0, fz(zf));
  scene.add(tree);
  // Trunk: stacked tapering segments with darker rings, leaning a little and curving back up near the top
  const bark = textured(makeTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#7d6a55'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 600, 2, 0.12);
    ctx.fillStyle = 'rgba(40,30,20,0.55)'; ctx.fillRect(0, h - 6, w, 6);   // leaf-scar ring
  }), 0.25, 1);
  const segs = 14, segH = height / segs, top = new THREE.Vector3();
  const pt = (i) => {   // centre line of the trunk: leaning, with the lean easing off toward the crown
    const t = i / segs, off = Math.sin(lean) * height * (t - 0.35 * t * t);
    return new THREE.Vector3(Math.cos(dir) * off, t * height, Math.sin(dir) * off);
  };
  for (let i = 0; i < segs; i++) {
    const a = pt(i), b = pt(i + 1), r0 = 0.2 - 0.07 * (i / segs), r1 = 0.2 - 0.07 * ((i + 1) / segs);
    const geo = new THREE.CylinderGeometry(r1, i === 0 ? r0 + 0.06 : r0, a.distanceTo(b) + 0.01, 10);
    const seg = new THREE.Mesh(geo, bark);
    seg.position.copy(a).add(b).multiplyScalar(0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    seg.castShadow = true;
    tree.add(seg);
  }
  top.copy(pt(segs));
  // Crown: long fronds that rise, arch and droop; each is a chain of leafy segments
  const leafMat = new THREE.MeshStandardMaterial({ map: coconutFrondTex(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8, emissive: new THREE.Color(0x0b1606) });
  const fronds = c.fronds ?? 16;
  for (let k = 0; k < fronds; k++) {
    const root = new THREE.Group();
    root.position.copy(top);
    root.rotation.y = (k / fronds) * Math.PI * 2 + rand(-0.15, 0.15);
    tree.add(root);
    let parent = root, rise = k % 3 === 0 ? 0.9 : rand(0.2, 0.55);   // a few young fronds stand up, the rest spread and droop
    for (let s = 0; s < 5; s++) {
      const seg = new THREE.Group();
      seg.rotation.z = s === 0 ? rise : -rand(0.22, 0.32);
      const len = 0.85, wid = 0.95 - s * 0.14;
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(len + 0.12, wid), leafMat);   // a little longer than the step, so the segments overlap
      leaf.rotation.x = -Math.PI / 2 + rand(-0.08, 0.08);   // lie flat-ish, with a slight twist
      leaf.rotation.z = -Math.PI / 2;                        // texture midrib runs along the frond
      leaf.position.x = len / 2;
      leaf.castShadow = true;
      seg.add(leaf);
      const next = new THREE.Group();
      next.position.x = len;
      seg.add(next);
      parent.add(seg);
      parent = next;
    }
  }
  // A bunch of coconuts just under the crown
  const nutMat = paint(0x5d6b2a, 0.6), nutMatDry = paint(0x7a5a2a, 0.7);
  for (let n = 0; n < 7; n++) {
    const ang = rand(0, Math.PI * 2), r = rand(0.18, 0.3);
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), n % 3 ? nutMat : nutMatDry);
    nut.scale.y = 1.15;
    nut.position.set(top.x + Math.cos(ang) * r, top.y - rand(0.15, 0.45), top.z + Math.sin(ang) * r);
    nut.castShadow = true;
    tree.add(nut);
  }
  obstacle(fx(xf), fz(zf), 0.45, 0.45, 0, height);   // you cannot walk through the trunk
}

// ---------- Garden: lawn, flower beds, stepping stones, fruit trees, tulsi vrindavan, jhula, bench ----------
// Lawn: a patch of fresher, trimmed grass with a low brick edging: { "rect" }
const lawnTex = () => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#3d7a32'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 16000; i++) {
    ctx.strokeStyle = `rgb(${rand(45, 85)},${rand(110, 160)},${rand(35, 65)})`;
    const x = Math.random() * w, y = Math.random() * h;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand(-1.5, 1.5), y - rand(1.5, 4)); ctx.stroke();
  }
});
const brickEdge = () => paint(0xa0523d, 0.85);
function edging([x1, z1, x2, z2], h, mat) {
  const t = 0.35;   // ft
  rect(x1, z1, x2, z1 + t, 0, h, 0, scene, mat); rect(x1, z2 - t, x2, z2, 0, h, 0, scene, mat);
  rect(x1, z1, x1 + t, z2, 0, h, 0, scene, mat); rect(x2 - t, z1, x2, z2, 0, h, 0, scene, mat);
}
export function lawn(c) {
  const m = textured(lawnTex(), 1.5, 0.95, 0.3);
  ghostMats.push(m);
  rect(...c.rect, 0, 0.04, 0, scene, m).castShadow = false;
  edging(c.rect, 0.08, brickEdge());
}

// Flower bed: dark soil inside a brick edge, planted with leafy bushes in flower: { "rect", "colors": ["#hex"...], "spacing" (ft) }
export function flowerBed(c) {
  const [x1, z1, x2, z2] = c.rect;
  rect(x1, z1, x2, z2, 0, 0.12, 0x4a3426).castShadow = false;
  edging(c.rect, 0.18, brickEdge());
  const colors = c.colors ?? ['#d42a2a', '#f39a1e', '#f5d12e', '#e0559a', '#ffffff'], step = c.spacing ?? 1.4;
  const bushes = [], flowers = colors.map(() => []);
  let k = 0;
  for (let x = x1 + step / 2 + 0.2; x < x2 - 0.3; x += step)
    for (let z = z1 + step / 2 + 0.2; z < z2 - 0.3; z += step, k++) {
      const px = fx(x + rand(-0.25, 0.25)), pz = fz(z + rand(-0.25, 0.25)), r = rand(0.17, 0.25);
      bushes.push([px, 0.12 + r * 0.7, pz, r]);
      const ci = k % colors.length;
      for (let f = 0; f < 7; f++) {
        const a = rand(0, Math.PI * 2), up = rand(0.2, 1);
        flowers[ci].push([px + Math.cos(a) * r * 0.9 * Math.sqrt(1 - up * up * 0.6), 0.12 + r * 0.7 + up * r * 0.8, pz + Math.sin(a) * r * 0.9 * Math.sqrt(1 - up * up * 0.6)]);
      }
    }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const bushMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 9, 7), paint(0x2f6a2a, 0.85), bushes.length);
  bushes.forEach(([x, y, z, r], i) => bushMesh.setMatrixAt(i, mtx.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r, r * 0.75, r))));
  bushMesh.castShadow = true;
  scene.add(bushMesh);
  colors.forEach((col, ci) => {
    if (!flowers[ci].length) return;
    const fm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), paint(col, 0.6), flowers[ci].length);
    flowers[ci].forEach(([x, y, z], i) => fm.setMatrixAt(i, mtx.compose(new THREE.Vector3(x, y, z), q, one)));
    scene.add(fm);
  });
}

// Stepping stones laid along a line through the given points: { "points": [[x, z], ...], "spacing" (ft), "size" (ft) }
export function steppingStones(c) {
  const pts = c.points, step = c.spacing ?? 2, size = c.size ?? 1.6;
  const mats = [paint(0x9c978d, 0.9), paint(0x8b867c, 0.9), paint(0xa8a398, 0.9)];
  let i = 0;
  for (let p = 0; p < pts.length - 1; p++) {
    const [ax, az] = pts[p], [bx, bz] = pts[p + 1], len = Math.hypot(bx - ax, bz - az);
    for (let d = p === 0 ? 0 : step; d <= len + 0.01; d += step, i++) {
      const t = d / len, s = size * S * rand(0.85, 1.05);
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(s / 2, s / 2, 0.06, 7), mats[i % 3]);
      stone.scale.z = rand(0.7, 0.9);
      stone.rotation.y = rand(0, Math.PI);
      stone.position.set(fx(ax + (bx - ax) * t), 0.03, fz(az + (bz - az) * t));
      stone.receiveShadow = true;
      scene.add(stone);
    }
  }
}

// Fruit tree: { "at": [x, z], "kind": "mango" | "banana" | "papaya", "height" (m) }
let foliageMat;
export function fruitTree(c) {
  const [xf, zf] = c.at, kind = c.kind ?? 'mango';
  const g = new THREE.Group();
  g.position.set(fx(xf), 0, fz(zf));
  g.rotation.y = rand(0, Math.PI * 2);
  g.scale.setScalar(c.scale ?? 1);
  scene.add(g);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (kind === 'mango') {
    const h = c.height ?? 5;
    foliageMat ||= textured(leafTex(), 0.6, 0.9);
    add(new THREE.CylinderGeometry(0.14, 0.22, h * 0.45, 9), paint(0x5a4433, 0.9), 0, h * 0.225, 0);
    [[0, 0.62, 0, 1.5], [0.8, 0.55, 0.3, 1.1], [-0.7, 0.58, -0.4, 1.15], [0.2, 0.8, -0.6, 1.0], [-0.3, 0.75, 0.7, 1.05], [0.5, 0.88, 0.5, 0.85]]
      .forEach(([x, y, z, r]) => { const b = add(new THREE.SphereGeometry(r, 12, 9), foliageMat, x, y * h, z); b.scale.y = 0.8; });
    const fruit = paint(0xd9a520, 0.5);
    for (let n = 0; n < 14; n++) {
      const a = rand(0, Math.PI * 2), r = rand(1.3, 1.7);
      add(new THREE.SphereGeometry(0.07, 8, 6), fruit, Math.cos(a) * r, h * rand(0.42, 0.6), Math.sin(a) * r).scale.y = 1.4;
    }
    obstacle(fx(xf), fz(zf), 0.5 * (c.scale ?? 1), 0.5 * (c.scale ?? 1), 0, h * (c.scale ?? 1));
    return;
  }
  const leafM = new THREE.MeshStandardMaterial({ color: kind === 'banana' ? 0x5f9a3a : 0x3f7a2e, roughness: 0.75, side: THREE.DoubleSide });
  if (kind === 'banana') {
    const h = c.height ?? 2.8;
    add(new THREE.CylinderGeometry(0.1, 0.16, h * 0.7, 10), paint(0x7f8a4a, 0.85), 0, h * 0.35, 0);
    for (let k = 0; k < 8; k++) {   // long broad leaves arching out and drooping, each in two bent pieces
      const root = new THREE.Group();
      root.position.y = h * 0.68;
      root.rotation.y = (k / 8) * Math.PI * 2 + rand(-0.2, 0.2);
      g.add(root);
      const a = new THREE.Group(); a.rotation.z = rand(0.5, 0.9); root.add(a);
      const l1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), leafM); l1.rotation.x = -Math.PI / 2; l1.position.x = 0.45; l1.castShadow = true; a.add(l1);
      const b = new THREE.Group(); b.position.x = 0.9; b.rotation.z = -rand(0.6, 0.9); a.add(b);
      const l2 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.38), leafM); l2.rotation.x = -Math.PI / 2; l2.position.x = 0.4; l2.castShadow = true; b.add(l2);
    }
    const bunch = add(new THREE.CylinderGeometry(0.16, 0.08, 0.45, 8), paint(0x8fae3a, 0.6), 0.2, h * 0.5, 0);
    bunch.rotation.z = 0.25;
    obstacle(fx(xf), fz(zf), 0.35, 0.35, 0, h);
    return;
  }
  // papaya: thin ringed trunk, a crown of leaves on long stalks, fruit hugging the trunk under the crown
  const h = c.height ?? 3.6;
  add(new THREE.CylinderGeometry(0.07, 0.12, h, 9), paint(0x8a8370, 0.9), 0, h / 2, 0);
  for (let k = 0; k < 11; k++) {
    const root = new THREE.Group();
    root.position.y = h;
    root.rotation.y = (k / 11) * Math.PI * 2;
    g.add(root);
    const s = new THREE.Group(); s.rotation.z = rand(0.3, 0.8); root.add(s);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.8, 5), paint(0x9fb05a, 0.7));
    stalk.rotation.z = -Math.PI / 2; stalk.position.x = 0.4; s.add(stalk);
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.32, 7), leafM);
    leaf.rotation.x = -Math.PI / 2; leaf.position.x = 0.95; leaf.castShadow = true; s.add(leaf);
  }
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2;
    add(new THREE.SphereGeometry(0.09, 8, 6), paint(n % 2 ? 0x5d8a2a : 0xd99a2a, 0.5), Math.cos(a) * 0.13, h - 0.25 - (n % 2) * 0.12, Math.sin(a) * 0.13).scale.y = 1.6;
  }
  obstacle(fx(xf), fz(zf), 0.3, 0.3, 0, h);
}

// Tulsi vrindavan: a plastered square pedestal with a niche, tulsi growing out of the top: { "at": [x, z], "color" }
export function tulsi(c) {
  const [xf, zf] = c.at, x = fx(xf), z = fz(zf), col = c.color ?? 0xe8d9b5;
  box([0.75, 0.12, 0.75], [x, 0.06, z], 0xbcae96);
  box([0.55, 0.85, 0.55], [x, 0.545, z], col);
  box([0.65, 0.08, 0.65], [x, 1.01, z], 0xd2742a);   // saffron rim
  box([0.2, 0.25, 0.02], [x, 0.6, z + 0.27], 0x3a2a22);   // diya niche (faces south)
  glow([0.04, 0.04, 0.02], [x, 0.52, z + 0.275], 0xffb347);
  const leafM = [paint(0x2f5a2c), paint(0x3f6b34), paint(0x4c3a5a)];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(rand(0.07, 0.12), 8, 6), leafM[i % 3]);
    s.position.set(x + rand(-0.15, 0.15), 1.1 + rand(0, 0.4), z + rand(-0.15, 0.15));
    s.castShadow = true;
    scene.add(s);
  }
  obstacle(x, z, 0.75, 0.75, 0, 1.05);
}

// Jhula: A-frame steel swing with a wooden plank seat that sways gently: { "at": [x, z], "along": "x" | "z" (direction of the top bar) }
export function swing(c) {
  const [xf, zf] = c.at, alongX = (c.along ?? 'x') === 'x', H = 2.3, W = 1.6, spread = 0.7;
  const steelM = paint(0x2f4a5a, 0.5); steelM.metalness = 0.4;
  const g = new THREE.Group();
  g.position.set(fx(xf), 0, fz(zf));
  if (!alongX) g.rotation.y = Math.PI / 2;
  scene.add(g);
  const bar = (a, b, r) => {
    const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), steelM);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; g.add(m);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  [-1, 1].forEach((s) => { bar(V(s * W / 2, H, 0), V(s * W / 2, 0, -spread), 0.035); bar(V(s * W / 2, H, 0), V(s * W / 2, 0, spread), 0.035); });
  bar(V(-W / 2 - 0.05, H, 0), V(W / 2 + 0.05, H, 0), 0.04);
  const seat = new THREE.Group();   // hangs from the top bar; swings about it
  seat.position.y = H;
  g.add(seat);
  const wood = paint(0x8a5a32, 0.7);
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.4), wood);
  plank.position.y = -1.75; plank.castShadow = true; seat.add(plank);
  const chainM = paint(0x777777, 0.4);
  [-0.45, 0.45].forEach((x) => [-0.17, 0.17].forEach((z) => {
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.75, 4), chainM);
    ch.position.set(x, -0.875, z * 0.5); ch.rotation.x = z > 0 ? -0.05 : 0.05; seat.add(ch);
  }));
  const phase = rand(0, 6);
  updaters.push((t) => { seat.rotation.x = Math.sin(t * 1.4 + phase) * 0.07; });
  const w = alongX ? W + 0.2 : 2 * spread, d = alongX ? 2 * spread : W + 0.2;
  obstacle(fx(xf), fz(zf), w, d, 0, H);
}

// Garden bench: wooden slats on cast-iron sides: { "at": [x, z], "face": "+z" | "-z" | "+x" | "-x", "length" (m) }
export function bench(c) {
  const [xf, zf] = c.at, L = c.length ?? 1.4, face = c.face ?? '+z';
  const g = new THREE.Group();
  g.position.set(fx(xf), 0, fz(zf));
  g.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[face];
  scene.add(g);
  const iron = paint(0x222428, 0.5), wood = paint(0x8a5a32, 0.7);
  const piece = (size, pos, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(...size), m); b.position.set(...pos); b.castShadow = true; g.add(b); };
  [-L / 2 + 0.05, L / 2 - 0.05].forEach((x) => {
    piece([0.05, 0.45, 0.05], [x, 0.225, 0.18], iron); piece([0.05, 0.85, 0.05], [x, 0.425, -0.2], iron);
    piece([0.05, 0.05, 0.45], [x, 0.43, 0], iron); piece([0.05, 0.05, 0.4], [x, 0.65, 0.02], iron);
  });
  for (let i = 0; i < 4; i++) piece([L, 0.03, 0.08], [0, 0.47, 0.15 - i * 0.1], wood);
  for (let i = 0; i < 3; i++) piece([L, 0.08, 0.025], [0, 0.6 + i * 0.11, -0.21], wood);
  const w = face[1] === 'z' ? L : 0.5, d = face[1] === 'z' ? 0.5 : L;
  obstacle(fx(xf), fz(zf), w, d, 0, 0.5);
}

// ---------- Orchard: a grid of fruit trees (big mango trees by default), a little jittered: { "rect", "kind", "spacing" (ft), "scale" } ----------
// "points": [[x, z]...] instead of "rect" fills any outline; "avoid": [[x1, z1, x2, z2]...] keeps trees off houses, yards...
const insidePoly = (pts, x, z) => { let inn = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inn = !inn; } return inn; };
export function orchard(c) {
  const P = c.points, R = c.rect ?? [Math.min(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[0])), Math.max(...P.map((p) => p[1]))];
  const [x1, z1, x2, z2] = R, sp = c.spacing ?? 22, kind = c.kind ?? 'mango';
  // "cols" (trees across x) and "rows" (along z) set the grid exactly; "count" stops after that many trees (the last row may be short)
  const nx = c.cols ?? Math.max(1, Math.round((x2 - x1) / sp)), nz = c.rows ?? Math.max(1, Math.round((z2 - z1) / sp));
  let planted = 0;
  const gx = (x2 - x1) / nx, gz = (z2 - z1) / nz;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      if (c.count && planted >= c.count) return;
      const tx = x1 + gx * (i + 0.5), tz = z1 + gz * (j + 0.5);
      if (P && !insidePoly(P, tx, tz)) continue;
      if ((c.avoid || []).some(([a1, b1, a2, b2]) => tx > a1 - 3 && tx < a2 + 3 && tz > b1 - 3 && tz < b2 + 3)) continue;
      planted++;
      fruitTree({ kind, height: c.height, scale: (c.scale ?? 1.8) * rand(c.vary ?? 0.92, 1.05),
        at: [tx + rand(-0.5, 0.5), tz + rand(-0.5, 0.5)] });
    }
}

// ---------- Farm field: tilled soil inside a raised earth bund, crop planted in rows ----------
// { "rect", "crop": "sugarcane" | "jowar" | "vegetables" | "none", "rows": "x" | "z" (direction the rows run; default the long side), "rowSpacing", "plantSpacing" (ft) }
const soilTex = () => makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#6e5241'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 3000, 2, 0.18);
});
// Ploughed field of any shape (as traced from the satellite view): { "points": [[x, z], ...], "rowAngle" (deg, 0 = rows run along x; default: along the longest edge), "rowSpacing" (ft) }
function farmPoly(c) {
  const pts = c.points, rs = c.rowSpacing ?? 2.5;
  // Soil: a flat shape; ShapeGeometry lies in XY, so build it with y = -z and lay it down
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(fx(x), -fz(z))));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);   // one texture repeat = 2 m
  const soil = textured(soilTex(), 2, 1, 0.4);
  ghostMats.push(soil);
  const field = new THREE.Mesh(geo, soil);
  field.position.y = 0.05;
  field.receiveShadow = true;
  scene.add(field);
  // Row direction: given, or along the longest edge
  let ang = c.rowAngle != null ? (c.rowAngle * Math.PI) / 180 : 0;
  if (c.rowAngle == null) {
    let best = 0;
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > best) { best = l; ang = Math.atan2(q[1] - p[1], q[0] - p[0]); } });
  }
  const ux = Math.cos(ang), uz = Math.sin(ang), nx = -uz, nz = ux;   // u: along the rows, n: across
  const across = pts.map(([x, z]) => x * nx + z * nz), lo = Math.min(...across), hi = Math.max(...across);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), segs = [];
  const seg = (a, b, w, h) => segs.push([a, b, w, h]);
  for (let o = lo + rs / 2; o < hi; o += rs) {   // each furrow ridge: where the line n.p = o crosses the outline
    const hits = [];
    pts.forEach((p, i) => {
      const q2 = pts[(i + 1) % pts.length], dp = p[0] * nx + p[1] * nz - o, dq = q2[0] * nx + q2[1] * nz - o;
      if ((dp < 0) !== (dq < 0)) { const t = dp / (dp - dq); hits.push((p[0] + (q2[0] - p[0]) * t) * ux + (p[1] + (q2[1] - p[1]) * t) * uz); }
    });
    hits.sort((a, b) => a - b);
    for (let k = 0; k + 1 < hits.length; k += 2) {
      const s0 = hits[k] + 0.6, s1 = hits[k + 1] - 0.6;
      if (s1 > s0) seg([s0 * ux + o * nx, s0 * uz + o * nz], [s1 * ux + o * nx, s1 * uz + o * nz], 0.7, 0.12);
    }
  }
  pts.forEach((p, i) => seg(p, pts[(i + 1) % pts.length], 0.9, 0.18));   // bund round the edge
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), paint(0x5a4232, 1), segs.length);
  segs.forEach(([a, b, w, h], i) => {
    const dx = (b[0] - a[0]) * S, dz = (b[1] - a[1]) * S;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dz, dx));
    m.setMatrixAt(i, mtx.compose(new THREE.Vector3(fx((a[0] + b[0]) / 2), 0.05 + h / 2, fz((a[1] + b[1]) / 2)), q, new THREE.Vector3(Math.hypot(dx, dz), h, w * S)));
  });
  m.receiveShadow = true;
  scene.add(m);
}
export function farm(c) {
  if (c.points) return farmPoly(c);
  const [x1, z1, x2, z2] = c.rect, crop = c.crop ?? 'jowar';
  const soil = textured(soilTex(), 2, 1, 0.4);
  ghostMats.push(soil);
  rect(x1, z1, x2, z2, 0, 0.05, 0, scene, soil).castShadow = false;
  edging(c.rect, 0.2, paint(0x6b5040, 1));   // bund round the field
  const alongX = (c.rows ?? (x2 - x1 >= z2 - z1 ? 'x' : 'z')) === 'x';
  const rs = c.rowSpacing ?? (crop === 'sugarcane' ? 3 : 2.5), ps = c.plantSpacing ?? (crop === 'vegetables' ? 1.5 : 1.2);
  const [a1, a2, b1, b2] = alongX ? [x1, x2, z1, z2] : [z1, z2, x1, x2];   // a: along the row, b: across
  const ridgeM = paint(0x4e3828, 1), spots = [];
  for (let b = b1 + rs / 2 + 0.5; b < b2 - 0.5; b += rs) {
    if (alongX) rect(a1 + 0.5, b - 0.35, a2 - 0.5, b + 0.35, 0, 0.12, 0, scene, ridgeM).castShadow = false;
    else rect(b - 0.35, a1 + 0.5, b + 0.35, a2 - 0.5, 0, 0.12, 0, scene, ridgeM).castShadow = false;
    for (let a = a1 + 1; a < a2 - 0.8; a += ps) {
      const p = alongX ? [a, b] : [b, a];
      spots.push([fx(p[0] + rand(-0.15, 0.15)), fz(p[1] + rand(-0.15, 0.15))]);
    }
  }
  if (crop === 'none' || !spots.length) return;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const inst = (geo, mat, list, shadow = true) => {   // list: [pos, scale, euler]
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([p, s, r], i) => m.setMatrixAt(i, mtx.compose(p, r ? q.setFromEuler(e.set(...r)) : q.identity(), s)));
    m.castShadow = shadow;
    scene.add(m);
  };
  const blade = new THREE.BoxGeometry(0.05, 1, 0.006); blade.translate(0, 0.5, 0);
  if (crop === 'vegetables') {
    const leafs = [[], []];
    spots.forEach(([x, z], i) => { const r = rand(0.14, 0.22); leafs[i % 2].push([V(x, 0.12 + r * 0.5, z), V(r, r * 0.7, r)]); });
    inst(new THREE.SphereGeometry(1, 8, 6), paint(0x6f9a3a, 0.8), leafs[0]);
    inst(new THREE.SphereGeometry(1, 8, 6), paint(0x3f7a34, 0.8), leafs[1]);
    return;
  }
  const tall = crop === 'sugarcane', H = tall ? 2.4 : 1.6;
  const stalks = [], leaves = [], heads = [];
  spots.forEach(([x, z]) => {
    const n = tall ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const h = H * rand(0.85, 1.1), sx = x + rand(-0.08, 0.08), sz = z + rand(-0.08, 0.08), lean = [rand(-0.06, 0.06), 0, rand(-0.06, 0.06)];
      stalks.push([V(sx, 0.1 + h / 2, sz), V(1, h, 1), lean]);
      for (let l = 0; l < (tall ? 3 : 4); l++) {   // long blades arching out from the stalk
        const yaw = rand(0, Math.PI * 2), tilt = rand(0.5, 1.0);
        leaves.push([V(sx, 0.1 + h * (tall ? rand(0.6, 0.95) : rand(0.2, 0.75)), sz), V(1, tall ? 1.1 : 0.7, 1), [Math.cos(yaw) * tilt, yaw, Math.sin(yaw) * tilt]]);
      }
      if (!tall) heads.push([V(sx, 0.1 + h + 0.1, sz), V(0.07, 0.16, 0.07)]);
    }
  });
  inst(new THREE.CylinderGeometry(tall ? 0.025 : 0.015, tall ? 0.03 : 0.02, 1, 5), paint(tall ? 0x9aa84a : 0x7f9a45, 0.8), stalks);
  inst(blade, new THREE.MeshStandardMaterial({ color: tall ? 0x5e9a3a : 0x6a9a40, roughness: 0.8, side: THREE.DoubleSide }), leaves);
  if (heads.length) inst(new THREE.SphereGeometry(1, 7, 5), paint(0xa8843f, 0.8), heads);
}

// ---------- Field bund (shetacha bandh): a raised, rounded ridge of packed earth with sparse grass on its sides ----------
// { "points": [[x, z], ...] (centre line, ft), "width" (ft at the base, default 3), "height" (m, default 0.45) }
const bundTex = () => makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#7d5f47'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) {   // lumps and cracks of dry soil
    ctx.fillStyle = rand(0, 1) < 0.5 ? 'rgba(60,42,30,0.18)' : 'rgba(160,130,100,0.15)';
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, rand(2, 7), 0, 7); ctx.fill();
  }
  speckle(ctx, w, h, 2500, 2, 0.2);
});
export function bund(c) {
  const pts = c.points, W = (c.width ?? 3) * S, H = c.height ?? 0.45;
  const prof = [[-0.5, 0], [-0.32, 0.6], [-0.15, 0.93], [0, 1], [0.15, 0.93], [0.32, 0.6], [0.5, 0]];   // rounded cross-section
  const mat = textured(bundTex(), 1, 1, 0.5);
  ghostMats.push(mat);
  const tufts = [];
  for (let p = 0; p < pts.length - 1; p++) {
    const a = new THREE.Vector3(fx(pts[p][0]), 0, fz(pts[p][1])), b = new THREE.Vector3(fx(pts[p + 1][0]), 0, fz(pts[p + 1][1]));
    const dir = b.clone().sub(a), len = dir.length();
    dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x), steps = Math.max(2, Math.round(len / 0.4));
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, wob = 1 + rand(-0.08, 0.08), hh = H * (i === 0 || i === steps ? 0.6 : rand(0.88, 1.08));   // uneven, ends slump
      prof.forEach(([u, v]) => {
        const p0 = a.clone().lerp(b, t).addScaledVector(side, u * W * wob);
        pos.push(p0.x, v * hh, p0.z);
        uv.push(t * len, (u + 0.5) * W * 1.6);
      });
      if (i < steps) for (let k = 0; k < prof.length - 1; k++) {
        const r0 = i * prof.length + k, r1 = r0 + prof.length;
        idx.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
      }
      if (Math.random() < 0.55) [-1, 1].forEach((s) => {   // grass along the foot of each side
        if (Math.random() < 0.6) tufts.push(a.clone().lerp(b, t).addScaledVector(side, s * W * rand(0.3, 0.52)).setY(rand(0.02, 0.12)));
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    if (geo.attributes.normal.getY(Math.floor(prof.length / 2)) < 0) { geo.setIndex(idx.map((_, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]])); geo.computeVertexNormals(); }   // keep the top facing up
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  // Grass tufts: a few thin blades each, olive to dry yellow-green
  const blade = new THREE.BoxGeometry(0.02, 1, 0.004); blade.translate(0, 0.5, 0);
  const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: 0x7f9a45, roughness: 0.85, side: THREE.DoubleSide }), tufts.length * 4);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  tufts.forEach((p, i) => {
    for (let k = 0; k < 4; k++) {
      const yaw = rand(0, Math.PI * 2), tilt = rand(0.15, 0.6), h = rand(0.12, 0.3);
      grass.setMatrixAt(i * 4 + k, mtx.compose(p, q.setFromEuler(e.set(Math.cos(yaw) * tilt, yaw, Math.sin(yaw) * tilt)), new THREE.Vector3(1, h, 1)));
    }
  });
  scene.add(grass);
}

// ---------- Parking: white bay lines painted on the ground: { "rect": [x1, z1, x2, z2], "bays": 5, "along": "z" (bays side by side along x, cars nose to the south) } ----------
export function parking(c) {
  const [x1, z1, x2, z2] = c.rect, n = c.bays ?? 4, w = (x2 - x1) / n, line = paint(0xf2f2ee, 0.9), t = 0.12;
  for (let i = 0; i <= n; i++) rect(x1 + i * w - t / 2, z1, x1 + i * w + t / 2, z2, 0.03, 0.036, 0, scene, line).castShadow = false;
  rect(x1, z1 - t / 2, x2, z1 + t / 2, 0.03, 0.036, 0, scene, line).castShadow = false;
}

// Maruti Suzuki Swift (hatchback), about 3.85 x 1.7 x 1.5 m: { "at": [x, z] (centre), "face": "+z" | "-z" | "+x" | "-x" (way the nose points), "color" }
export function car(c) {
  const [xf, zf] = c.at, face = c.face ?? '+z';
  const g = new THREE.Group();
  g.position.set(fx(xf), 0, fz(zf));
  g.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[face];
  scene.add(g);
  const body = paint(hex(c.color ?? '#c7332b'), 0.3), glass = paint(0x1b2833, 0.08), dark = paint(0x1c1c1e, 0.6), chrome = paint(0xbfc3c7, 0.25);
  const lampM = paint(0xfff6d6, 0.2), tailM = paint(0xb01820, 0.3);
  const part = (size, pos, m, rotX = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(...size), m); b.position.set(...pos); b.rotation.x = rotX; b.castShadow = true; g.add(b); return b; };
  // local x = across, z = along (nose at +z)
  part([1.66, 0.5, 3.85], [0, 0.57, 0], body);                  // lower body
  part([1.6, 0.14, 1.0], [0, 0.88, 1.35], body);                 // bonnet
  part([1.58, 0.52, 2.0], [0, 1.1, -0.45], body);                // cabin
  part([1.5, 0.5, 0.06], [0, 1.1, 0.62], glass, -0.55);          // windscreen
  part([1.5, 0.46, 0.06], [0, 1.12, -1.5], glass, 0.35);         // rear glass
  [-1, 1].forEach((s) => part([0.03, 0.34, 1.6], [s * 0.8, 1.14, -0.4], glass));   // side windows
  part([1.7, 0.18, 0.12], [0, 0.34, 1.9], dark);                 // front bumper
  part([1.7, 0.18, 0.12], [0, 0.34, -1.9], dark);                // rear bumper
  part([0.9, 0.12, 0.03], [0, 0.5, 1.93], dark);                 // grille
  [-1, 1].forEach((s) => {
    part([0.34, 0.12, 0.05], [s * 0.6, 0.66, 1.93], lampM);      // headlights
    part([0.3, 0.14, 0.05], [s * 0.62, 0.7, -1.93], tailM);      // tail lights
    [1.2, -1.2].forEach((z) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16), dark);
      w.rotation.z = Math.PI / 2; w.position.set(s * 0.8, 0.3, z); w.castShadow = true; g.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.235, 12), chrome);
      hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); g.add(hub);
    });
  });
  const along = face[1] === 'z';
  obstacle(fx(xf), fz(zf), along ? 1.8 : 3.9, along ? 3.9 : 1.8, 0, 1.5);
}

// ---------- Farshi: square stone floor slabs (Shahabad / Kota) laid on the ground with mortar joints ----------
// { "rect", "size" (ft, one slab, default 2), "colors": ["#hex", ...] (slab tones), "joint" (mortar colour) }
export function farshi(c) {
  const n = 4, colors = c.colors ?? ['#8d8f86', '#7f827a', '#959a8f', '#868a80', '#9a9788'];
  const tex = makeTexture(256, 256, (ctx, w, h) => {
    const s = w / n;
    ctx.fillStyle = c.joint ?? '#5d5c56'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
    speckle(ctx, w, h, 5000, 1.5, 0.12);
    for (let i = 0; i < n * n; i++) {   // faint chisel marks and stains
      ctx.fillStyle = 'rgba(40,40,35,0.08)';
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, rand(3, 10), 0, 7); ctx.fill();
    }
  });
  const m = textured(tex, n * (c.size ?? 2) * S, 0.7, 0.15);
  ghostMats.push(m);
  const [x1, z1, x2, z2] = c.rect;
  rect(x1, z1, x2, z2, 0, 0.06, 0, scene, m).castShadow = false;
}

// Car shade: steel posts and a gently sloping sheet roof over a parking spot: { "rect": [x1, z1, x2, z2], "height" (m, high side), "drop" (m, fall towards +z), "color" }
export function carShade(c) {
  const [x1, z1, x2, z2] = c.rect, H = c.height ?? 2.5, drop = c.drop ?? 0.3;
  const steel = paint(0x2f3a44, 0.5), sheet = paint(hex(c.color ?? '#3f6f8f'), 0.45);
  const X1 = fx(x1), X2 = fx(x2), Z1 = fz(z1), Z2 = fz(z2), W = X2 - X1, D = Z2 - Z1, ang = Math.atan2(drop, D);
  const mk = (size, pos, m) => { const b = box(size, pos, 0, scene, m); b.castShadow = true; return b; };
  [[X1, Z1, H], [X2, Z1, H], [X1, Z2, H - drop], [X2, Z2, H - drop]].forEach(([x, z, h]) => {
    mk([0.1, h, 0.1], [x, h / 2, z], steel);
    obstacle(x, z, 0.1, 0.1, 0, h);
  });
  [Z1, Z2].forEach((z, i) => mk([W + 0.2, 0.08, 0.08], [(X1 + X2) / 2, (i ? H - drop : H) - 0.04, z], steel));
  for (let i = 0; i <= 4; i++) mk([0.06, 0.06, D + 0.2], [X1 + (W * i) / 4, H - drop / 2 + 0.02, (Z1 + Z2) / 2], steel).rotation.x = ang;
  const roof = mk([W + 0.4, 0.04, Math.hypot(D, drop) + 0.4], [(X1 + X2) / 2, H - drop / 2 + 0.08, (Z1 + Z2) / 2], sheet);
  roof.rotation.x = ang;
  for (let i = 1; i < 12; i++) {   // ribs of the sheet
    const r = mk([0.03, 0.03, Math.hypot(D, drop) + 0.4], [X1 - 0.2 + ((W + 0.4) * i) / 12, H - drop / 2 + 0.11, (Z1 + Z2) / 2], sheet);
    r.rotation.x = ang;
  }
}
