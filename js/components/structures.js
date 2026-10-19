// Bigger building pieces, each driven by its numbers in house.json:
//   steps (front steps down to the garden), sidePorch (raised deck with steps, canopy and railing),
//   staircase (U-shaped, with a storeroom under the upper flight), mumty (stair room on the terrace),
//   towerWindow (white U-frame round a window with a grooved tower above), shrine (pooja corner).
import {
  scene, rect, box, glow, wallGlow, obstacle, warmLight, rod, fx, fz, S, T, H, PLINTH, FLOOR_Y, white,
  updaters, walkables, hex, rand, ghost, paint, door, doors,
} from '../core.js';
import { material } from '../materials.js';

const V = (xf, y, zf) => new THREE.Vector3(fx(xf), y, fz(zf));
// Handrail with two lower rods between two points, plus posts every ~3 ft when `posts` is set (deck railings)
function railRun(a, b, posts = 0, deckY = 0) {
  rod(a, b, 0.03);
  [0.3, 0.6].forEach((drop) => rod(a.clone().setY(a.y - drop), b.clone().setY(b.y - drop), 0.015));
  for (let i = 0; posts && i <= posts; i++) {
    const t = i / posts, p = a.clone().lerp(b, t);
    rod(p.clone().setY(deckY), p, 0.03);
  }
}

// ---------- Front steps (ground level), going down toward +z ----------
// { "x1", "x2", "z0" (top edge), "tread", "count", "color", "handrails" (default true) }
export function steps(c) {
  const { x1, x2, z0, tread, count } = c, top = PLINTH + 0.1, mat = ghost(paint(hex(c.color ?? '#d8d6d0')));
  for (let j = 0; j < count; j++) {
    const z1 = z0 + j * tread;
    rect(x1, z1, x2, z1 + tread, 0, top * (count - j) / (count + 1), 0, scene, mat);
  }
  walkables.push((xf, zf) => {
    if (!(xf > x1 && xf < x2 && zf >= z0 && zf < z0 + count * tread)) return null;
    return top * (count - Math.floor((zf - z0) / tread)) / (count + 1);
  });
  // Stainless-steel handrails on both sides
  if (c.handrails !== false) [x1 - 0.5, x2 + 0.5].forEach((xf) => {
    const zTop = z0 - 0.8, zBot = z0 + count * tread - 0.2;
    const a = V(xf, 0.9 + 0.95, zTop), b = V(xf, 0.2 + 0.95, zBot);
    railRun(a, b);
    rod(V(xf, 0.9, zTop), a, 0.03);   // posts
    rod(V(xf, 0, zBot), b, 0.03);
  });
}

// ---------- Side porch (ground level): a raised deck against the WEST wall, open steps going down toward +z,
// a two-tier white canopy with spot lights and a slatted planter, and a steel railing on its open sides ----------
// { "x1", "x2", "z1", "z2" (the flat deck), "steps": [[x1, x2, z1, z2] top step first], "canopy" (default true), "canopyHeight" }
export function sidePorch(c) {
  const { x1, x2, z1, z2 } = c, st = c.steps || [], n = st.length, deckY = PLINTH + 0.1;
  const end = n ? st[n - 1][3] : z2;   // where the steps finish
  rect(x1, z1, x2, z2, 0, deckY, 0, scene, ghost(paint(hex(c.color ?? '#d8d6d0'))));
  walkables.push((xf, zf) => {
    if (xf > x1 && xf <= x2 && zf > z1 && zf < z2) return deckY;
    for (let i = 0; i < n; i++) {
      const [a1, a2, b1, b2] = st[i];
      if (xf > a1 && xf <= a2 && zf > b1 && zf < b2) return deckY * (n - i) / (n + 1);
    }
    return null;
  });
  if (c.canopy !== false) {
    // Thick white fascia in two tiers split by a thin groove, warm recessed spots underneath, a grey planter with white slats on top
    const yb = PLINTH + (c.canopyHeight ?? 2.55);   // underside of the canopy
    rect(x1 - 0.4, z1 - 0.1, x2, end + 0.3, yb, 0.34, white);
    rect(x1 - 0.42, z1 - 0.12, x2 + 0.02, end + 0.32, yb + 0.34, 0.03, 0x9a9a98);   // groove between the two tiers
    rect(x1 - 0.4, z1 - 0.1, x2, end + 0.3, yb + 0.37, 0.2, white);
    if (c.spots !== false) [x1 + 0.5, x1 + 2.0].forEach((x) => { for (let z = z1 + 1.6; z < end; z += 2.7) glow([0.14, 0.02, 0.14], [fx(x), yb - 0.012, fz(z)], 0xfff0c8); });   // "spots": false = none (e.g. a bulb device instead)
    for (let z = z1 + 3; z < end; z += 6) warmLight(fx((x1 + x2) / 2), yb - 0.3, fz(z), 0.8, 5);
    rect(x1 - 0.2, z1 + 0.1, x2 - 0.3, end + 0.1, yb + 0.57, 0.5, 0x8a8b7f);                                    // planter wall
    [0.62, 0.8, 0.98].forEach((h) => rect(x1 - 0.3, z1, x1 - 0.1, end + 0.2, yb + 0.57 + h - 0.05, 0.07, white));   // horizontal slats
    for (let z = z1; z <= end + 1e-6; z += 6) rect(x1 - 0.3, z, x1 - 0.1, z + 0.2, yb + 0.57, 1.0, white);         // slat posts
  }
  // Open steps: a thin tread and a riser for each, carried by sloping stringers; side faces are solid
  st.forEach(([a1, a2, b1, b2], i) => {
    const top = deckY * (n - i) / (n + 1), rise = deckY / (n + 1);
    box([(a2 - a1) * S, 0.05, (b2 - b1) * S], [fx((a1 + a2) / 2), top - 0.025, fz((b1 + b2) / 2)], 0xd8d6d0);
    box([(a2 - a1) * S, rise, 0.03], [fx((a1 + a2) / 2), top - rise / 2, fz(b2)], 0xd8d6d0);
    obstacle(fx(a1), fz((b1 + b2) / 2), 0.2, (b2 - b1) * S, 0, 1.0);
    obstacle(fx(a2), fz((b1 + b2) / 2), 0.2, (b2 - b1) * S, 0, 1.0);
  });
  if (n) {
    const endY = deckY / (n + 1), runM = (end - z2) * S;
    const len = Math.hypot(runM, deckY - endY), ang = Math.atan2(deckY - endY, runM);
    [x1 + 0.1, (x1 + x2) / 2, x2 - 0.1].forEach((xf) => {
      const s = box([0.1, 0.22, len], [fx(xf), (deckY + endY) / 2 - 0.1, fz((z2 + end) / 2)], 0xbdbdb8);
      s.rotation.x = ang;   // the far (south) end is the low one
    });
  }
  // Steel railing along the west and north edges of the deck, and down the open side of the steps
  if (c.railing !== false) {
    const rail = 0.95, xr = x1 - 0.1;
    const deckRail = (ax, az, bx, bz) => railRun(V(ax, deckY + rail, az), V(bx, deckY + rail, bz), Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3)), deckY);
    deckRail(xr, z1, xr, z2);
    deckRail(xr, z1, x2, z1);
    if (n) {
      const top = V(xr, deckY + rail, z2), bot = V(xr, deckY / (n + 1) + rail, end);
      railRun(top, bot);
      rod(V(xr, deckY, z2), top, 0.03);
      rod(V(xr, 0, end), bot, 0.03);
    }
  }
}

// ---------- U-shaped staircase ----------
// Enter from the open passage on the east side, climb west along the south lane to the landing, turn, and climb east to the terrace.
// { "x1", "x2", "z1", "zMid", "z2", "landing" (x where the landing ends), "steps" (per flight) }
export function staircase(c) {
  const ST = c, STEP_LEN = (ST.x2 - ST.landing) / ST.steps;
  for (let i = 0; i < ST.steps; i++) {
    // Lower flight (climbs west): thin tread + riser on its own sloping waist slab (added below), open underneath like the upper one
    const lowH = (H / 2) * (i + 1) / ST.steps, prevLow = (H / 2) * i / ST.steps;
    const la = ST.x2 - (i + 1) * STEP_LEN, lb = la + STEP_LEN;
    rect(la, ST.zMid, lb, ST.z2, lowH - 0.12, 0.12, 0xe9e9e6);
    rect(lb - 0.3, ST.zMid, lb, ST.z2, prevLow, lowH - prevLow - 0.12, 0xe9e9e6);
    // Upper flight: thin tread + riser on a sloping concrete waist slab (added below), open underneath
    const upH = H / 2 + (H / 2) * (i + 1) / ST.steps;
    const xa = ST.landing + i * STEP_LEN, xb = xa + STEP_LEN, prevH = H / 2 + (H / 2) * i / ST.steps;
    rect(xa, ST.z1, xb, ST.zMid, upH - 0.12, 0.12, 0xe9e9e6);
    rect(xa, ST.z1, xa + 0.3, ST.zMid, prevH, upH - prevH - 0.12, 0xe9e9e6);
  }
  rect(ST.x1, ST.z1, ST.landing, ST.z2, 0, H / 2, 0xe9e9e6);                                                       // landing
  {
    // Waist slab under the upper flight: its top runs through the inner corners of the steps, from the landing up to the terrace
    const run = (ST.x2 - ST.landing) * S, rise = H / 2, len = Math.hypot(run, rise), ang = Math.atan2(rise, run), t = 0.15;
    const slab = box([len, t, (ST.zMid - ST.z1) * S], [fx((ST.landing + ST.x2) / 2), H * 0.75 - t / 2 / Math.cos(ang), fz((ST.z1 + ST.zMid) / 2)], 0xe9e9e6);
    slab.rotation.z = ang;   // the east end is the high one
    // ...and under the lower flight, from the floor at the east end up to the landing
    const lower = box([len, t, (ST.z2 - ST.zMid) * S], [fx((ST.landing + ST.x2) / 2), H * 0.25 - t / 2 / Math.cos(ang), fz((ST.zMid + ST.z2) / 2)], 0xe9e9e6);
    lower.rotation.z = -ang;   // the west end is the high one
  }
  // No wall between the two flights: a steel railing along the inner edge of each flight, following its slope.
  // The obstacle stops people stepping across from one flight to the other.
  const stairRail = (zf, xa, ya, xb, yb) => {
    const a = V(xa, ya + 0.9, zf), b = V(xb, yb + 0.9, zf);
    railRun(a, b);
    for (let k = 0; k <= 4; k++) { const p = a.clone().lerp(b, k / 4); rod(p.clone().setY(p.y - 0.9), p, 0.025); }   // posts
  };
  stairRail(ST.zMid + 0.15, ST.x2, H / 2 / ST.steps, ST.landing, H / 2);   // lower flight
  stairRail(ST.zMid - 0.15, ST.landing, H / 2, ST.x2, H);                  // upper flight
  obstacle(fx((ST.landing + ST.x2) / 2), fz(ST.zMid), (ST.x2 - ST.landing) * S, 0.12, 0, H - 0.2);
  // Storeroom under the upper flight: closed on the west by the landing (its door is a wall + door in house.json)
  obstacle(fx(ST.landing), fz((ST.z1 + ST.zMid) / 2), 0.15, (ST.zMid - ST.z1) * S, 0, H / 2);

  // Height of the stair floor at plan position (xf, zf); y is measured from the plinth top
  const stairHeight = (xf, zf, y) => {
    if (xf < ST.landing) return H / 2;
    if (zf < ST.zMid) {   // underneath the upper flight is the storeroom: if you are standing on the floor there, stay on the floor
      const j = Math.min(Math.floor((xf - ST.landing) / STEP_LEN), ST.steps - 1);
      if (y < H / 2 + (H / 2) * (j + 1) / ST.steps - 1.5) return FLOOR_Y;
    }
    if (zf >= ST.zMid) {
      const i = Math.floor((ST.x2 - xf) / STEP_LEN);
      return i < 0 ? 0.1 : (H / 2) * (Math.min(i, ST.steps - 1) + 1) / ST.steps;
    }
    const j = Math.floor((xf - ST.landing) / STEP_LEN);
    return H / 2 + (H / 2) * (Math.min(j, ST.steps - 1) + 1) / ST.steps;
  };
  const onStairs = (xf, zf, y) => (xf > ST.x1 && xf < ST.x2 && zf > ST.z1 && zf < ST.z2 ? PLINTH + stairHeight(xf, zf, y - PLINTH) : null);
  onStairs.first = true;   // checked before the terrace and the house floor
  walkables.push(onStairs);
}

// ---------- Mumty: the stair room on the terrace ----------
// Cladded walls (tan lower band, grey-olive upper), a door gap in the east wall, a tall window in the west wall,
// a thin white roof slab with a tank enclosure on top. "face" carries the cladding down the west face of the house to the ground.
// { "x1", "x2", "z1", "z2", "height" (above the terrace), "wall" (thickness, ft), "door": [z1, z2] in the east wall,
//   "window": { "z1", "z2", "y0", "height" }, "face": { "x1", "x2", "lowStop" } }
export function mumty(c, ctx) {
  const upper = ctx.upper, lower = material('mumtyLower'), upperMat = material('mumtyUpper');
  const TW = { ...c, top: H + c.height };
  const W = c.window, MWIN = { z1: W.z1, z2: W.z2, y0: W.y0, y1: W.y0 + W.height };
  const wall = (x1, z1, x2, z2, y0 = H, isSolid = true, y1 = TW.top) => {
    if (y1 <= y0) return;
    const split = H + 1.4;   // tone changes 1.4 m above the terrace floor
    if (y0 < split) rect(x1, z1, x2, z2, y0, Math.min(split, y1) - y0, 0, upper, lower);
    const yu = Math.max(y0, split);
    if (y1 > yu) rect(x1, z1, x2, z2, yu, y1 - yu, 0, upper, upperMat);
    if (isSolid) obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, y0, y1);
  };
  wall(TW.x1, TW.z1, TW.x2, TW.z1 + TW.wall);                                // north wall
  wall(TW.x1, TW.z2 - TW.wall, TW.x2, TW.z2);                                // south wall
  wall(TW.x1, TW.z1, TW.x1 + TW.wall, MWIN.z1);                              // west wall, north of the window
  wall(TW.x1, MWIN.z2, TW.x1 + TW.wall, TW.z2);                              // west wall, south of the window
  wall(TW.x1, MWIN.z1, TW.x1 + TW.wall, MWIN.z2, H, true, MWIN.y0);          // under the window
  wall(TW.x1, MWIN.z1, TW.x1 + TW.wall, MWIN.z2, Math.max(H, MWIN.y1));      // over the window (the mumty wall starts at the roof)
  if (c.face) {
    // The tower face: continuous cladding from the plinth to the roof cap, with one tall lit window
    const { x1: FX1, x2: FX2 } = c.face, lowStop = c.face.lowStop ?? TW.z2;
    wall(FX1, TW.z1, FX2, MWIN.z1, 0);
    wall(FX1, MWIN.z2, FX2, lowStop, 0, true, H);    // below the roof the face can stop short (before a door or steps)
    wall(FX1, MWIN.z2, FX2, TW.z2, H);               // above the roof it runs the full width of the mumty
    wall(FX1, MWIN.z1, FX2, MWIN.z2, 0, true, MWIN.y0);
    wall(FX1, MWIN.z1, FX2, MWIN.z2, MWIN.y1);
    const wx = fx((FX1 + FX2) / 2), wz = fz((MWIN.z1 + MWIN.z2) / 2), wy = (MWIN.y0 + MWIN.y1) / 2;
    const gw = (MWIN.z2 - MWIN.z1) * S, gh = MWIN.y1 - MWIN.y0, dark = 0x1f2226;
    glow([0.05, gh, gw], [wx, wy, wz], 0xffd08a, upper);                                                       // one tall lit pane
    box([0.26, 0.05, gw + 0.1], [wx, MWIN.y1 + 0.025, wz], dark, upper); box([0.26, 0.05, gw + 0.1], [wx, MWIN.y0 - 0.025, wz], dark, upper);
    box([0.26, gh, 0.05], [wx, wy, wz - gw / 2 - 0.025], dark, upper); box([0.26, gh, 0.05], [wx, wy, wz + gw / 2 + 0.025], dark, upper);
    box([0.3, 0.1, gw + 0.3], [wx, MWIN.y1 + 0.1, wz], white, upper); box([0.3, 0.1, gw + 0.3], [wx, MWIN.y0 - 0.1, wz], white, upper);
    box([0.3, gh + 0.2, 0.1], [wx, wy, wz - gw / 2 - 0.1], white, upper); box([0.3, gh + 0.2, 0.1], [wx, wy, wz + gw / 2 + 0.1], white, upper);
  }
  wall(TW.x2 - TW.wall, c.door[1], TW.x2, TW.z2);                            // east wall, south of the door
  wall(TW.x2 - TW.wall, c.door[0], TW.x2, c.door[1], H + 2.1, false);        // wall above the door
  if (c.doorLeaf !== false) {   // wooden door like the house doors, hinged at the north jamb, opening into the stair room
    door(false, TW.x2 - TW.wall / 2, c.door[0], c.door[1], true, -1, false);
    const d = doors[doors.length - 1];
    d.pivot.position.y = H + 0.01;   // stands on the terrace floor
    upper.add(d.pivot);              // and hides with the roof while you are indoors
  }
  rect(TW.x1 - 0.9, TW.z1 - 0.9, TW.x2 + 0.9, TW.z2 + 0.9, TW.top, 0.15, white, upper);   // thin white roof slab with a slim overhang
  // On the roof slab, like the render: a grooved box 3.5 ft high (west) joined to a 2 ft block with white vertical fins (east),
  // each with a white cap. "top": { "tall", "low" (heights in m), "gap" (ft between them, default none), "split" (ft from the west end) },
  // or "top": false for a plain roof. "hollow": true makes both open-topped pits (same outside, walls and rim caps only)
  // so water tanks can stand inside on the roof slab.
  if (c.top !== false) {
    const t = c.top || {}, tall = t.tall ?? 1.07, low = t.low ?? 0.61, gap = t.gap ?? 0, base = TW.top + 0.15;
    const xa = TW.x1 + (t.westInset ?? -0.4), xb = TW.x2 - 1.2, za = TW.z1 + 0.8, zb = TW.z2 - 0.8;   // the tall box comes out to the tower face on the west (window) side
    const split = TW.x1 + (t.split ?? (TW.x2 - TW.x1) * 0.53), g2 = split + gap;
    const wt = 0.4;   // wall thickness of a hollow box (ft)
    // Hollow: one pit across both boxes, so there is no wall between them (west / east ends are left out where they meet)
    const cap = (x1, x2, y, west = true, east = true) => {
      if (!t.hollow) return rect(x1 - 0.35, za - 0.35, x2 + 0.35, zb + 0.35, y, 0.12, white, upper);
      // a rim round the open top: the cap with its middle cut out, down to the inner face of the walls
      const a1 = west ? x1 - 0.35 : x1, a2 = east ? x2 + 0.35 : x2;
      rect(a1, za - 0.35, a2, za + wt, y, 0.12, white, upper); rect(a1, zb - wt, a2, zb + 0.35, y, 0.12, white, upper);
      if (west) rect(x1 - 0.35, za + wt, x1 + wt, zb - wt, y, 0.12, white, upper);
      if (east) rect(x2 - wt, za + wt, x2 + 0.35, zb - wt, y, 0.12, white, upper);
    };
    const block = (x1, x2, h, mat, west = true, east = true) => {
      if (!t.hollow) return rect(x1, za, x2, zb, base, h, 0, upper, mat);
      rect(x1, za, x2, za + wt, base, h, 0, upper, mat); rect(x1, zb - wt, x2, zb, base, h, 0, upper, mat);
      if (west) rect(x1, za + wt, x1 + wt, zb - wt, base, h, 0, upper, mat);
      if (east) rect(x2 - wt, za + wt, x2, zb - wt, base, h, 0, upper, mat);
    };
    const joined = t.hollow && gap === 0;   // the two pits open into each other
    block(xa, split, tall, lower, true, !joined);                  // tall box, grooved tan-grey cladding
    cap(xa, split, base + tall, true, !joined);
    // Left box: horizontal lines. Two dark grooves across its front, back and west (window side) faces, a third and two thirds up
    const groove = paint(0x3b3a35, 0.8);
    [1 / 3, 2 / 3].forEach((k) => {
      const y = base + tall * k;
      rect(xa, zb, split, zb + 0.04, y, 0.025, 0, upper, groove);
      rect(xa, za - 0.04, split, za, y, 0.025, 0, upper, groove);
      rect(xa - 0.04, za, xa, zb, y, 0.025, 0, upper, groove);
    });
    // Right block: vertical lines. Plain dark grey with four wide white fins, evenly spaced and full height, on the front and back
    block(g2, xb, low, paint(0x6c6b64, 0.8), !joined, true);
    cap(g2, xb, base + low, !joined, true);
    const fins = t.fins ?? 4, fw = 0.4, step = (xb - g2) / fins;
    for (let i = 0; i < fins; i++) {
      const x = g2 + step * (i + 0.5) - fw / 2;
      [[zb, zb + 0.25], [za - 0.25, za]].forEach(([f1, f2]) => rect(x, f1, x + fw, f2, base, low, white, upper));
    }
  }
  [[TW.z1 - 0.9, TW.z1], [TW.z2, TW.z2 + 0.9]].forEach(([za, zb]) => rect(TW.x1 - 0.9, za, TW.x2 + 0.9, zb, TW.top - 0.32, 0.32, white, upper));
}

// ---------- Tower window ----------
// A wide white U-frame (two jambs from the ground and a lintel) round a window, a grey panel under the glass, and a grooved
// grey tower standing on the lintel, running up past the roof. The wall opening itself must be type "plain" in the walls list.
// { "along": "x" | "z", "at", "outside": +1 | -1, "frame": [f1, f2], "window": [w1, w2], "ledge", "lamps": [[a, d]...],
//   "grooves": { "spans": [[a1, a2]...], "ys": [...], "color" } (thin grooves across the wall beside the window) }
export function towerWindow(c, ctx) {
  const horiz = c.along === 'x', out = c.outside, [f1, f2] = c.frame, [w1, w2] = c.window, upper = ctx.upper;
  const frameWhite = material('frameWhite'), towerClad = material('towerClad');
  const ext = T / 2 / S, depth = 0.675;   // the frame and tower stand 0.675 ft out from the wall face
  const lintel = 2.2, lintelTop = 2.55, top = H + 1.0, mid = (f1 + f2) / 2, at = c.at;
  const base = scene === ctx.houseG ? -PLINTH : 0;   // the house group sits on the plinth: the jambs and grey panel reach down to the ground
  // Box from distances along the wall (a) and out from its face (d), in feet
  const R = (a1, a2, d1, d2, y0, h, color, parent = scene, mat) => {
    const p1 = at + out * (ext + d1), p2 = at + out * (ext + d2), lo = Math.min(p1, p2), hi = Math.max(p1, p2);
    return horiz ? rect(a1, lo, a2, hi, y0, h, color, parent, mat) : rect(lo, a1, hi, a2, y0, h, color, parent, mat);
  };
  // Point at a along the wall, d feet out from its face (plus m metres further out), in game coordinates
  const P = (a, d, m = 0) => { const n = fx(at + out * (ext + d)) + out * m; return horiz ? [fx(a), fz(at + out * (ext + d)) + out * m] : [n, fz(a)]; };
  const solidPart = (y0, y1) => { const [x, z] = P(mid, depth / 2); obstacle(x, z, horiz ? (f2 - f1) * S : depth * S, horiz ? depth * S : (f2 - f1) * S, y0, y1); };
  const lamp = (a, y, d, parent = scene) => {   // square wall lamp washing light up and down
    const [bx, bz] = P(a, d, 0.06), [gx, gz] = P(a, d, 0.13), [wx, wz] = P(a, d, 0.15);
    box(horiz ? [0.2, 0.2, 0.12] : [0.12, 0.2, 0.2], [bx, y, bz], 0x2a2a2a, parent);
    glow(horiz ? [0.14, 0.14, 0.04] : [0.04, 0.14, 0.14], [gx, y, gz], 0xffe8b8, parent);
    wallGlow(wx, y, wz, parent, horiz ? (out > 0 ? 0 : Math.PI) : out * Math.PI / 2);
  };
  R(f1, w1, 0, depth, base, lintelTop - base, 0, scene, frameWhite);     // jambs
  R(w2, f2, 0, depth, base, lintelTop - base, 0, scene, frameWhite);
  R(w1, w2, 0, depth, lintel, lintelTop - lintel, 0, scene, frameWhite);  // lintel
  R(w1, w2, 0, 0.35, base, 0.9 - base, 0, scene, towerClad);              // grey panel below the window, set back inside the frame
  solidPart(base, lintelTop);
  R(f1, f2, 0, depth, lintelTop, H - lintelTop, 0, scene, towerClad);     // tower
  R(f1, f2, 0, depth, H, top - H, 0, upper, towerClad);
  R(f1 - 0.15, f2 + 0.15, 0, depth + 0.15, top, 0.12, white, upper);       // thin white cap
  solidPart(H, top);
  if (c.towerLamp !== false) lamp(mid, 3.1, depth);   // "towerLamp": false leaves out the lamp on the tower
  if (c.ledge) R(f1 - 0.3, f2 + 0.3, 0, depth + 1.0, lintelTop - 0.02, 0.12, 0, scene, frameWhite);   // white ledge sticking out over the window
  (c.lamps || []).forEach(([a, d]) => lamp(a, 1.9, d));
  if (c.grooves) c.grooves.spans.forEach(([g1, g2]) => c.grooves.ys.forEach((y) => R(g1, g2, 0, 0.04, y, 0.025, hex(c.grooves.color ?? '#8f887d'))));
}

// ---------- Shrine (pooja corner): marble base, pillars, canopy with a gold dome, idols, diyas and a flickering lamp ----------
// The front faces -z (toward the room). { "rect": [x1, z1, x2, z2] }
const marble = 0xf0ece4, gold = 0xd9a441;
const goldMat = (r) => new THREE.MeshStandardMaterial({ color: new THREE.Color(gold).convertSRGBToLinear(), roughness: r, metalness: 0 });
export function shrine(c) {
  const [DX1, DZ1, DX2, DZ2] = c.rect, DXC = (DX1 + DX2) / 2, DZC = (DZ1 + DZ2) / 2;
  rect(DX1, DZ1, DX2, DZ2, FLOOR_Y, 0.9, marble);                                     // marble base
  obstacle(fx(DXC), fz(DZC), (DX2 - DX1) * S, (DZ2 - DZ1) * S, 0, 1.2);
  rect(DX1, DZ1, DX1 + 0.5, DZ1 + 0.5, FLOOR_Y + 0.9, 1.1, marble);                    // front pillars
  rect(DX2 - 0.5, DZ1, DX2, DZ1 + 0.5, FLOOR_Y + 0.9, 1.1, marble);
  rect(DX1, DZ1, DX2, DZ2, FLOOR_Y + 2.0, 0.18, 0xf5e6c0);                             // canopy
  rect(DX1, DZ1, DX2, DZ1 + 0.2, FLOOR_Y + 2.18, 0.1, gold);                           // gold trim
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), goldMat(0.35));
  dome.position.set(fx(DXC), FLOOR_Y + 2.18, fz(DZC));
  dome.castShadow = true;
  scene.add(dome);
  const kalash = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), goldMat(0.3));
  kalash.position.set(fx(DXC), FLOOR_Y + 2.67, fz(DZC));
  scene.add(kalash);
  [[DXC - 0.7, 0xc0392b], [DXC, 0x2a6fb0], [DXC + 0.7, 0xe08a1e]].forEach(([x, cl]) => {   // idols
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.38, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(cl).convertSRGBToLinear(), roughness: 0.6 }));
    body.position.set(fx(x), FLOOR_Y + 1.1, fz(DZ2 - 0.5));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), goldMat(0.4));
    head.position.set(fx(x), FLOOR_Y + 1.38, fz(DZ2 - 0.5));
    scene.add(body, head);
  });
  [DX1 + 0.5, DX2 - 0.5].forEach((x) => glow([0.1, 0.12, 0.1], [fx(x), FLOOR_Y + 0.96, fz(DZ1 + 0.6)], 0xffa63a));   // diyas
  for (let x = DX1 + 0.3; x < DX2; x += 0.45) glow([0.1, 0.08, 0.1], [fx(x), FLOOR_Y + 0.93, fz(DZ1 + 0.1)], 0xff9f1a); // marigold garland
  const diya = warmLight(fx(DXC), FLOOR_Y + 1.6, fz(DZ1 - 0.2), 0.8, 4.5);   // flickers like a real lamp
  updaters.push((t) => { diya.intensity = 0.32 * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.7) + rand(-0.04, 0.04)); });
}
