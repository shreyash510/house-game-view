// Outdoor components (ground level): road with pavement and street lamps, hedges, fireflies, open farm shed.
import { scene, box, glow, obstacle, textured, tileTex, makeTexture, speckle, paint, glowTex, ghostMats, updaters, fx, fz, S, rand, rect, rod, plasterTex, scaleUV, doors, walkables } from '../core.js';
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
  Object.entries(sides).forEach(([side, [ax, az, bx, bz]]) => {
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
