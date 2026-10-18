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
//     "furniture": [{ "x": 1, "z": 1, "w": 4, "d": 6, "h": 0.45, "color": "#7c5a3a" }]   // optional blocks, relative to "at"
//   }
import {
  scene, H, setH, T, S, fx, fz, rect, wallLine, door, label, warmLight, furn, paint, textured, makeTexture, plasterTex,
  scaleUV, speckle, rand, hex,
} from './core.js';

export const buildings = [];   // every house made by makeHouse(): used for floors and for hiding roofs when you walk inside
let tinMat;
const tin = () => {   // corrugated tin sheet, ribs run down the slope
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
  const wallMat = textured(plasterTex(cfg.wallColor || '#d3c7ae'), 2, 0.95);
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
  (cfg.furniture || []).forEach((f) => furn(ox + f.x, oz + f.z, ox + f.x + f.w, oz + f.z + f.d, f.h ?? 0.5, hex(f.color ?? 0x7c5a3a)));

  // 5. Roof: slopes are hidden while you are inside; gable ends and the frame stay
  const roof = new THREE.Group();
  const roofCfg = cfg.roof || { type: 'gable' };
  const cx = fx((bounds.x1 + bounds.x2) / 2), cz = fz((bounds.z1 + bounds.z2) / 2);
  const lenX = (bounds.x2 - bounds.x1) * S, lenZ = (bounds.z2 - bounds.z1) * S;
  if (roofCfg.type === 'flat') {
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

  const house = { name: cfg.name, rooms, bounds, roof, wall: wallH };
  buildings.push(house);
  return house;
}
