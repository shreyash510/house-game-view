// Core: renderer, camera, sky, lamps, procedural textures, shared materials and the plan builders
// (box, rect, wallLine, door, label...). Everything that builds geometry imports from here.

// ---------- Renderer (realistic: sRGB colours, soft shadows) ----------
export const realScene = new THREE.Scene();
// The scene the builders add to. It temporarily points at the raised house group while the house is built (see useScene).
export let scene = realScene;
scene.fog = new THREE.Fog(0x070b16, 90, 260);   // far fog, so a zoomed-out top view is not faded

export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
// Performance: render at most 1.25x pixels, no post-processing, cheap shadows
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;   // the shadow map is refreshed every other frame (see the loop in main.js)
document.body.appendChild(renderer.domElement);

// ---------- Plan coordinates ----------
// The house is laid out exactly like the ground floor plan, measured in FEET:
//   x runs west -> east, z runs north (back of the house) -> south (porch side).
// S converts feet to game metres.
export const S = 0.4;
export const fx = (ft) => -7 + ft * S;
export const fz = (ft) => -6 + ft * S;
export const toFtX = (x) => (x + 7) / S;
export const toFtZ = (z) => (z + 6) / S;

export let H = 3.6;             // wall height = terrace floor height (ceiling height inside). makeHouse() borrows it briefly for other houses.
export let PLINTH = 0.8;        // the house stands on a plinth this high (set from house.json)
export const T = 0.18;          // wall thickness
export const FLOOR_Y = 0.11;    // top of the interior floor
export const ROOF_REACH = 2.4;  // once the player is this high they are on terrace level
export const white = 0xf4f4f2;
export const setH = (h) => { H = h; };
// Heights in house.json are metres, or text relative to the wall height: "H", "H+1.5", "H-0.71"
export const Y = (v, fallback = 0) => {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'number') return v;
  const m = /^\s*H\s*(?:([+-])\s*([\d.]+))?\s*$/.exec(v);
  if (!m) throw new Error(`Bad height "${v}": use a number or "H", "H+1.5", "H-0.7"`);
  return H + (m[1] ? (m[1] === '-' ? -1 : 1) * +m[2] : 0);
};
export const setPlinth = (p) => { PLINTH = p; };

// Things the player cannot walk through: [centerX, centerZ, width, depth, bottomY, topY]
export const obstacles = [];
let buildOff = 0;   // height of the house plinth while the house is being built
// Anything attached to the ground (bottom = 0) stays attached; everything else rides up with the plinth
export const obstacle = (cx, cz, w, d, bottom, top) => obstacles.push([cx, cz, w, d, bottom === 0 ? 0 : bottom + buildOff, top + buildOff]);
// Build into another group from now on; off = how high that group is raised (the plinth for the house group)
export function useScene(group, off = 0) { scene = group; buildOff = off; }
// Components register here: per-frame animation (fn(t, dt)), and floors you can stand on
// (fn(xf, zf, y) -> height in metres, or null when (xf, zf) is not on them; y is the player's current height)
export const updaters = [];
export const walkables = [];

// ---------- Colours and procedural textures ----------
export const col = (hex) => new THREE.Color(hex).convertSRGBToLinear(); // hex colours are sRGB
export const rand = (a, b) => a + Math.random() * (b - a);
// Colours in house.json are "#rrggbb" strings; the builders use numbers (so shared paints stay shared)
export const hex = (v) => (typeof v === 'string' ? parseInt(v.replace('#', ''), 16) : v);

export function makeTexture(w, h, draw, repeat = true) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
export function speckle(ctx, w, h, count, size, alpha) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}
export const plasterTex = (color) => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 9000, 2, 0.05);
  speckle(ctx, w, h, 300, 4, 0.04);
});
const doorTex = makeTexture(128, 256, (ctx, w, h) => {   // teak, with vertical grooves like the render's main door
  ctx.fillStyle = '#92521f'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '30,10,0' : '220,150,80'},0.13)`;
    const x = Math.random() * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + rand(-5, 5), h); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,15,0,0.45)';
  for (let x = 14; x < w; x += 18) ctx.fillRect(x, 10, 2, h - 20);
});
export const tileTex = (base) => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#6f6f6c'; ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) { ctx.fillStyle = base; ctx.fillRect(x * 128 + 3, y * 128 + 3, 122, 122); }
  speckle(ctx, w, h, 6000, 2, 0.06);
});
export const glowTex = makeTexture(128, 256, (ctx, w, h) => {   // light spilling on a wall around a lamp
  ctx.translate(w / 2, h / 2); ctx.scale(1, 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, 'rgba(255,200,120,0.85)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -w / 2, w, w);
}, false);
// Two-tone horizontal cladding like the render: thin grooves every repeat
export const claddingTex = (color) => makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, h - 3, w, 3);       // groove
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, 0, w, 2);    // highlight above it
});

// Sky dome: dark gradient, stars and a moon
const skyTex = makeTexture(1024, 512, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#020410'); g.addColorStop(0.5, '#0b1530'); g.addColorStop(0.62, '#101a33'); g.addColorStop(1, '#05070d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand(0.3, 1)})`;
    ctx.fillRect(Math.random() * w, Math.random() * h * 0.55, rand(1, 2.2), rand(1, 2.2));
  }
  const m = ctx.createRadialGradient(780, 90, 0, 780, 90, 60);
  m.addColorStop(0, 'rgba(255,255,240,1)'); m.addColorStop(0.2, 'rgba(255,255,235,0.95)'); m.addColorStop(0.22, 'rgba(180,200,255,0.35)'); m.addColorStop(1, 'rgba(180,200,255,0)');
  ctx.fillStyle = m; ctx.beginPath(); ctx.arc(780, 90, 60, 0, 7); ctx.fill();
}, false);
export const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 32, 16),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
);
realScene.add(sky);

// Reflections: the night sky becomes the environment map, so glass, steel and polished surfaces pick up a faint sky/moon sheen
try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  realScene.environment = pmrem.fromEquirectangular(skyTex).texture;
  pmrem.dispose();
} catch (err) { console.warn('No environment map', err); }

// ---------- Lights ----------
realScene.add(new THREE.HemisphereLight(0x6f84b8, 0x1b2a1c, 0.5));
const moon = new THREE.DirectionalLight(0x9db0ff, 0.55);
moon.position.set(-20, 35, 25);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.bias = -0.0004;
Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 120 });
realScene.add(moon);

// Lamps are only records. Real point lights are expensive (every one is computed for every pixel),
// so a pool of 4 real lights is moved each frame onto the 4 lamps nearest to the player.
const lamps = [];
export function warmLight(x, y, z, intensity = 1, distance = 10) {
  const lamp = { x, y: y + (scene === realScene ? 0 : scene.position.y), z, intensity: intensity * 0.4, distance };
  lamps.push(lamp);
  return lamp;
}
const LIGHT_POOL = 4;
const lightPool = Array.from({ length: LIGHT_POOL }, () => {
  const light = new THREE.PointLight(0xffc27a, 0, 10, 1.5);
  realScene.add(light);
  return light;
});
export function updateLamps(p) {
  const near = lamps
    .map((l) => ({ l, d: (l.x - p.x) ** 2 + (l.y - p.y) ** 2 + (l.z - p.z) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, LIGHT_POOL);
  lightPool.forEach((light, i) => {
    const lamp = near[i] && near[i].l;
    light.intensity = lamp ? lamp.intensity : 0;
    if (lamp) { light.position.set(lamp.x, lamp.y, lamp.z); light.distance = lamp.distance; }
  });
}

// ---------- Materials and builders ----------
const matCache = {};
export const paint = (hex, roughness = 0.75) =>
  (matCache[hex + '/' + roughness] ||= new THREE.MeshStandardMaterial({ color: col(hex), roughness, metalness: 0 }));
export const textured = (tex, tile, roughness = 0.9, bump = 0) => {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness, metalness: 0 });
  if (bump) { m.bumpMap = tex; m.bumpScale = bump; }   // the texture doubles as a bump map (grout, planks, speckle)
  m.userData.tile = tile;   // metres covered by one texture repeat
  return m;
};

// Scale a box's UVs so textures keep a real-world size
export function scaleUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]].forEach(([fu, fv], f) => {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * fu / tile, uv.getY(i) * fv / tile);
    }
  });
}

// box([w, h, d], [x, y, z], hexColor, parent, material) -> mesh. y is the CENTER of the box.
export function box(size, pos, color, parent = scene, material) {
  const mat = material || paint(color);
  const geo = new THREE.BoxGeometry(...size);
  if (!Array.isArray(mat) && mat.map && mat.userData.tile) scaleUV(geo, ...size, mat.userData.tile);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// A glowing box (lamps, lit windows) that ignores scene lighting
export function glow(size, pos, color = 0xffd9a0, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: col(color) }));
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}

// Soft light spill on a wall around a lamp
export function wallGlow(x, y, z, parent = scene, rotY = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 3),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  parent.add(m);
}

// Wall materials are shared so they can all turn see-through when the player is inside
export const wallMats = [];
function wallMaterial(color) {
  // Plain smooth paint: no speckles
  const m = new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.85, metalness: 0, transparent: true });
  wallMats.push(m);
  return m;
}
const cream = wallMaterial('#f5f4f0');   // white walls
const taupe = wallMaterial('#efece6');
const facade = wallMaterial('#d3c9bd');   // warm beige-grey on the OUTSIDE faces of the outer walls (white is kept for slabs and frames)
// Wall materials by the name used in house.json
export const wallMaterials = { cream, taupe, facade };   // "facade" = the outside-face colour, for pieces that continue an outer wall
// Frames and trims fade with the walls so nothing floats in mid-air when you are inside
export const frameMat = new THREE.MeshStandardMaterial({ color: col(0x24282c), roughness: 0.4, metalness: 0.5, transparent: true });   // dark aluminium frames
export const sillMat = new THREE.MeshStandardMaterial({ color: col(0x9a9a98), roughness: 0.8, metalness: 0, transparent: true });       // grey stone sill
export const doorFrameMat = new THREE.MeshStandardMaterial({ color: col(0x4a2e1a), roughness: 0.5, metalness: 0, transparent: true });
export const frameWhite = new THREE.MeshStandardMaterial({ color: col(0xf4f3ef), roughness: 0.7, metalness: 0, transparent: true });   // white window surround
export const woodWinMat = new THREE.MeshStandardMaterial({ color: col(0x6b4423), roughness: 0.6, metalness: 0, transparent: true });   // painted timber window
export const grillMat = new THREE.MeshStandardMaterial({ color: col(0x2a2b2d), roughness: 0.5, metalness: 0.6, transparent: true });   // iron window grill
wallMats.push(frameMat, doorFrameMat, sillMat, frameWhite, woodWinMat, grillMat);
// Dark reflective window glass that mirrors the garden: dusk sky, hedges and lawn (shared so it can fade too)
const reflectionTex = makeTexture(512, 384, (ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.58);
  sky.addColorStop(0, '#16213d'); sky.addColorStop(0.6, '#3d5079'); sky.addColorStop(1, '#8a93ad');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(190,200,225,0.18)';                              // soft clouds
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(rand(0, w), rand(10, h * 0.3), rand(50, 120), rand(8, 18), 0, 0, 7); ctx.fill(); }
  const sun = ctx.createRadialGradient(w * 0.86, h * 0.34, 0, w * 0.86, h * 0.34, 50);
  sun.addColorStop(0, 'rgba(255,225,170,0.9)'); sun.addColorStop(1, 'rgba(255,225,170,0)');
  ctx.fillStyle = sun; ctx.fillRect(w * 0.6, 0, w * 0.4, h * 0.7);
  ctx.fillStyle = '#1f3b24'; ctx.fillRect(0, h * 0.6, w, h * 0.12);      // hedge
  const lawn = ctx.createLinearGradient(0, h * 0.7, 0, h);
  lawn.addColorStop(0, '#2b5030'); lawn.addColorStop(1, '#16301b');
  ctx.fillStyle = lawn; ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.fillStyle = '#243a28';                                             // round shrubs
  [[40, 0.74, 28], [160, 0.76, 22], [440, 0.74, 26]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, h * y, r, 0, 7); ctx.fill(); });
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, w, h);          // tinted glass
}, false);
export const glassMat = new THREE.MeshStandardMaterial({ map: reflectionTex, roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.95 });
export const steel = new THREE.MeshStandardMaterial({ color: col(0xc4c8ce), roughness: 0.28, metalness: 0.95 });
export const planWalls = [];   // every full-height wall piece, for the minimap: [horiz, c, from, to]
// Ground, floors and plinth turn to a ghost in Services (X-ray) mode, so the pipes buried under them show
export const ghostMats = [];
export const ghost = (m) => { if (!ghostMats.includes(m)) ghostMats.push(m); return m; };

// Box from plan coordinates (feet): rect(x1, z1, x2, z2, bottomY, height, color)
export function rect(x1, z1, x2, z2, y0, h, color, parent = scene, material) {
  return box([(x2 - x1) * S, h, (z2 - z1) * S], [fx((x1 + x2) / 2), y0 + h / 2, fz((z1 + z2) / 2)], color, parent, material);
}
// Furniture: a solid block the player bumps into (unless solid = false)
export function furn(x1, z1, x2, z2, h, color, y0 = FLOOR_Y, solid = true) {
  const m = rect(x1, z1, x2, z2, y0, h, color);
  if (solid) obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, 0, 1.2);
  return m;
}

// A straight wall along the plan. horiz: wall runs along x at z = c; otherwise along z at x = c.
// openings: [from, to, type] where type is 'door' | 'open' | 'arch' | 'win' | 'plain' | 'vent' | 'tall'
//   [from, to, 'open', headY]: an opening with the wall carried on above it from headY (m) up to the ceiling
// out (outer walls only): +1 / -1 = which side faces outside; that face gets the beige facade colour.
export function wallLine(horiz, c, a1, a2, openings = [], mat = cream, out = 0) {
  const ext = T / 2 / S;
  if (out) {   // box faces: +x, -x, +y, -y, +z, -z
    const faces = Array(6).fill(mat);
    faces[(horiz ? 4 : 0) + (out > 0 ? 0 : 1)] = facade;
    mat = faces;
  }
  const piece = (s, e, y0, y1, { mesh = true, solid = true } = {}) => {
    if (e - s < 0.01 || y1 - y0 < 0.01) return;
    const s2 = s === a1 ? s - ext : s, e2 = e === a2 ? e + ext : e;
    const mid = (s2 + e2) / 2, len = (e2 - s2) * S;
    const cx = horiz ? fx(mid) : fx(c), cz = horiz ? fz(c) : fz(mid);
    const w = horiz ? len : T, d = horiz ? T : len;
    if (mesh) box([w, y1 - y0, d], [cx, (y0 + y1) / 2, cz], 0, scene, mat);
    if (solid) obstacle(cx, cz, w, d, y0, y1);
    if (mesh && y0 === 0 && y1 === H) planWalls.push([horiz, c, s2, e2]);
  };
  // Frame pieces around an opening: the span runs along the wall, the height between y0 and y1
  const trim = (s, e, y0, y1, m, jamb, depth, bars = false) => {
    const len = (e - s) * S, mid = (s + e) / 2, h = y1 - y0;
    const put = (along, height, a, y) => {   // along = size along the wall, a = offset along the wall
      const cxm = horiz ? fx(mid) + a : fx(c), czm = horiz ? fz(c) : fz(mid) + a;
      box(horiz ? [along, height, depth] : [depth, height, along], [cxm, y, czm], 0, scene, m);
    };
    put(jamb, h, -len / 2 + jamb / 2, (y0 + y1) / 2);
    put(jamb, h, len / 2 - jamb / 2, (y0 + y1) / 2);
    put(len, jamb, 0, y1 - jamb / 2);
    if (bars) put(len, jamb, 0, y0 + jamb / 2);
    return { put, len };
  };
  const glass = (s, e, y0, y1, boxFrame = true) => {
    const mid = (s + e) / 2, len = (e - s) * S;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? len : 0.04, y1 - y0, horiz ? 0.04 : len),
      glassMat
    );
    m.position.set(horiz ? fx(mid) : fx(c), (y0 + y1) / 2, horiz ? fz(c) : fz(mid));
    scene.add(m);
    // Sliding window: dark aluminium frame, a centre divider between the two sashes and a grey stone sill
    if (boxFrame) trim(s - 0.35, e + 0.35, y0 - 0.16, y1 + 0.16, frameWhite, 0.16, T + 0.22, true);   // thick white box frame round the window, standing out from the wall
    const f = trim(s, e, y0, y1, frameMat, 0.07, T + 0.06, true);
    f.put(0.07, y1 - y0, 0, (y0 + y1) / 2);
    if (boxFrame) box(horiz ? [(e - s) * S + 0.18, 0.06, T + 0.2] : [T + 0.2, 0.06, (e - s) * S + 0.18], [horiz ? fx(mid) : fx(c), y0 - 0.03, horiz ? fz(c) : fz(mid)], 0, scene, sillMat);
  };
  // Wooden window: timber frame, two shutters of three small panes each (2 x 3), and iron grill bars across the opening
  const woodWindow = (s, e, y0, y1) => {
    const mid = (s + e) / 2, len = (e - s) * S, h = y1 - y0;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.03, h, horiz ? 0.03 : len), glassMat);
    pane.position.set(horiz ? fx(mid) : fx(c), (y0 + y1) / 2, horiz ? fz(c) : fz(mid));
    scene.add(pane);
    const f = trim(s, e, y0, y1, woodWinMat, 0.08, T + 0.04, true);
    f.put(0.08, h, 0, (y0 + y1) / 2);                                            // meeting stiles of the two shutters: two panes wide
    [1, 2].forEach((k) => f.put(len, 0.04, 0, y0 + (h * k) / 3));                // glazing bars: three panes high
    const bars = trim(s, e, y0, y1, grillMat, 0.001, T * 0.5);
    for (let a = -len / 2 + 0.11; a < len / 2 - 0.06; a += 0.11) bars.put(0.014, h, a, (y0 + y1) / 2);   // vertical grill bars
  };
  let cursor = a1;
  [...openings].sort((p, q) => p[0] - q[0]).forEach(([a, b, type, sillY, topY]) => {
    piece(cursor, a, 0, H);
    if (type === 'open' && sillY != null) piece(a, b, sillY, H, { solid: false });   // wall over the opening
    if (type === 'arch') {   // open doorway with a rounded (semicircular) top and no door leaf
      const len = (b - a) * S, r = len / 2, apex = Math.min(2.4, H - 0.15), spring = apex - r, mid = (a + b) / 2;
      piece(a, b, apex, H, { solid: false });
      // The two curved corners between the arch and a level line at its apex
      const sh = new THREE.Shape();
      sh.moveTo(-r, 0); sh.lineTo(-r, r); sh.lineTo(r, r); sh.lineTo(r, 0);
      sh.absarc(0, 0, r, 0, Math.PI, false);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false, curveSegments: 18 });
      geo.translate(0, 0, -T / 2);
      const m0 = Array.isArray(mat) ? mat[2] : mat, tile = m0.userData?.tile;
      if (tile) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile); }
      const arch = new THREE.Mesh(geo, m0);
      arch.position.set(horiz ? fx(mid) : fx(c), spring, horiz ? fz(c) : fz(mid));
      if (!horiz) arch.rotation.y = Math.PI / 2;
      arch.castShadow = arch.receiveShadow = true;
      scene.add(arch);
    }
    if (type === 'door') {
      piece(a, b, 2.1, H, { solid: false });
      trim(a, b, 0, 2.1, doorFrameMat, 0.08, T + 0.05);   // timber door frame
    }
    if (type === 'win' || type === 'vent' || type === 'plain' || type === 'wood') {   // plain: no white box frame; wood: timber 2 x 3 panes with a grill
      const sill = type === 'vent' ? 1.5 : 0.9, top = type === 'vent' ? 2.3 : type === 'wood' ? 2.1 : 2.2;
      piece(a, b, 0, sill, { solid: false });
      piece(a, b, top, H, { solid: false });
      piece(a, b, 0, H, { mesh: false });   // you cannot walk through a window
      planWalls.push([horiz, c, a, b]);
      if (type === 'wood') woodWindow(a, b, sill, top); else glass(a, b, sill, top, type !== 'plain');
    }
    if (type === 'tall') {   // stairwell window: one tall pane from its sill (default 0.9 m) up to its top (default: the roof, carried on above it by the mumty)
      const mid = (a + b) / 2, len = (b - a) * S, y0 = sillY ?? 0.9, y1 = Math.min(topY ?? H, H), midY = (y0 + y1) / 2;
      const pane = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.04, y1 - y0, horiz ? 0.04 : len), glassMat);
      pane.position.set(horiz ? fx(mid) : fx(c), midY, horiz ? fz(c) : fz(mid));
      scene.add(pane);
      [a, b].forEach((edge, i) => {
        const off = i ? -0.06 : 0.06;
        box(horiz ? [0.12, y1 - y0, T + 0.1] : [T + 0.1, y1 - y0, 0.12], [horiz ? fx(edge) + off : fx(c), midY, horiz ? fz(c) : fz(edge) + off], 0, scene, frameWhite);
      });
      if (y1 < H) {   // stops below the roof: a head frame, and wall above it
        box(horiz ? [len, 0.12, T + 0.1] : [T + 0.1, 0.12, len], [horiz ? fx(mid) : fx(c), y1 - 0.06, horiz ? fz(c) : fz(mid)], 0, scene, frameWhite);
        piece(a, b, y1, H, { solid: false });
      }
      piece(a, b, 0, H, { mesh: false });
      piece(a, b, 0, y0, { solid: false });
      planWalls.push([horiz, c, a, b]);
    }
    cursor = b;
  });
  piece(cursor, a2, 0, H);
}

// Swinging door that opens when the player walks up to it. Purely visual: the gap is always walkable.
export const doors = [];
const doorWood = textured(doorTex, 1, 0.55);
export function door(horiz, c, a1, a2, hingeAtStart, swing, handle = false) {
  const len = (a2 - a1) * S;
  const hinge = hingeAtStart ? a1 : a2;
  const pivot = new THREE.Group();
  pivot.position.set(horiz ? fx(hinge) : fx(c), FLOOR_Y, horiz ? fz(c) : fz(hinge));
  const leaf = box([len, 2.0, 0.06], [len / 2, 1.0, 0], 0, pivot, doorWood);
  leaf.receiveShadow = false;
  if (handle) [-1, 1].forEach((side) => box([0.03, 0.9, 0.03], [len - 0.12, 1.05, side * 0.06], 0, pivot, steel));   // long steel bar handle on both faces
  const base = horiz ? (hingeAtStart ? 0 : Math.PI) : (hingeAtStart ? -Math.PI / 2 : Math.PI / 2);
  pivot.rotation.y = base;
  scene.add(pivot);
  const mid = (a1 + a2) / 2;
  doors.push({ pivot, base, open: base + swing * Math.PI / 2, cx: horiz ? fx(mid) : fx(c), cz: horiz ? fz(c) : fz(mid) });
}

// Text painted on the floor, like the room names on the plan
export function label(lines, xft, zft, width = 3.6) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(40,36,32,0.55)';
  g.textAlign = 'center';
  g.font = 'bold 44px sans-serif';
  g.fillText(lines[0], 256, 52);
  g.font = '36px sans-serif';
  g.fillText(lines[1] || '', 256, 100);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 4),
    new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(cv), { encoding: THREE.sRGBEncoding }), transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(fx(xft), FLOOR_Y + 0.02, fz(zft));
  scene.add(m);
}

// A steel rod between two points (handrails, posts)
export function rod(a, b, r, mat = steel) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  scene.add(m);
}
