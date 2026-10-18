// Electrical devices: ceiling fans, tube lights, ceiling lights and exhaust fans, all from house.json "devices".
// Hidden until the "Devices" switch (or key E) turns them on. Fans spin while they are shown.
// Plan feet for x / z, metres for y measured from the plinth top like the rest of the house ("H-0.2" style heights work too).
//   { "type": "fan", "at": [x, z], "y": ceiling height (default "H-0.2"), "rod": downrod length, "sweep": blade tip diameter }
//   { "type": "ceilingLight", "at": [x, z], "y": ceiling height (default "H-0.2") }
//   { "type": "tubeLight", "at": [x, y, z], "face": "+x" | "-x" | "+z" | "-z", "length" }   (at = point on the wall face)
//   { "type": "exhaustFan", "at": [x, y, z], "face": ... }                                    (face = which way it looks into the room)
import { fx, fz, col, paint, updaters, Y } from './core.js';

const FACE_ROT = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };   // turns local +z to point along the face
const mats = () => ({
  body: paint(0xe8e6e0, 0.45),
  blade: paint(0xd8d2c6, 0.6),
  rod: paint(0x9a9a98, 0.4),
  dark: paint(0x2b2d30, 0.6),
  light: new THREE.MeshBasicMaterial({ color: col(0xfff6e0) }),
});
const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
};

export function buildDevices(list, houseG) {
  const group = new THREE.Group();
  group.visible = false;
  houseG.add(group);
  const M = mats();
  const spinners = [];   // [object, axis, speed]

  // Ceiling fan: canopy, downrod, motor and three blades turning about the rod
  function fan(c) {
    const [x, z] = c.at, ceil = Y(c.y, Y('H-0.2')), rod = c.rod ?? 0.3, r = (c.sweep ?? 1.2) / 2;
    const g = new THREE.Group();
    g.position.set(fx(x), ceil, fz(z));
    group.add(g);
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), M.body, g, 0, -0.025);
    mesh(new THREE.CylinderGeometry(0.012, 0.012, rod, 8), M.rod, g, 0, -rod / 2);
    mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.1, 20), M.body, g, 0, -rod - 0.05);
    const rotor = new THREE.Group();
    rotor.position.y = -rod - 0.07;
    g.add(rotor);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i / 3) * Math.PI * 2;
      rotor.add(arm);
      const blade = mesh(new THREE.BoxGeometry(r - 0.1, 0.008, 0.11), M.blade, arm, 0.1 + (r - 0.1) / 2);
      blade.rotation.x = 0.12;   // a little pitch, like a real blade
    }
    spinners.push([rotor, 'y', c.speed ?? 5]);
  }

  // Round LED panel light flush on the ceiling
  function ceilingLight(c) {
    const [x, z] = c.at, ceil = Y(c.y, Y('H-0.2')), r = c.radius ?? 0.15;
    mesh(new THREE.CylinderGeometry(r, r, 0.03, 24), M.body, group, fx(x), ceil - 0.015, fz(z));
    mesh(new THREE.CylinderGeometry(r - 0.02, r - 0.02, 0.005, 24), M.light, group, fx(x), ceil - 0.032, fz(z));
  }

  // Something fixed on a wall: a group at the wall face, its local +z looking into the room
  function onWall(c) {
    const [x, y, z] = c.at;
    if (!(c.face in FACE_ROT)) throw new Error(`house.json devices: "${c.type}" needs "face": "+x", "-x", "+z" or "-z"`);
    const g = new THREE.Group();
    g.position.set(fx(x), Y(y), fz(z));
    g.rotation.y = FACE_ROT[c.face];
    group.add(g);
    return g;
  }

  // LED tube light: a slim white batten along the wall with a glowing diffuser
  function tubeLight(c) {
    const g = onWall(c), len = c.length ?? 1.22;
    mesh(new THREE.BoxGeometry(len, 0.045, 0.04), M.body, g, 0, 0, 0.02);
    mesh(new THREE.BoxGeometry(len - 0.06, 0.03, 0.012), M.light, g, 0, -0.008, 0.044);
  }

  // Exhaust fan in the wall: square frame, dark ring and four blades turning about the wall normal
  function exhaustFan(c) {
    const g = onWall(c), s = c.size ?? 0.3;
    const frame = (w, h, px, py) => mesh(new THREE.BoxGeometry(w, h, 0.04), M.body, g, px, py, 0.02);
    const b = 0.04;   // frame bar width
    frame(s, b, 0, s / 2 - b / 2); frame(s, b, 0, -s / 2 + b / 2);
    frame(b, s - 2 * b, -s / 2 + b / 2, 0); frame(b, s - 2 * b, s / 2 - b / 2, 0);
    mesh(new THREE.BoxGeometry(s - 2 * b, s - 2 * b, 0.01), M.dark, g, 0, 0, 0.005);
    const rotor = new THREE.Group();
    rotor.position.z = 0.025;
    g.add(rotor);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), M.body, rotor).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i / 4) * Math.PI * 2;
      rotor.add(arm);
      const blade = mesh(new THREE.BoxGeometry(0.06, (s - 2 * b) / 2 - 0.03, 0.004), M.blade, arm, 0, (s - 2 * b) / 4 + 0.01);
      blade.rotation.y = 0.4;
    }
    spinners.push([rotor, 'z', c.speed ?? 9]);
  }

  const TYPES = { fan, ceilingLight, tubeLight, exhaustFan };
  (list || []).forEach((c, i) => {
    if (c.skip) return;
    const make = TYPES[c.type];
    if (!make) throw new Error(`house.json devices: unknown type "${c.type}" (entry ${i}). Known: ${Object.keys(TYPES).join(', ')}`);
    make(c);
  });

  updaters.push((t, dt) => { if (group.visible) spinners.forEach(([o, axis, speed]) => (o.rotation[axis] += speed * dt)); });
  return group;
}
