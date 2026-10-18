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
//     "kitchenOta": { "room": "Kitchen", "side": "N", "from": 0.6, "width": 8, "depth": 2, "height": 0.8 },
//       // optional cooking platform inside a room, against one of its walls (from = feet from the start of that wall, as for openings)
//       // optional: the house stands on a plinth this high (metres), with a raised platform (ota) "depth" feet deep along the
//       // front (south) side and steps down from it; "from" is feet from the house's west end. Without it the house is at ground level.
//   }
import {
  scene, realScene, useScene, obstacle, walkables, H, setH, T, S, fx, fz, rect, wallLine, door, label, warmLight, furn, paint, textured, makeTexture, plasterTex,
  scaleUV, speckle, rand, hex,
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
    label([r.name, `${r.w} x ${r.d} ft`], cx, cz, Math.min(3.4, r.w * S * 0.7));
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
    const slab = new THREE.Mesh(new THREE.BoxGeometry(lenX + 0.5, 0.2, lenZ + 0.5), paint(0xe6e3dc));
    slab.position.set(cx, wallH + 0.1, cz); slab.castShadow = slab.receiveShadow = true; roof.add(slab);
    [lenZ / 2 + 0.05, -lenZ / 2 - 0.05].forEach((z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(lenX + 0.5, 0.4, 0.4), paint(0xe6e3dc)); p.position.set(cx, wallH + 0.4, cz + z); roof.add(p);
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
  const house = { name: cfg.name, rooms, bounds, roof, covers, hideAreas, wall: P + wallH, floor: P + 0.1 };
  buildings.push(house);
  return house;
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
