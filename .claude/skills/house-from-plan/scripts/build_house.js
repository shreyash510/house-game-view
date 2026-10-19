#!/usr/bin/env node
// Turn a room list read off a floor plan into a starter house JSON for the game (walls, openings, doors, floors,
// ceilings, flat roof with parapets, plinth, labels, lights, steps). Facade details from the photo are added by hand after.
//
//   node build_house.js spec.json houses/<name>.json
//
// spec.json (plan feet, x west -> east, z back -> front/road; rects are [x1, z1, x2, z2] on WALL CENTRE LINES):
// {
//   "name": "Patil bungalow",
//   "wallHeight": 3.2,               // m, floor to slab underside + 0.2 (default 3.6)
//   "plinth": 0.6,                   // m (default 0.8)
//   "rooms": [ { "name": "Bedroom 1", "rect": [0, 0, 12.75, 12.75], "floor": "marble" | "tile" | "none" } ... ],
//   "outdoor": [ { "name": "Porch", "rect": [...] } ],   // on the plinth, no walls of its own (porch, sit-out, ota)
//   "openings": [ { "along": "x" | "z", "at": 0, "from": 4, "to": 8, "type": "win" | "door" | "wood" | "vent" | "open" | "arch" | "plain",
//                   "swing": 1 | -1, "hingeAtStart": true, "head": 2.1 } ],
//   "steps": { "x1": 10, "x2": 16, "z0": 40, "count": 3, "tread": 1.2 },   // front steps going toward +z
//   "parapet": 0.9                    // m, or 0 for none
// }
// Every opening must sit on a wall line (same "along" and "at" as a room edge). The script prints what it could not place.
const fs = require('fs');
const [specPath, outPath] = process.argv.slice(2);
if (!specPath || !outPath) { console.error('usage: node build_house.js spec.json out.json'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const rooms = spec.rooms || [];
const outdoor = spec.outdoor || [];
const r2 = (v) => Math.round(v * 1000) / 1000;
const inside = (x, z) => rooms.some(({ rect: [x1, z1, x2, z2] }) => x > x1 && x < x2 && z > z1 && z < z2);

// ---------- Walls: every room edge, merged per line, split where the inside / outside status changes ----------
const lines = {};   // "x@12.5" -> [[a, b]...]  (along x at z = 12.5)
rooms.forEach(({ rect: [x1, z1, x2, z2] }) => {
  [['x', z1, x1, x2], ['x', z2, x1, x2], ['z', x1, z1, z2], ['z', x2, z1, z2]].forEach(([along, at, a, b]) => {
    (lines[`${along}@${at}`] ||= []).push([a, b]);
  });
});
const walls = [];
Object.entries(lines).forEach(([key, segs]) => {
  const [along, atS] = key.split('@'), at = +atS;
  const cuts = [...new Set(segs.flat())].sort((p, q) => p - q);
  const pieces = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1], m = (a + b) / 2;
    if (!segs.some(([p, q]) => m > p && m < q)) continue;
    const e = 0.05;
    const minus = along === 'x' ? inside(m, at - e) : inside(at - e, m);
    const plus = along === 'x' ? inside(m, at + e) : inside(at + e, m);
    const outside = minus && plus ? 0 : minus ? 1 : -1;
    const last = pieces[pieces.length - 1];
    if (last && Math.abs(last.to - a) < 1e-6 && last.outside === outside) last.to = b;
    else pieces.push({ along, at, from: a, to: b, outside });
  }
  walls.push(...pieces);
});

// ---------- Openings onto their walls, doors for every "door" ----------
const doors = [];
const unplaced = [];
(spec.openings || []).forEach((o) => {
  const w = walls.find((w) => w.along === o.along && Math.abs(w.at - o.at) < 1e-6 && o.from >= w.from - 1e-6 && o.to <= w.to + 1e-6);
  if (!w) { unplaced.push(o); return; }
  const op = [o.from, o.to, o.type];
  if (o.type === 'open' && o.head) op.push(o.head);
  (w.openings ||= []).push(op);
  if (o.type === 'door') doors.push({ along: o.along, at: o.at, from: o.from, to: o.to, hingeAtStart: o.hingeAtStart ?? true, swing: o.swing ?? 1, ...(o.handle || w.outside ? { handle: true } : {}) });
});

// ---------- Roof: flat slab over every room, 0.6 ft overhang on outside edges, parapets on top of the outer walls ----------
const exterior = walls.filter((w) => w.outside);
const grow = ({ rect: [x1, z1, x2, z2] }) => {
  const out = (along, at, a, b) => exterior.some((w) => w.along === along && Math.abs(w.at - at) < 1e-6 && a < w.to && b > w.from);
  return [x1 - (out('z', x1, z1, z2) ? 0.6 : 0), z1 - (out('x', z1, x1, x2) ? 0.6 : 0), x2 + (out('z', x2, z1, z2) ? 0.6 : 0), z2 + (out('x', z2, x1, x2) ? 0.6 : 0)].map(r2);
};
const parapet = spec.parapet ?? 0.9;
const parapets = parapet ? exterior.map(({ along, at, from, to, outside }) => (along === 'x'
  ? [from - 0.6, outside < 0 ? at - 0.6 : at + 0.1, to + 0.6, outside < 0 ? at - 0.1 : at + 0.6]
  : [outside < 0 ? at - 0.6 : at + 0.1, from - 0.6, outside < 0 ? at - 0.1 : at + 0.6, to + 0.6]).map(r2)) : [];

// ---------- Everything else ----------
const all = [...rooms, ...outdoor];
const xs = all.flatMap((r) => [r.rect[0], r.rect[2]]), zs = all.flatMap((r) => [r.rect[1], r.rect[3]]);
const size = ([x1, z1, x2, z2]) => `${r2(x2 - x1 - 0.75)}' x ${r2(z2 - z1 - 0.75)}'`;   // clear size inside 9" walls
const centre = ([x1, z1, x2, z2]) => [r2((x1 + x2) / 2), r2((z1 + z2) / 2)];
const steps = spec.steps;
const house = {
  name: spec.name || 'House',
  units: 'Plan positions are in FEET: x runs west -> east, z runs north (back) -> south (front). Heights (y, h) are in METRES above the plinth top.',
  wallHeight: spec.wallHeight ?? 3.6,
  plinth: { height: spec.plinth ?? 0.8, color: '#8f897c', areas: all.map((r) => r.rect.map(r2)), solidEdges: [] },
  footprint: rooms.map((r) => r.rect),
  decks: outdoor.map((r) => r.rect),
  floors: {
    slabs: [{ rect: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)].map(r2), color: '#cfc8b8' }],
    marble: rooms.filter((r) => (r.floor ?? 'marble') !== 'none').map((r) => r.rect),
  },
  walls: walls.map(({ along, at, from, to, outside, openings }) => ({ along, at, from: r2(from), to: r2(to), ...(outside ? { outside } : {}), ...(openings ? { openings } : {}) })),
  doors,
  roof: { slabs: rooms.map(grow), canopies: [], parapets, ...(parapet ? { parapetHeight: parapet } : {}) },
  rooms: rooms.map((r) => ({ name: r.name, rect: r.rect })),
  zones: all.map((r) => [r.name, ...r.rect]),
  labels: rooms.map((r) => ({ text: [r.name.toUpperCase(), size(r.rect)], at: centre(r.rect), width: Math.min(3.6, (r.rect[2] - r.rect[0]) * 0.3) })),
  lights: rooms.map((r) => ({ name: r.name, at: centre(r.rect), y: 2.4, intensity: 1.0, distance: 9 })),
  spawn: { at: [r2((Math.min(...xs) + Math.max(...xs)) / 2), r2(Math.max(...zs) + (steps ? steps.count * (steps.tread ?? 1.2) : 0) + 6)] },
  fixtures: [],
  furniture: [],
  components: steps ? [{ type: 'steps', name: 'front steps', x1: steps.x1, x2: steps.x2, z0: steps.z0, tread: steps.tread ?? 1.2, count: steps.count ?? 3 }] : [],
  devices: [],
};
fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(house, null, 2).replace(/\n/g, '\r\n'));
console.log(`wrote ${outPath}: ${rooms.length} rooms, ${walls.length} wall runs (${exterior.length} outer), ${doors.length} doors`);
if (unplaced.length) console.log('NOT PLACED (no wall on that line covering it):\n' + unplaced.map((o) => '  ' + JSON.stringify(o)).join('\n'));
