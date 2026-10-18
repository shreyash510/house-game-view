// Basic components: plain blocks, glowing pieces, invisible solids, wall lamps, ceiling spots, a name plate.
// Every component is a function (cfg, ctx) where cfg is its entry in house.json and ctx = { houseG, upper }.
// "roof": true puts a part in the upper group (roof / terrace), which hides while you are inside.
import { scene, rect, box, glow, wallGlow, obstacle, fx, fz, S, Y, hex, col, paint, plasterTex } from '../core.js';
import { matOf } from '../materials.js';

const parentOf = (c, ctx) => (c.roof ? ctx.upper : scene);
const rectsOf = (c) => c.rects || [c.rect];

// { "rect" | "rects": [x1, z1, x2, z2], "y0", "h", "color" | "material", "roof", "solid" }
export function block(c, ctx) {
  const y0 = Y(c.y0), h = Y(c.h);
  rectsOf(c).forEach(([x1, z1, x2, z2]) => {
    rect(x1, z1, x2, z2, y0, h, 0, parentOf(c, ctx), matOf(c));
    if (c.solid) obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, y0, y0 + h);
  });
}

// A box with its size in metres, centred on a plan point: { "at": [xf, y, zf], "size": [w, h, d], "color" | "material", "roof" }
export function piece(c, ctx) {
  const [x, y, z] = c.at;
  box(c.size, [fx(x), Y(y), fz(z)], 0, parentOf(c, ctx), matOf(c));
}

// A box that glows (lamps, lit panes): { "at": [xf, y, zf], "size": [w, h, d], "color", "roof" }
export function glowBox(c, ctx) {
  const [x, y, z] = c.at;
  glow(c.size, [fx(x), Y(y), fz(z)], hex(c.color ?? '#ffd9a0'), parentOf(c, ctx));
}

// Something you cannot walk through, with nothing drawn: { "rect" | "rects", "y0", "h" }
export function solid(c) {
  const y0 = Y(c.y0), h = Y(c.h);
  rectsOf(c).forEach(([x1, z1, x2, z2]) => obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, y0, y0 + h));
}

// Wall lamp with a soft spill of light on the wall: { "at": [xf, y, zf], "size": [w, h, d], "face": "+x" | "-x" | "+z" | "-z", "spill": metres out from the lamp }
const FACES = { '+z': [0, 1, 0], '-z': [0, -1, Math.PI], '+x': [1, 0, Math.PI / 2], '-x': [-1, 0, -Math.PI / 2] };
export function wallLamp(c, ctx) {
  const [x, y, z] = c.at, [nx, nz, rotY] = FACES[c.face || '+z'], spill = c.spill ?? 0.02, parent = parentOf(c, ctx);
  glow(c.size || [0.22, 0.22, 0.14], [fx(x), Y(y), fz(z)], hex(c.color ?? '#ffe8b8'), parent);
  wallGlow(fx(x) + nx * spill, Y(y), fz(z) + nz * spill, parent, rotY);
}

// Recessed round ceiling lights: { "points": [[xf, zf]...] or "grid": { "x": [from, to, step], "z": [z1, z2...] }, "y", "radius", "roof" }
const spotMats = {};
export function spots(c, ctx) {
  const mat = (spotMats[c.color || '#fff3d8'] ||= new THREE.MeshBasicMaterial({ color: col(hex(c.color || '#fff3d8')) }));
  const pts = c.points ? [...c.points] : [];
  if (c.grid) for (let x = c.grid.x[0]; x <= c.grid.x[1] + 1e-6; x += c.grid.x[2]) for (const z of c.grid.z) pts.push([x, z]);
  pts.forEach(([x, z]) => {
    const s = new THREE.Mesh(new THREE.CircleGeometry(c.radius ?? 0.07, 14), mat);
    s.rotation.x = Math.PI / 2;
    s.position.set(fx(x), Y(c.y), fz(z));
    parentOf(c, ctx).add(s);
  });
}

// Name plate with one or two lines of text, facing +z: { "at": [xf, y, zf], "size": [w, h] metres, "text": ["LINE 1", "LINE 2"], "roof" }
export function namePlate(c, ctx) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = c.color || '#f2f0ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 96px Georgia, serif';
  const [l1, l2] = c.text;
  if (l2) { g.fillText(l1, 256, 74); g.fillText(l2, 256, 184); } else g.fillText(l1, 256, 128);
  const [w, h] = c.size || [2, 1];
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(cv), { encoding: THREE.sRGBEncoding }), transparent: true })
  );
  const [x, y, z] = c.at;
  plate.position.set(fx(x), Y(y), fz(z));
  parentOf(c, ctx).add(plate);
}

// Round plastic water tank (Sintex style): ribbed body, domed top and a screw lid.
// { "at": [x, z] (ft), "y0": base height (m, "H+..." works), "radius", "height" (body, m), "color", "roof" }
export function waterTank(c, ctx) {
  const [x, z] = c.at, y0 = Y(c.y0), r = c.radius ?? 0.72, h = c.height ?? 1.45, parent = parentOf(c, ctx);
  const plastic = new THREE.MeshStandardMaterial({ color: col(hex(c.color ?? '#1f5fa8')), roughness: 0.55, metalness: 0 });
  const g = new THREE.Group();
  g.position.set(fx(x), y0, fz(z));
  parent.add(g);
  const add = (geo, y, mat = plastic) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(r, r * 0.97, h, 32), h / 2);                                        // body, a touch narrower at the foot
  for (let k = 1; k <= 4; k++) add(new THREE.CylinderGeometry(r + 0.015, r + 0.015, 0.05, 32), (h * k) / 5);   // moulded ribs
  const dome = add(new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), h);
  dome.scale.y = 0.22;                                                                                // low domed top
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24), h + r * 0.22 + 0.02);                        // lid
  obstacle(fx(x), fz(z), r * 2, r * 2, y0, y0 + h + 0.3);
}

// Round cement (RCC) water tank: plastered concrete wall, a flat slab on top with a small overhang, a square manhole
// cover and a brass outlet tap near the foot.
// { "at": [x, z] (ft), "y0": base height (m), "radius" (outside, m), "height" (wall, m), "color", "roof" }
export function cementTank(c, ctx) {
  const [x, z] = c.at, y0 = Y(c.y0), r = c.radius ?? 1.4, h = c.height ?? 2.05, parent = parentOf(c, ctx);
  const tex = plasterTex(c.color ?? '#a8a49b');
  tex.repeat.set(Math.round(2 * Math.PI * r / 1.5), h / 1.5);
  const concrete = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
  const slabMat = paint(0x9b978e, 0.95);
  const g = new THREE.Group();
  g.position.set(fx(x), y0, fz(z));
  parent.add(g);
  const add = (geo, y, mat) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(r, r, h, 40), h / 2, concrete);                                   // wall
  add(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.12, 40), h + 0.06, slabMat);              // top slab, a little overhang
  add(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.1, 40), 0.05, slabMat);                   // footing band
  const cover = add(new THREE.BoxGeometry(0.6, 0.06, 0.6), h + 0.15, paint(0x6f6c66, 0.9));       // manhole cover
  cover.position.x = r * 0.35;
  const handle = add(new THREE.BoxGeometry(0.2, 0.03, 0.03), h + 0.2, paint(0x3a3a3a, 0.6));
  handle.position.x = r * 0.35;
  const tap = add(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 10), 0.3, paint(0xb08d3c, 0.4)); // outlet tap
  tap.rotation.x = Math.PI / 2;
  tap.position.z = r + 0.09;
  obstacle(fx(x), fz(z), r * 2, r * 2, y0, y0 + h + 0.2);
}
