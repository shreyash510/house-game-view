// Services (X-ray): wiring, light points, switchboards, sockets, water supply and drainage, all from house.json "services".
// Hidden inside the walls, the roof slab and the plinth; the "Services" switch (or key X) turns the building into a ghost
// and shows them. Plan feet for x / z, metres for y, measured from the plinth top like the rest of the house.
import { PLINTH, S, fx, fz, col, hex, paint, steel, Y } from './core.js';

const V3 = (xf, y, zf) => new THREE.Vector3(fx(xf), y, fz(zf));
const UP = new THREE.Vector3(0, 1, 0);
const ballGeos = {};

export function buildServices(svc, houseG) {
  const group = new THREE.Group();
  group.visible = false;
  houseG.add(group);
  // Things you can see in a real house (switchboards, sockets, main board, geyser...) stay visible all the time;
  // only the conduits and pipes hidden in the walls, slab and ground need X-ray
  const fixtures = new THREE.Group();
  houseG.add(fixtures);
  const layers = {};   // one group per layer, so each can be switched on its own from the legend
  Object.entries(svc.layers || {}).forEach(([key, l]) => {
    const color = hex(l.color);
    layers[key] = {
      name: l.name || key, color, group: new THREE.Group(), on: true,
      // which switch shows it: "electrical" (key X) or "plumbing" (key Z); water and drain layers default to plumbing
      kind: l.kind || (['cold', 'hot', 'drain'].includes(key) ? 'plumbing' : 'electrical'),
      mat: new THREE.MeshStandardMaterial({ color: col(color), emissive: col(color), emissiveIntensity: 0.5, roughness: 0.5 }),
    };
    group.add(layers[key].group);
  });
  const boards = [];   // switchboard meshes, each with userData.board = { room, items }, for the hover card
  const layer = (key) => {
    if (!layers[key]) throw new Error(`house.json services: unknown layer "${key}". Add it to services.layers.`);
    return layers[key];
  };

  // A run of pipe or conduit through the points [xf, y, zf], with a small ball at every bend
  // always = a pipe fixed on the outside of a wall, visible without X-ray (white PVC)
  const outsideMat = new THREE.MeshStandardMaterial({ color: col(0xe8ebee), roughness: 0.5 });
  function pipe(key, pts, r = 0.018, always = false) {
    const L = layer(key), mat = always ? outsideMat : L.mat, group = always ? fixtures : L.group;
    pts.forEach((p, i) => {
      const a = V3(p[0], Y(p[1]), p[2]);
      const ball = new THREE.Mesh(ballGeos[r] ||= new THREE.SphereGeometry(r * 1.3, 8, 6), mat);
      ball.position.copy(a);
      group.add(ball);
      if (!i) return;
      const q = pts[i - 1], b = V3(q[0], Y(q[1]), q[2]), dir = new THREE.Vector3().subVectors(a, b), len = dir.length();
      if (len < 1e-4) return;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, dir.normalize());
      group.add(m);
    });
  }
  // A fitting (board, socket, geyser...) as a box at plan point (xf, y, zf)
  const matFor = (f) => (f.material === 'steel' ? steel : f.glow ? new THREE.MeshBasicMaterial({ color: col(hex(f.color)) }) : paint(hex(f.color ?? '#f2f2ee'), 0.5));
  function fitting(key, size, [xf, y, zf], mat, always = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.copy(V3(xf, Y(y), zf));
    m.castShadow = always;
    (always ? fixtures : layer(key).group).add(m);
    return m;
  }
  // A plate flat on a wall (always visible): wall 'x' = a wall running along z (plate faces x), 'z' = a wall running along x
  const plate = (key, xf, y, zf, n, w, h, color = 0xf2f2ee) => fitting(key, n === 'x' ? [0.03, h, w] : [w, h, 0.03], [xf, y, zf], paint(color, 0.5), true);
  // Floating name tag, always drawn on top
  function tag(key, text, [xf, y, zf]) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 96;
    const g = cv.getContext('2d');
    g.font = 'bold 38px sans-serif';
    const w = Math.min(500, g.measureText(text).width + 44), x0 = (512 - w) / 2;
    g.fillStyle = 'rgba(10,14,24,0.82)'; g.fillRect(x0, 12, w, 72);
    g.fillStyle = '#' + new THREE.Color(layer(key).color).getHexString(); g.fillRect(x0, 12, 8, 72);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256 + 4, 49);
    const tex = Object.assign(new THREE.CanvasTexture(cv), { encoding: THREE.sRGBEncoding });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
    s.scale.set(2.4, 0.45, 1);
    s.renderOrder = 10;
    s.position.copy(V3(xf, Y(y), zf));
    layer(key).group.add(s);
  }

  // ---------- Electrical: conduits in the slab from the main board to a light point (junction box) in every room,
  // drops in the walls to the switchboards beside the doors and to the sockets ----------
  const E = svc.electrical;
  if (E) {
    const Hc = Y(E.lightY), Hp = Y(E.powerY), off = E.powerOffset ?? 0.3;
    // L-shaped run in the slab between two plan points, along x first (or along z first)
    const lPath = (a, b, y, zFirst = false) => zFirst
      ? [[a[0], y, a[1]], [a[0], y, b[1]], [b[0], y, b[1]]]
      : [[a[0], y, a[1]], [b[0], y, a[1]], [b[0], y, b[1]]];
    const J = E.junctions;
    const JP = Object.fromEntries(Object.entries(J).map(([k, [x, z]]) => [k, [x + off, z + (k === E.board ? 0 : off)]]));   // power runs beside the lighting
    (E.links || []).forEach(([a, b, how]) => pipe('light', lPath(J[a], J[b], Hc, how === 'zFirst')));
    (E.powerLinks || []).forEach(([a, b, how]) => pipe('power', lPath(JP[a], JP[b], Hp, how === 'zFirst')));
    // Light points: a short drop from the junction box to the fitting
    const bulbMat = new THREE.MeshBasicMaterial({ color: col(0xfff0c0) });
    Object.entries(J).forEach(([k, [x, z, yOwn]]) => {
      if (k === E.board) return;
      const y = yOwn ?? Y(E.lightPointY);
      pipe('light', [[x, Hc, z], [x, y, z]]);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), bulbMat);
      bulb.position.copy(V3(x, y - 0.04, z));
      layer('light').group.add(bulb);
      fitting('light', [0.3, 0.03, 0.3], [x, y, z], paint(0xf2f2ee, 0.5));
    });
    // Switchboards beside the doors, 1.2 m up. The plate shows exactly what its "items" list: a rocker per switch (red for a
    // geyser), a round knob for a fan regulator, a socket face with pin holes, a small red indicator lamp; the plate is as wide
    // as its pieces. Hovering a board (or tapping it) shows the same list as a card (boardInfo.js).
    // "room" and "items": [{ "name", "count", "for" }] in house.json; without items it shows three switches.
    const kindOf = (name) => (/regulator|roller/i.test(name) ? 'regulator' : /socket/i.test(name) ? 'socket' : /indicator/i.test(name) ? 'indicator' : 'switch');
    const WIDTH = { switch: 0.04, regulator: 0.075, socket: 0.075, indicator: 0.03 };   // metres across the plate per piece
    const rocker = paint(0x55595e, 0.5), redRocker = paint(0xb0302a, 0.5), knobMat = paint(0x3a3d42, 0.4), holeMat = paint(0x111111, 0.9);
    const lampMat = new THREE.MeshBasicMaterial({ color: col(0xff3b2f) });
    (E.switchboards || []).filter((s) => !s.skip).forEach(({ from, at: [x, z], wall: n, y = 1.2, room, items }) => {
      pipe('light', [...lPath(J[from], [x, z], Hc), [x, y + 0.08, z]]);
      const info = { room: room || from, items: items || [] };
      const pieces = [];
      (items && items.length ? items : [{ name: 'Switch', count: 3 }]).forEach((it) => {
        for (let i = 0; i < (it.count ?? 1); i++) pieces.push({ kind: kindOf(it.name), red: /geyser|16 ?a/i.test(it.name) });
      });
      const W = pieces.reduce((w, p) => w + WIDTH[p.kind], 0) + 0.05, PH = 0.13;
      const parts = [plate('light', x, y, z, n, W, PH)];
      // A piece "a" metres along the plate from its centre, "dy" up, "d" thick (it stands out of the plate face on both sides)
      const at = (a, dy, w, h, d, mat) => fitting('light', n === 'x' ? [d, h, w] : [w, h, d], [n === 'x' ? x : x + a / S, y + dy, n === 'x' ? z + a / S : z], mat, true);
      let a = -W / 2 + 0.025;
      pieces.forEach((p) => {
        const c = a + WIDTH[p.kind] / 2;
        if (p.kind === 'switch') parts.push(at(c, 0, 0.026, 0.06, 0.042, p.red ? redRocker : rocker));
        if (p.kind === 'regulator') {
          parts.push(at(c, 0, 0.06, 0.06, 0.042, paint(0xe6e3dc, 0.5)));                 // regulator plate
          parts.push(at(c, 0, 0.034, 0.034, 0.06, knobMat));                            // knob
          parts.push(at(c, 0.012, 0.004, 0.012, 0.064, paint(0xf2f2ee, 0.5)));           // knob marker
        }
        if (p.kind === 'socket') {
          parts.push(at(c, 0, 0.06, 0.06, 0.042, paint(0xe6e3dc, 0.5)));                 // socket face
          [[-0.012, -0.008], [0.012, -0.008], [0, 0.014]].forEach(([dx, dy]) => parts.push(at(c + dx, dy, 0.007, 0.007, 0.046, holeMat)));   // three pin holes
        }
        if (p.kind === 'indicator') parts.push(at(c, 0.02, 0.012, 0.012, 0.046, lampMat));
        a += WIDTH[p.kind];
      });
      parts.forEach((m) => { m.userData.board = info; boards.push(m); });
    });
    // Sockets, fed from the power run above
    (E.sockets || []).filter((s) => !s.skip).forEach(({ from, at: [x, y, z], wall: n, big }) => {
      pipe('power', [...lPath(JP[from], [x, z], Hp), [x, y + 0.05, z]]);
      plate('power', x, y, z, n, big ? 0.16 : 0.1, big ? 0.14 : 0.1);
    });
  }

  // ---------- Pipes, fittings, tanks, chambers, pits and tags ----------
  (svc.pipes || []).forEach((p) => pipe(p.layer, p.points, p.r ?? 0.018, !!p.always));
  // "always": true = a fitting you can see in the house (board, geyser, mixer); otherwise it shows only in X-ray
  (svc.fittings || []).forEach((f) => fitting(f.layer, f.size, f.at, matFor(f), !!f.always));
  // Cylindrical tank standing on y0: { "at": [xf, zf], "y0", "radius", "height" }
  (svc.tanks || []).forEach((t) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(t.radius, t.radius, t.height, 24), paint(hex(t.color ?? '#1f2a30'), 0.5));
    m.position.copy(V3(t.at[0], Y(t.y0) + t.height / 2, t.at[1]));
    layer(t.layer || 'cold').group.add(m);
  });
  // Inspection chamber in the ground, with a lid (ground level is -PLINTH in the house group)
  (svc.chambers || []).forEach(({ at: [xf, zf], layer: key = 'drain' }) => {
    fitting(key, [0.6, 0.5, 0.6], [xf, -PLINTH - 0.2, zf], paint(0x8a8780, 0.5));
    fitting(key, [0.66, 0.04, 0.66], [xf, -PLINTH + 0.06, zf], paint(0x5c5a55, 0.5));
  });
  // Underground box (septic tank, sump), half see-through: { "rect", "y0", "h", "color", "opacity" }
  (svc.pits || []).forEach((p) => {
    const [x1, z1, x2, z2] = p.rect;
    const m = new THREE.Mesh(new THREE.BoxGeometry((x2 - x1) * S, p.h, (z2 - z1) * S),
      new THREE.MeshStandardMaterial({ color: col(hex(p.color ?? '#8a8780')), roughness: 0.9, transparent: true, opacity: p.opacity ?? 0.6 }));
    m.position.copy(V3((x1 + x2) / 2, Y(p.y0) + p.h / 2, (z1 + z2) / 2));
    layer(p.layer || 'drain').group.add(m);
  });
  (svc.tags || []).forEach((t) => tag(t.layer, t.text, t.at));

  return { group, layers, boards };
}
