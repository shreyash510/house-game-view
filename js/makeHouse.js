// makeHouse(config): a quick way to draw any simple house by listing its rooms, doors and windows.
// Used for the "otherHouses" list in house.json. Everything is in FEET on the same plan grid (+z faces the road).
//
//   {
//     "name": "My house",
//     "at": [46, 3],                       // where the house's north-west corner sits on the plan
//     "wall": 3.0,                         // wall height in metres (optional, default 3)
//     "wallColor": "#d3c7ae",              // optional
//     "rooms": [                           // rectangles, positions relative to "at"; rooms that touch share their wall
//       { "name": "Room", "x": 0, "z": 0, "w": 12, "d": 13 },
//       { "name": "Hall", "x": 0, "z": 13, "w": 24, "d": 10 }
//     ],
//     "openings": [                        // side = which wall of that room: N, S, E or W
//       { "room": "Hall", "side": "S", "from": 10.5, "width": 3, "type": "door" },   // from = feet from the start of that wall (west end for N/S, north end for E/W)
//       { "room": "Room", "side": "N", "from": 4, "width": 3.5, "type": "win" }      // type: door | win | vent | open
//     ],
//     "roof": { "type": "gable", "ridge": "x", "rise": 1.4 },   // or { "type": "flat" }
//     "roof": { "type": "shed", "high": "S", "rise": [0.25, 0.65] },   // single slope: the high (S or N) wall rises rise[1] above the
//                                                                    // walls, the low one rise[0]; the sheet runs between them, sides open
//     "furniture": [{ "x": 1, "z": 1, "w": 4, "d": 6, "h": 0.45, "color": "#7c5a3a" }],  // optional blocks, relative to "at"
//     "weathered": true,                   // optional: damp patches and rain streaks on the plaster
//     "ota": { "height": 0.9, "depth": 5, "steps": { "from": 9, "width": 6, "tread": 1, "count": 3 },
//              "roof": { "back": 2.55, "front": 2.15, "posts": [0.4, 8, 16, 23.6] },          // optional tin veranda roof on posts
//              "entry": "E", "entryWidth": 4,                                                  // optional: a gap in the middle of this end ("E" or "W"); "steps": { "count": 0 } for no steps
//              "compound": { "height": 1.2, "thickness": 0.75 } },                             // optional low wall along the front and both ends (open at the entry)
//     "stairTower": { "room": "Hall corner", "height": 2.3, "color": "#8c8a7e", "flip": false },   // flip: true = the room is open on its south side
//       // optional inside staircase in that room up to the flat roof: a U of two flights (the lower one climbs west along the north
//       // side from the east end, the upper one climbs east along the south side), a landing at the west end, and a stair room
//       // (mumty) on the roof over it with an open doorway and a tall lit window on the south and east sides. Use it instead of "stairs".
//     "terraceRooms": [{ "name": "Room 1", "x": 0, "z": 0, "w": 10.75, "d": 10.75, "wall": 2.9,
//                        "openings": [{ "side": "E", "from": 8, "width": 2.5, "type": "door" }] }],
//       // optional rooms on the flat roof (positions relative to "at", sides N/S/E/W as for the rooms below), each with its own roof slab
//     "kitchenOta": { "room": "Kitchen", "side": "N", "from": 0.6, "width": 8, "depth": 2, "height": 0.8 },
//       // optional cooking platform inside a room, against one of its walls (from = feet from the start of that wall, as for openings)
//       // optional: the house stands on a plinth this high (metres), with a raised platform (ota) "depth" feet deep along the
//       // front (south) side and steps down from it; "from" is feet from the house's west end. Without it the house is at ground level.
//   }
import {
  scene, realScene, useScene, obstacle, walkables, H, setH, T, S, fx, fz, rect, wallLine, door, label, warmLight, furn, paint, textured, makeTexture, plasterTex,
  scaleUV, speckle, rand, hex, rod, glow,
} from './core.js';

export const buildings = [];   // every house made by makeHouse(): used for floors and for hiding roofs when you walk inside
let tinMat;
export const tin = () => {   // corrugated tin sheet, ribs run down the slope (shared with the open shed)
  if (tinMat) return tinMat;
  tinMat = textured(makeTexture(128, 128, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#6f757a'); g.addColorStop(0.5, '#a8aeb3'); g.addColorStop(1, '#6f757a');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, h);
    }
    ctx.fillStyle = 'rgba(120,70,40,0.12)';
    for (let i = 0; i < 12; i++) ctx.fillRect(rand(0, w), 0, rand(1, 3), h);   // faint rust streaks
    speckle(ctx, w, h, 600, 2, 0.05);
    ctx.fillStyle = 'rgba(20,22,24,0.55)'; ctx.fillRect(0, 0, 3, h);        // joint between two sheets
    ctx.fillStyle = 'rgba(230,235,240,0.35)'; ctx.fillRect(3, 0, 2, h);     // lapped edge of the next sheet
  }), 1.0, 0.5);
  tinMat.metalness = 0.35;
  return tinMat;
};

export function makeHouse(cfg) {
  const [ox, oz] = cfg.at;
  const rooms = cfg.rooms.map((r) => ({ ...r, x1: ox + r.x, z1: oz + r.z, x2: ox + r.x + r.w, z2: oz + r.z + r.d }));
  const byName = Object.fromEntries(rooms.map((r) => [r.name, r]));
  const bounds = {
    x1: Math.min(...rooms.map((r) => r.x1)), z1: Math.min(...rooms.map((r) => r.z1)),
    x2: Math.max(...rooms.map((r) => r.x2)), z2: Math.max(...rooms.map((r) => r.z2)),
  };
  const wallH = cfg.wall ?? 3;

  // 1. Openings in absolute plan feet (duplicates on a shared wall are dropped)
  const ops = new Map();
  (cfg.openings || []).forEach((o) => {
    const r = byName[o.room], horiz = o.side === 'N' || o.side === 'S';
    const c = { N: r.z1, S: r.z2, W: r.x1, E: r.x2 }[o.side];
    const a = (horiz ? r.x1 : r.z1) + o.from;
    ops.set(`${horiz}|${c}|${a}|${a + o.width}`, { horiz, c, a, b: a + o.width, type: o.type || 'win', side: o.side });
  });

  // 2. Walls: every room edge, merged so that two rooms share one wall
  const lines = new Map();
  const edge = (horiz, c, a1, a2) => {
    const key = `${horiz}|${c.toFixed(3)}`;
    if (!lines.has(key)) lines.set(key, { horiz, c, list: [] });
    lines.get(key).list.push([a1, a2]);
  };
  rooms.forEach((r) => { edge(true, r.z1, r.x1, r.x2); edge(true, r.z2, r.x1, r.x2); edge(false, r.x1, r.z1, r.z2); edge(false, r.x2, r.z1, r.z2); });
  const wallMat = textured(cfg.weathered ? weatheredTex(cfg.wallColor || '#d3c7ae') : plasterTex(cfg.wallColor || '#d3c7ae'), 2, 0.95);

  // 0. Plinth and ota: built on the ground, then the rest of the house is built on top of them
  const ota = cfg.ota, P = ota ? ota.height ?? 0.9 : 0;
  const covers = ota ? buildOta(cfg, ota, bounds, P, wallH) : [];   // veranda roof sheets: hidden with the roof while you are under them
  const tower = cfg.stairTower ? towerGeometry(cfg.stairTower, byName[cfg.stairTower.room], P, wallH) : null;
  const raised = new THREE.Group();
  raised.position.y = P;
  realScene.add(raised);
  useScene(raised, P);
  const savedH = H;
  setH(wallH);   // wallLine() builds walls up to H
  lines.forEach(({ horiz, c, list }) => {
    list.sort((p, q) => p[0] - q[0]);
    const merged = [];
    list.forEach(([a1, a2]) => {
      const last = merged[merged.length - 1];
      if (last && a1 <= last[1] + 1e-6) last[1] = Math.max(last[1], a2); else merged.push([a1, a2]);
    });
    merged.forEach(([a1, a2]) => {
      const here = [...ops.values()].filter((o) => o.horiz === horiz && Math.abs(o.c - c) < 1e-6 && o.a >= a1 - 1e-6 && o.b <= a2 + 1e-6);
      wallLine(horiz, c, a1, a2, here.map((o) => [o.a, o.b, o.type]), wallMat);
    });
  });
  setH(savedH);

  // 3. Doors swing into the room they belong to
  const swingInto = { S: 1, N: -1, E: -1, W: 1 };
  ops.forEach((o) => { if (o.type === 'door') door(o.horiz, o.c, o.a, o.b, true, swingInto[o.side]); });

  // 4. Floors, room names, lamps, furniture
  rooms.forEach((r) => {
    rect(r.x1, r.z1, r.x2, r.z2, 0, 0.1, hex(cfg.floorColor ?? 0xa9a69f));
    const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
    if (!r.noLabel) label([r.name, `${r.w} x ${r.d} ft`], cx, cz, Math.min(3.4, r.w * S * 0.7));
    warmLight(fx(cx), 2.2, fz(cz), 0.9, 8);
  });
  if (cfg.kitchenOta) kitchenOta(cfg.kitchenOta, byName[cfg.kitchenOta.room], textured(plasterTex('#9d978b'), 1.2, 0.9));   // cement base, darker than the walls
  (cfg.furniture || []).forEach((f) => furn(ox + f.x, oz + f.z, ox + f.x + f.w, oz + f.z + f.d, f.h ?? 0.5, hex(f.color ?? 0x7c5a3a)));

  // 5. Roof: slopes are hidden while you are inside; gable ends and the frame stay
  const roof = new THREE.Group();
  const roofCfg = cfg.roof || { type: 'gable' };
  const cx = fx((bounds.x1 + bounds.x2) / 2), cz = fz((bounds.z1 + bounds.z2) / 2);
  const lenX = (bounds.x2 - bounds.x1) * S, lenZ = (bounds.z2 - bounds.z1) * S;
  if (roofCfg.type === 'shed') {
    // Single-slope tin sheet: the front and back walls carry on above the wall height (the high one more), the side walls
    // stop at the wall height, and the sheet rests on the two raised walls with a small overhang all round
    const [lowRise, highRise] = roofCfg.rise ?? [0.25, 0.65], over = roofCfg.overhang ?? 0.3, highSouth = (roofCfg.high ?? 'S') === 'S';
    const zHigh = highSouth ? bounds.z2 : bounds.z1, zLow = highSouth ? bounds.z1 : bounds.z2;
    [[zHigh, highRise], [zLow, lowRise]].forEach(([zc, rise]) => {   // raised strips on the high and low walls (always visible)
      const strip = new THREE.Mesh(new THREE.BoxGeometry(lenX + T, rise, T), wallMat);
      strip.position.set(cx, wallH + rise / 2, fz(zc));
      strip.castShadow = strip.receiveShadow = true;
      scene.add(strip);
    });
    const run = lenZ, drop = highRise - lowRise, ang = Math.atan2(drop, run), slopeLen = (run + 2 * over) / Math.cos(ang);
    const geo = new THREE.BoxGeometry(lenX + 2 * over, 0.05, slopeLen);
    scaleUV(geo, lenX + 2 * over, 0.05, slopeLen, 1.0);
    const sheet = new THREE.Mesh(geo, roofCfg.color ? paint(hex(roofCfg.color), 0.6) : tin());
    sheet.position.set(cx, wallH + (lowRise + highRise) / 2 + 0.025, cz);
    sheet.rotation.x = highSouth ? -ang : ang;   // the +z (south) end is the high one when "high" is S
    sheet.castShadow = sheet.receiveShadow = true;
    roof.add(sheet);
  } else if (roofCfg.type === 'flat') {
    // A slab over each room (so an outside staircase beside the house stays open to the sky), a walkable terrace on top,
    // and a parapet along the outer edges only, with a gap where the outside stairs arrive
    const slabMat = paint(0xe6e3dc), lip = 0.25, pt = 0.5, ph = roofCfg.parapet ?? 0.9;   // overhang (ft), parapet thickness (ft) and height (m)
    rooms.forEach((r, i) => {
      if (tower && r.name === tower.r.name) {   // stairwell: slab only over the east end of the north lane and of the south lane
        const zr = (a, b) => [Math.min(tower.mz(a), tower.mz(b)), Math.max(tower.mz(a), tower.mz(b))];
        const [a1, a2] = zr(r.z1 - lip, tower.zm), [b1, b2] = zr(tower.zm, r.z2 + lip);
        rect(tower.xs, a1, r.x2 + lip, a2, wallH + i * 0.002, 0.2, 0, roof, slabMat);
        rect(tower.xe, b1, r.x2 + lip, b2, wallH + i * 0.002, 0.2, 0, roof, slabMat);
        return;
      }
      rect(r.x1 - lip, r.z1 - lip, r.x2 + lip, r.z2 + lip, wallH + i * 0.002, 0.2, 0, roof, slabMat);
    });
    const st = cfg.stairs, stairTop = st && {   // the edge of the roof where the stairs come up
      horiz: (st.up ?? 'N') === 'N' || st.up === 'S',
      c: { N: oz + st.z, S: oz + st.z + st.d, W: ox + st.x, E: ox + st.x + st.w }[st.up ?? 'N'],
      a: (st.up ?? 'N') === 'N' || st.up === 'S' ? ox + st.x : oz + st.z, b: (st.up ?? 'N') === 'N' || st.up === 'S' ? ox + st.x + st.w : oz + st.z + st.d,
    };
    const minus = (segs, a, b) => segs.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, a], [b, q]].filter(([u, v]) => v - u > 0.01)));
    rooms.forEach((r) => {
      if (tower && r.name === tower.r.name) return;
      [['N', true, r.z1, r.x1, r.x2, -1], ['S', true, r.z2, r.x1, r.x2, 1], ['W', false, r.x1, r.z1, r.z2, -1], ['E', false, r.x2, r.z1, r.z2, 1]].forEach(([, horiz, c, a1, a2, out]) => {
        let segs = [[a1, a2]];
        rooms.forEach((q) => {   // parts shared with a neighbouring room are not an outer edge
          if (q === r) return;
          const qc = horiz ? (out < 0 ? q.z2 : q.z1) : (out < 0 ? q.x2 : q.x1);
          if (Math.abs(qc - c) < 1e-6) segs = minus(segs, horiz ? q.x1 : q.z1, horiz ? q.x2 : q.z2);
        });
        if (stairTop && stairTop.horiz === horiz && Math.abs(stairTop.c - c) < 1e-6) segs = minus(segs, stairTop.a, stairTop.b);
        const o1 = c + out * lip, o2 = o1 - out * pt;   // parapet between the slab edge and half a foot in
        segs.forEach(([a, b]) => {
          const [p1, p2] = [Math.min(o1, o2), Math.max(o1, o2)], aa = a - lip, bb = b + lip;
          if (horiz) rect(aa, p1, bb, p2, wallH + 0.2, ph, 0, roof, slabMat); else rect(p1, aa, p2, bb, wallH + 0.2, ph, 0, roof, slabMat);
          const [qx1, qz1, qx2, qz2] = horiz ? [aa, p1, bb, p2] : [p1, aa, p2, bb];
          obstacle(fx((qx1 + qx2) / 2), fz((qz1 + qz2) / 2), (qx2 - qx1) * S, (qz2 - qz1) * S, wallH + 0.2, wallH + 0.2 + ph);
        });
      });
    });
  } else {
    const alongX = (roofCfg.ridge || (lenX >= lenZ ? 'x' : 'z')) === 'x';
    const length = alongX ? lenX : lenZ, span = alongX ? lenZ : lenX;   // length of the ridge, distance eave to eave
    const rise = roofCfg.rise ?? 1.4, over = roofCfg.overhang ?? 0.4, half = span / 2, reach = half + over;
    const ang = Math.atan2(rise, half), slopeLen = reach / Math.cos(ang);
    const frame = new THREE.Group();   // built with the ridge along x, then turned if it should run along z
    frame.position.set(cx, 0, cz);
    frame.rotation.y = alongX ? 0 : Math.PI / 2;
    const yc = wallH + rise - (reach / 2) * Math.tan(ang);
    [-1, 1].forEach((side) => {
      const geo = new THREE.BoxGeometry(length + 2 * over, 0.05, slopeLen);
      scaleUV(geo, length + 2 * over, 0.05, slopeLen, 1.0);
      const sheet = new THREE.Mesh(geo, roofCfg.color ? paint(hex(roofCfg.color), 0.6) : tin());
      sheet.position.set(0, yc, side * reach / 2);
      sheet.rotation.x = -side * ang;   // the edge next to the ridge is the high one
      sheet.castShadow = sheet.receiveShadow = true;
      roof.add(sheet);
    });
    roof.position.copy(frame.position); roof.rotation.copy(frame.rotation);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(length + 2 * over, 0.08, 0.3), paint(0x8d9297, 0.5));
    ridge.position.set(0, wallH + rise + 0.03, 0); roof.add(ridge);
    // triangular gable end walls (always visible)
    const tri = new THREE.Shape();
    tri.moveTo(-half, 0); tri.lineTo(half, 0); tri.lineTo(0, rise); tri.closePath();
    [-1, 1].forEach((end) => {
      const geo = new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false });
      geo.translate(0, 0, -T / 2); geo.rotateY(Math.PI / 2);
      const g = new THREE.Mesh(geo, wallMat);
      g.position.set(end * length / 2, wallH, 0); g.castShadow = true;
      frame.add(g);
    });
    scene.add(frame);
  }
  scene.add(roof);
  useScene(realScene, 0);

  // While you stand inside, or on the ota under its roof, the roof sheets lift off so you can see
  const hideAreas = [...rooms];
  if (ota) hideAreas.push({ x1: bounds.x1 - 0.25, z1: bounds.z2, x2: bounds.x2 + 0.25, z2: bounds.z2 + (ota.depth ?? 5) });
  if (cfg.stairs) buildStairs(cfg, cfg.stairs, P + wallH + 0.2);   // outside staircase up to the flat roof
  const stair = tower && buildStairTower(tower, roof, wallH);      // inside staircase and the stair room on the roof
  const upper = cfg.terraceRooms && roofCfg.type === 'flat' ? buildTerraceRooms(cfg, P + wallH + 0.2, wallMat) : null;   // rooms on the roof
  const terrace = roofCfg.type === 'flat' ? P + wallH + 0.2 : null;   // top of a flat roof: you can walk on it once you are up there
  const house = { name: cfg.name, rooms, bounds, roof, covers, hideAreas, wall: P + wallH, floor: P + 0.1, terrace, stair, upper };
  buildings.push(house);
  return house;
}

// Rooms on the flat roof: walls and openings like the rooms below, standing on the terrace, each with a roof slab of its own.
// The roof slabs lift off while you stand inside one of them (main.js).
function buildTerraceRooms(cfg, terraceY, wallMat) {
  const [ox, oz] = cfg.at;
  const rooms = cfg.terraceRooms.map((r) => ({ ...r, x1: ox + r.x, z1: oz + r.z, x2: ox + r.x + r.w, z2: oz + r.z + r.d }));
  const up = new THREE.Group();
  up.position.y = terraceY;
  realScene.add(up);
  const roof = new THREE.Group();
  realScene.add(roof);
  const savedH = H;
  rooms.forEach((r) => {
    const h = r.wall ?? 2.9, ops = [];
    (r.openings || []).forEach((o) => {
      const horiz = o.side === 'N' || o.side === 'S', c = { N: r.z1, S: r.z2, W: r.x1, E: r.x2 }[o.side], a = (horiz ? r.x1 : r.z1) + o.from;
      ops.push({ horiz, c, a, b: a + o.width, type: o.type || 'win', side: o.side });
    });
    useScene(up, terraceY);
    setH(h);
    [[true, r.z1, r.x1, r.x2], [true, r.z2, r.x1, r.x2], [false, r.x1, r.z1, r.z2], [false, r.x2, r.z1, r.z2]].forEach(([horiz, c, a1, a2]) =>
      wallLine(horiz, c, a1, a2, ops.filter((o) => o.horiz === horiz && o.c === c).map((o) => [o.a, o.b, o.type]), wallMat));
    const swingInto = { S: 1, N: -1, E: -1, W: 1 };
    ops.forEach((o) => { if (o.type === 'door') door(o.horiz, o.c, o.a, o.b, true, swingInto[o.side]); });
    rect(r.x1, r.z1, r.x2, r.z2, 0, 0.1, hex(cfg.floorColor ?? 0xa9a69f));
    const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
    if (!r.noLabel) label([r.name, `${r.w} x ${r.d} ft`], cx, cz, Math.min(3.4, r.w * S * 0.7));
    warmLight(fx(cx), h - 0.8, fz(cz), 0.9, 8);
    rect(r.x1 - 0.6, r.z1 - 0.6, r.x2 + 0.6, r.z2 + 0.6, terraceY + h, 0.15, 0, roof, paint(0xe6e3dc));   // roof slab with a slim overhang
  });
  setH(savedH);
  useScene(realScene, 0);
  return { rooms, roof };
}

// Inside staircase: sizes in plan feet from the inner faces of the room. Two flights of 8 steps side by side and a landing
function towerGeometry(t, r, P, wallH) {
  if (!r) throw new Error(`house.json: stairTower room "${t.room}" not found`);
  const ext = T / 2 / S, n = 8;
  const xi1 = r.x1 + ext, xi2 = r.x2 - ext, zi1 = r.z1 + ext, zi2 = r.z2 - ext, zm = (zi1 + zi2) / 2;
  const xl = xi1 + 2.2, xe = xi2 - 1.3, tread = (xe - xl) / n, fl = P + 0.1, terrace = P + wallH + 0.2;
  const flip = !!t.flip, mz = (z) => (flip ? r.z1 + r.z2 - z : z);   // flip mirrors the whole stair north-south
  return { r, cfg: t, ext, n, xi1, xi2, zi1, zi2, zm, xl, xe, xs: xe - 4 * tread, tread, fl, terrace, rise: (terrace - fl) / (2 * n), wallH, flip, mz };
}

// Lower flight: north side, from the east end climbing west to the landing; upper flight: south side, climbing east to the
// roof. The stair room (mumty) stands on the roof over the room: open doorway on the north side, tall lit window on the south.
function buildStairTower(g, roof, wallH) {
  const { r, ext, n, xi1, xi2, zi1, zi2, zm, xl, xe, xs, tread, fl, terrace, rise, mz } = g;
  const R = (x1, z1, x2, z2, y0, h, color, parent, material) => {   // rect with the z range mirrored when the stair is flipped
    const p = mz(z1), q = mz(z2);
    return rect(x1, Math.min(p, q), x2, Math.max(p, q), y0, h, color, parent, material);
  };
  const O = (cx, cz, w, d, bottom, top) => obstacle(cx, fz(mz(cz)), w, d, bottom, top);
  const mat = textured(plasterTex('#b3ada3'), 1.2, 0.9), nose = paint(0x8f8a82, 0.8);
  const top = (k) => fl + rise * k;   // top of step number k (the landing is step n)
  for (let i = 0; i < n; i++) {   // lower flight
    const a = xe - (i + 1) * tread, b = xe - i * tread;
    R(a, zi1, b, zm, 0, top(i + 1), 0, realScene, mat);
    R(a, zi1, a + 0.12, zm, top(i + 1) - 0.03, 0.035, 0, realScene, nose);
  }
  R(xi1, zi1, xl, zi2, 0, top(n), 0, realScene, mat);   // landing
  for (let j = 0; j < n; j++) {   // upper flight
    const a = xl + j * tread, b = a + tread;
    R(a, zm, b, zi2, 0, top(n + 1 + j), 0, realScene, mat);
    R(b - 0.12, zm, b, zi2, top(n + 1 + j) - 0.03, 0.035, 0, realScene, nose);
  }
  // Steel railings: the open north edge (lower flight and landing) and between the two flights
  const V = (x, y, z) => new THREE.Vector3(fx(x), y, fz(mz(z)));
  const rail = (a, b, post) => {
    rod(a, b, 0.03);
    [0.3, 0.6].forEach((d) => rod(a.clone().setY(a.y - d), b.clone().setY(b.y - d), 0.015));
    for (let k = 0; k <= post; k++) { const p = a.clone().lerp(b, k / post); rod(p.clone().setY(p.y - 0.95), p, 0.03); }
  };
  const zN = zi1 + 0.15, zS = zm + 0.15;
  rail(V(xe - tread, top(2) + 0.95, zN), V(xl, top(n) + 0.95, zN), 4);
  rail(V(xl, top(n) + 0.95, zN), V(xi1 + 0.15, top(n) + 0.95, zN), 1);
  rail(V(xl, top(n + 1) + 0.95, zS), V(xe, top(2 * n) + 0.95, zS), 4);
  // Solid: the north rail, the partition between the flights, the edge of the roof opening over the lower flight
  O(fx((xi1 + xe - 1.5 * tread) / 2), zi1, (xe - 1.5 * tread - xi1) * S, 0.15, 0, terrace - 0.4);
  O(fx((xl + xe) / 2), zm, (xe - xl) * S, 0.12, 0, terrace + 1.0);
  O(fx((xe + xi2) / 2), zm, (xi2 - xe) * S, 0.12, 0, wallH);
  O(fx(xs), (zi1 + zm) / 2, 0.12, (zm - zi1) * S, terrace - 0.3, terrace + 1.1);

  // Stair room on the roof
  const T2 = g.cfg.height ?? 2.3, TOP = terrace + T2, cl = textured(plasterTex(g.cfg.color || '#8c8a7e'), 1.2, 0.9), white = paint(0xf1efe9, 0.7);
  const X1 = r.x1 - ext, X2 = r.x2 + ext, Z1 = r.z1 - ext, Z2 = r.z2 + ext;
  const wall = (x1, z1, x2, z2, y0, y1) => {
    if (y1 - y0 < 0.01 || x2 - x1 < 0.01 || z2 - z1 < 0.01) return;
    R(x1, z1, x2, z2, y0, y1 - y0, 0, roof, cl);
    O(fx((x1 + x2) / 2), (z1 + z2) / 2, (x2 - x1) * S, (z2 - z1) * S, terrace, y1);
  };
  const d1 = xe - 2.2, d2 = xi2 - 0.3;   // doorway over the top of the stairs, in the north wall
  wall(X1, Z1, d1, r.z1 + ext, wallH, TOP); wall(d2, Z1, X2, r.z1 + ext, wallH, TOP);
  wall(d1, Z1, d2, r.z1 + ext, terrace + 2.1, TOP);
  const w1 = xi1 + 1.5, w2 = xi2 - 1.5, sill = terrace + 0.3, head = terrace + 1.9;   // tall window in the south wall
  wall(X1, r.z2 - ext, w1, Z2, wallH, TOP); wall(w2, r.z2 - ext, X2, Z2, wallH, TOP);
  wall(w1, r.z2 - ext, w2, Z2, wallH, sill); wall(w1, r.z2 - ext, w2, Z2, head, TOP);
  glow([(w2 - w1) * S, head - sill, 0.05], [fx((w1 + w2) / 2), (sill + head) / 2, fz(mz(r.z2))], 0xffd08a, roof);
  [[w1 - 0.2, w1], [w2, w2 + 0.2]].forEach(([a, b]) => R(a, r.z2 - 0.3, b, r.z2 + 0.3, sill - 0.05, head - sill + 0.1, 0, roof, white));
  R(w1 - 0.2, r.z2 - 0.3, w2 + 0.2, r.z2 + 0.3, head, 0.08, 0, roof, white);
  R(w1 - 0.2, r.z2 - 0.3, w2 + 0.2, r.z2 + 0.3, sill - 0.08, 0.08, 0, roof, white);
  wall(X1, Z1, r.x1 + ext, Z2, wallH, TOP);
  const e1 = zi1 + 1.2, e2 = zi2 - 1.2;   // a second tall window in the east wall, the side you see from the porch
  wall(r.x2 - ext, Z1, X2, e1, wallH, TOP); wall(r.x2 - ext, e2, X2, Z2, wallH, TOP);
  wall(r.x2 - ext, e1, X2, e2, wallH, sill); wall(r.x2 - ext, e1, X2, e2, head, TOP);
  glow([0.05, head - sill, (e2 - e1) * S], [fx(r.x2), (sill + head) / 2, fz(mz((e1 + e2) / 2))], 0xffd08a, roof);
  [[e1 - 0.2, e1], [e2, e2 + 0.2]].forEach(([a, b]) => R(r.x2 - 0.3, a, r.x2 + 0.3, b, sill - 0.05, head - sill + 0.1, 0, roof, white));
  R(r.x2 - 0.3, e1 - 0.2, r.x2 + 0.3, e2 + 0.2, head, 0.08, 0, roof, white);
  R(r.x2 - 0.3, e1 - 0.2, r.x2 + 0.3, e2 + 0.2, sill - 0.08, 0.08, 0, roof, white);
  R(X1 - 0.9, Z1 - 0.9, X2 + 0.9, Z2 + 0.9, TOP, 0.15, 0, roof, white);   // thin white roof with a slim overhang

  // Height of the stair floor under (x, z); null = not on the stairs (normal floor, or the roof)
  return (xf, zf0, y) => {
    const zf = mz(zf0);
    if (!(xf > xi1 && xf < xi2 && zf > zi1 && zf < zi2)) return null;
    if (((zf < zm && xf >= xs) || (zf >= zm && xf >= xe)) && y > terrace - 0.6) return null;   // up on the roof slab
    if (xf < xl) return top(n);
    let h;
    if (zf < zm) {
      if (xf > xe) return null;
      h = top(Math.min(n - 1, Math.floor((xe - xf) / tread)) + 1);
    } else {
      if (xf > xe) return null;
      h = top(n + 1 + Math.min(n - 1, Math.floor((xf - xl) / tread)));
    }
    return y >= h - 0.5 ? h : null;
  };
}

// Outside staircase against the house, up to the flat roof: solid concrete steps on a filled base, a steel railing on the
// open side. { "x", "z", "w", "d" (relative to "at", ft), "up": "N" | "S" (which end is the top), "steps", "rail": "E" | "W" }
function buildStairs(cfg, s, topY) {
  const [ox, oz] = cfg.at, x1 = ox + s.x, z1 = oz + s.z, x2 = x1 + s.w, z2 = z1 + s.d;
  const upN = (s.up ?? 'N') === 'N', n = s.steps ?? Math.ceil(topY / 0.19), tread = s.d / n;
  const mat = textured(plasterTex('#b3ada3'), 1.2, 0.9), nose = paint(0x8f8a82, 0.8);
  const span = (i) => (upN ? [z2 - (i + 1) * tread, z2 - i * tread] : [z1 + i * tread, z1 + (i + 1) * tread]);   // step i from the bottom
  for (let i = 0; i < n; i++) {
    const [a, b] = span(i), h = topY * (i + 1) / n;
    rect(x1, a, x2, b, 0, h, 0, realScene, mat);
    rect(x1, upN ? a : b - 0.12, x2, upN ? a + 0.12 : b, h - 0.03, 0.035, 0, realScene, nose);   // worn nosing on each step
  }
  walkables.push((xf, zf) => {
    if (!(xf > x1 && xf < x2 && zf > z1 && zf < z2)) return null;
    const i = Math.min(n - 1, Math.floor((upN ? z2 - zf : zf - z1) / tread));
    return topY * (i + 1) / n;
  });
  // Railing on the open side, and a solid side so you only get on at the bottom
  const xr = (s.rail ?? 'E') === 'E' ? x2 - 0.15 : x1 + 0.15, zLow = upN ? z2 : z1, zTop = upN ? z1 : z2;
  const V = (z, y) => new THREE.Vector3(fx(xr), y, fz(z)), first = topY / n;
  const a = V(zLow - (upN ? 0.5 : -0.5), first + 0.95), b = V(zTop, topY + 0.95);
  rod(a, b, 0.03);
  [0.3, 0.6].forEach((d) => rod(a.clone().setY(a.y - d), b.clone().setY(b.y - d), 0.015));
  for (let k = 0; k <= 4; k++) { const p = a.clone().lerp(b, k / 4); rod(p.clone().setY(p.y - 0.95), p, 0.03); }
  const zs = upN ? [z1, z2 - 1.5] : [z1 + 1.5, z2];
  obstacle(fx(xr), fz((zs[0] + zs[1]) / 2), 0.15, (zs[1] - zs[0]) * S, 0, topY + 1);
}

// Cement plaster that has seen a few monsoons: damp patches and faint rain streaks over the usual speckle
const weatheredTex = (color) => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 9000, 2, 0.06);
  for (let i = 0; i < 7; i++) {   // damp patches
    const x = rand(0, w), y = rand(0, h), r = rand(18, 50);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(70,62,50,0.16)'); g.addColorStop(1, 'rgba(70,62,50,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 14; i++) {  // rain streaks
    ctx.fillStyle = `rgba(60,55,48,${rand(0.04, 0.09)})`;
    ctx.fillRect(rand(0, w), rand(0, h * 0.5), rand(1, 3), rand(40, 140));
  }
  speckle(ctx, w, h, 400, 4, 0.05);
});

// Plinth under the house and the ota along its front, with steps down to the ground, all at ground level (scene = realScene).
// Edges are solid so you have to use the steps; the tops are walkable.
function buildOta(cfg, ota, b, P, wallH) {
  const [ox] = cfg.at, depth = ota.depth ?? 5, lip = 0.25;   // the plinth stands out 0.25 ft beyond the walls
  const st = ota.steps || {}, sx1 = ox + (st.from ?? 9), sx2 = sx1 + (st.width ?? 6), tread = st.tread ?? 1, count = st.count ?? 3;
  const x1 = b.x1 - lip, x2 = b.x2 + lip, zBack = b.z1 - lip, zFront = b.z2 + depth, zSteps = zFront + count * tread;
  const face = textured(weatheredTex('#a29b8e'), 1.5, 0.95);                  // plastered sides of the plinth
  const top = textured(plasterTex('#8e8a82'), 1.2, 0.85);                     // rough cement finish on top
  rect(x1, zBack, x2, zFront, 0, P - 0.04, 0, scene, face);
  rect(x1 - 0.1, zBack - 0.1, x2 + 0.1, zFront + 0.1, P - 0.04, 0.04, 0, scene, top);   // top coat, a little nosing all round
  for (let j = 0; j < count; j++) {   // steps: each one lower and further out, equal risers up to the ota
    const h = P * (count - j) / (count + 1), z1 = zFront + j * tread;
    rect(sx1, z1, sx2, z1 + tread, 0, h - 0.03, 0, scene, face);
    rect(sx1 - 0.05, z1, sx2 + 0.05, z1 + tread + 0.08, h - 0.03, 0.03, 0, scene, top);
  }
  // Solid edges (you cannot climb up except by the steps, or through the "entry": a gap "entryWidth" feet wide (default 4)
  // in the middle of the "E" or "W" end of the ota, between the house wall and the front edge)
  const edge = (ax, az, bx, bz) => (az === bz
    ? obstacle(fx((ax + bx) / 2), fz(az), (bx - ax) * S, 0.2, 0, 1.0)
    : obstacle(fx(ax), fz((az + bz) / 2), 0.2, (bz - az) * S, 0, 1.0));
  const gw = ota.entryWidth ?? 4, g1 = (b.z2 + zFront) / 2 - gw / 2, g2 = g1 + gw;   // entry gap along the end
  const sideEdge = (x, open) => { if (open) { edge(x, zBack, x, g1); edge(x, g2, x, zFront); } else edge(x, zBack, x, zFront); };
  edge(x1, zBack, x2, zBack);
  sideEdge(x1, ota.entry === 'W');
  sideEdge(x2, ota.entry === 'E');
  if (count) {
    edge(x1, zFront, sx1, zFront); edge(sx2, zFront, x2, zFront);               // front edge, open where the steps are
    edge(sx1, zFront, sx1, zSteps); edge(sx2, zFront, sx2, zSteps);             // sides of the steps
  } else edge(x1, zFront, x2, zFront);
  // Compound: a low plastered wall standing on the ota along its front and both ends, with the entry gap left open
  if (ota.compound) {
    const cw = ota.compound, ch = cw.height ?? 1.2, t = cw.thickness ?? 0.75;
    const wall = (ax1, az1, ax2, az2) => {
      if (az2 - az1 < 0.01) return;
      rect(ax1, az1, ax2, az2, P, ch - 0.04, 0, scene, face);
      rect(ax1 - 0.05, az1 - 0.05, ax2 + 0.05, az2 + 0.05, P + ch - 0.04, 0.04, 0, scene, top);   // cement coping
      obstacle(fx((ax1 + ax2) / 2), fz((az1 + az2) / 2), (ax2 - ax1) * S, (az2 - az1) * S, P, P + ch);
    };
    const endWall = (wx1, wx2, open) => {
      if (open) { wall(wx1, b.z2, wx2, g1); wall(wx1, g2, wx2, zFront - t); } else wall(wx1, b.z2, wx2, zFront - t);
    };
    wall(x1, zFront - t, x2, zFront);                                    // along the front
    endWall(x1, x1 + t, ota.entry === 'W');                              // west end
    endWall(x2 - t, x2, ota.entry === 'E');                              // east end
  }
  // Veranda roof: one tin sheet from just under the house roof down to a timber beam on posts along the front edge
  const covers = [];
  if (ota.roof) {
    const r = ota.roof, yBack = P + (r.back ?? wallH - 0.05), yFront = P + (r.front ?? 2.15), over = 0.4;
    const wood = paint(0x5e3d22, 0.7), zWall = b.z2 + T / 2 / S;
    const run = (zFront - zWall) * S, ang = Math.atan2(yBack - yFront, run), len = (run + over) / Math.cos(ang);
    const geo = new THREE.BoxGeometry((x2 - x1) * S + 0.3, 0.04, len);
    scaleUV(geo, (x2 - x1) * S + 0.3, 0.04, len, 1.0);
    const sheet = new THREE.Mesh(geo, tin());
    sheet.position.set(fx((x1 + x2) / 2), (yBack + yFront) / 2 - (over / 2) * Math.tan(ang) + 0.02, fz(zWall) + (run + over) / 2);
    sheet.rotation.x = ang;   // high at the wall, low at the front
    sheet.castShadow = sheet.receiveShadow = true;
    scene.add(sheet);
    covers.push(sheet);
    const beam = rect(x1, zFront - 0.45, x2, zFront - 0.05, yFront - 0.14, 0.12, 0, scene, wood);   // front beam carrying the sheet
    covers.push(beam);
    (r.posts || [x1 - cfg.at[0] + 0.4, (b.x2 - b.x1) / 2, b.x2 - cfg.at[0] - 0.4]).forEach((a) => {
      const px = cfg.at[0] + a;
      rect(px - 0.2, zFront - 0.45, px + 0.2, zFront - 0.05, P, yFront - 0.14 - P, 0, scene, wood);   // timber post on the ota
      obstacle(fx(px), fz(zFront - 0.25), 0.16, 0.16, P, yFront);
    });
  }
  walkables.push((xf, zf) => {
    if (xf > x1 && xf < x2 && zf > zBack && zf < zFront) return P;
    if (xf > sx1 && xf < sx2 && zf >= zFront && zf < zSteps) return P * (count - Math.floor((zf - zFront) / tread)) / (count + 1);
    return null;
  });
  return covers;
}

// Kitchen ota: a plain cooking platform against one wall of a room (plastered base, black kadappa stone top, a two-burner
// stove at one end). Built inside the house, standing on the room floor.
function kitchenOta(k, r, baseMat) {
  if (!r) throw new Error(`house.json: kitchenOta room "${k.room}" not found`);
  const ext = T / 2 / S, depth = k.depth ?? 2, len = k.width ?? 8, h = k.height ?? 0.8, y0 = 0.1, side = k.side || 'N';
  const horiz = side === 'N' || side === 'S';
  const a1 = (horiz ? r.x1 : r.z1) + (k.from ?? 0.6), a2 = a1 + len;
  const d1 = { N: r.z1 + ext, S: r.z2 - ext - depth, W: r.x1 + ext, E: r.x2 - ext - depth }[side], d2 = d1 + depth;
  const R = (p1, p2, q1, q2, yb, hh, color, mat) => (horiz ? rect(p1, q1, p2, q2, yb, hh, color, scene, mat) : rect(q1, p1, q2, p2, yb, hh, color, scene, mat));
  const inner = side === 'N' || side === 'W' ? 1 : -1;   // which way the room is, seen from the wall
  R(a1, a2, inner > 0 ? d1 : d1 + 0.1, inner > 0 ? d2 - 0.1 : d2, y0, h - 0.05, 0, baseMat);   // base, set back a little under the top
  R(a1 - 0.1, a2 + 0.1, inner > 0 ? d1 : d1 - 0.05, inner > 0 ? d2 + 0.05 : d2, y0 + h - 0.05, 0.05, 0x34373a);   // kadappa top with nosing
  const sx = a2 - 2.6, back = inner > 0 ? d1 + 0.4 : d2 - 1.5;
  R(sx, sx + 2, back, back + 1.1, y0 + h, 0.08, 0x2b2c2e);                                   // two-burner gas stove
  [sx + 0.5, sx + 1.5].forEach((c) => R(c - 0.25, c + 0.25, back + 0.3, back + 0.8, y0 + h + 0.08, 0.01, 0x8a8f94));   // burners
  const [cx, cz, w, d] = horiz ? [(a1 + a2) / 2, (d1 + d2) / 2, len, depth] : [(d1 + d2) / 2, (a1 + a2) / 2, depth, len];
  obstacle(fx(cx), fz(cz), w * S, d * S, y0, y0 + h);
}
