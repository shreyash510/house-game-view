// ---------- Renderer (realistic: sRGB colours, soft shadows, bloom) ----------
let scene = new THREE.Scene();   // temporarily points at the raised house group while the house is built
const realScene = scene;
scene.fog = new THREE.Fog(0x070b16, 90, 260);   // far fog, so a zoomed-out top view is not faded

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
// Performance: render at most 1.25x pixels, no post-processing, cheap shadows
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;   // the shadow map is refreshed every other frame (see loop)
document.body.appendChild(renderer.domElement);
const composer = null;

// ---------- Colours and procedural textures ----------
const col = (hex) => new THREE.Color(hex).convertSRGBToLinear(); // hex colours are sRGB
const rand = (a, b) => a + Math.random() * (b - a);

function makeTexture(w, h, draw, repeat = true) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
function speckle(ctx, w, h, count, size, alpha) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}
const plasterTex = (color) => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 9000, 2, 0.05);
  speckle(ctx, w, h, 300, 4, 0.04);
});
const woodFloorTex = makeTexture(256, 256, (ctx, w, h) => {
  for (let i = 0; i < 6; i++) {
    const l = 80 + Math.random() * 25;
    ctx.fillStyle = `rgb(${l + 40},${l},${l - 40})`;
    ctx.fillRect(i * (w / 6), 0, w / 6 - 2, h);
    for (let g = 0; g < 14; g++) {
      ctx.strokeStyle = 'rgba(40,20,5,0.15)';
      const x = i * (w / 6) + Math.random() * (w / 6);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + rand(-4, 4), h); ctx.stroke();
    }
  }
});
const doorTex = makeTexture(128, 256, (ctx, w, h) => {
  ctx.fillStyle = '#7a3b1f'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '30,10,0' : '200,120,60'},0.12)`;
    const x = Math.random() * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + rand(-5, 5), h); ctx.stroke();
  }
});
const grassTex = makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#1d3b20'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 14000; i++) {
    ctx.strokeStyle = `rgb(${rand(20, 50)},${rand(60, 110)},${rand(20, 45)})`;
    const x = Math.random() * w, y = Math.random() * h;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand(-2, 2), y - rand(2, 6)); ctx.stroke();
  }
});
const asphaltTex = makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#26262b'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 14000, 2, 0.12);
});
const tileTex = (base) => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#6f6f6c'; ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) { ctx.fillStyle = base; ctx.fillRect(x * 128 + 3, y * 128 + 3, 122, 122); }
  speckle(ctx, w, h, 6000, 2, 0.06);
});
const leafTex = makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#1f4a22'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgb(${rand(25, 60)},${rand(70, 125)},${rand(25, 55)})`;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, rand(1.5, 4), 0, 7); ctx.fill();
  }
});
const brickTex = makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#6b5a4a'; ctx.fillRect(0, 0, w, h);   // mortar
  const rows = 8, bh = h / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 32 : 0;
    for (let x = -64; x < w + 64; x += 64) {
      const l = rand(0.85, 1.1);
      ctx.fillStyle = `rgb(${Math.min(255, 176 * l)},${Math.min(255, 128 * l)},${Math.min(255, 92 * l)})`;
      ctx.fillRect(x + off + 2, r * bh + 2, 60, bh - 4);
    }
  }
  speckle(ctx, w, h, 5000, 2, 0.08);
});
const glowTex = makeTexture(128, 256, (ctx, w, h) => {   // light spilling on a wall around a lamp
  ctx.translate(w / 2, h / 2); ctx.scale(1, 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, 'rgba(255,200,120,0.85)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -w / 2, w, w);
}, false);

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
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 32, 16),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
);
scene.add(sky);

// Reflections: the night sky becomes the environment map, so glass, steel and polished surfaces pick up a faint sky/moon sheen
try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  realScene.environment = pmrem.fromEquirectangular(skyTex).texture;
  pmrem.dispose();
} catch (err) { console.warn('No environment map', err); }

// ---------- Lights ----------
scene.add(new THREE.HemisphereLight(0x6f84b8, 0x1b2a1c, 0.5));
const moon = new THREE.DirectionalLight(0x9db0ff, 0.55);
moon.position.set(-20, 35, 25);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.bias = -0.0004;
Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 120 });
scene.add(moon);

// Lamps are only records. Real point lights are expensive (every one is computed for every pixel),
// so a pool of 4 real lights is moved each frame onto the 4 lamps nearest to the player.
const lamps = [];
function warmLight(x, y, z, intensity = 1, distance = 10) {
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
function updateLamps(p) {
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
const paint = (hex, roughness = 0.75) =>
  (matCache[hex + '/' + roughness] ||= new THREE.MeshStandardMaterial({ color: col(hex), roughness, metalness: 0 }));
const textured = (tex, tile, roughness = 0.9, bump = 0) => {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness, metalness: 0 });
  if (bump) { m.bumpMap = tex; m.bumpScale = bump; }   // the texture doubles as a bump map (grout, planks, speckle)
  m.userData.tile = tile;   // metres covered by one texture repeat
  return m;
};

// Scale a box's UVs so textures keep a real-world size
function scaleUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]].forEach(([fu, fv], f) => {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * fu / tile, uv.getY(i) * fv / tile);
    }
  });
}

// box([w, h, d], [x, y, z], hexColor, parent, material) -> mesh. y is the CENTER of the box.
function box(size, pos, color, parent = scene, material) {
  const mat = material || paint(color);
  const geo = new THREE.BoxGeometry(...size);
  if (mat.map && mat.userData.tile) scaleUV(geo, ...size, mat.userData.tile);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// A glowing box (lamps, lit windows) that ignores scene lighting
function glow(size, pos, color = 0xffd9a0, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: col(color) }));
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}

// Soft light spill on a wall around a lamp
function wallGlow(x, y, z) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 3),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  m.position.set(x, y, z);
  scene.add(m);
}

// Things the player cannot walk through: [centerX, centerZ, width, depth, bottomY, topY]
const obstacles = [];
let buildOff = 0;   // height of the house plinth while the house is being built
// Anything attached to the ground (bottom = 0) stays attached; everything else rides up with the plinth
const obstacle = (cx, cz, w, d, bottom, top) => obstacles.push([cx, cz, w, d, bottom === 0 ? 0 : bottom + buildOff, top + buildOff]);

// Wall materials are shared so they can all turn see-through when the player is inside
const wallMats = [];
function wallMaterial(color) {
  // Plain smooth paint: no speckles
  const m = new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.85, metalness: 0, transparent: true });
  wallMats.push(m);
  return m;
}
const cream = wallMaterial('#f5f4f0');   // white walls
const taupe = wallMaterial('#efece6');
// Frames and trims fade with the walls so nothing floats in mid-air when you are inside
const frameMat = new THREE.MeshStandardMaterial({ color: col(0x24282c), roughness: 0.4, metalness: 0.5, transparent: true });   // dark aluminium frames
const sillMat = new THREE.MeshStandardMaterial({ color: col(0x9a9a98), roughness: 0.8, metalness: 0, transparent: true });       // grey stone sill
const doorFrameMat = new THREE.MeshStandardMaterial({ color: col(0x4a2e1a), roughness: 0.5, metalness: 0, transparent: true });
const frameWhite = new THREE.MeshStandardMaterial({ color: col(0xf4f3ef), roughness: 0.7, metalness: 0, transparent: true });   // white window surround
wallMats.push(frameMat, doorFrameMat, sillMat, frameWhite);
// Dark reflective window glass that mirrors the garden: dusk sky, trees, hedges and lawn (shared so it can fade too)
const reflectionTex = makeTexture(512, 384, (ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.58);
  sky.addColorStop(0, '#16213d'); sky.addColorStop(0.6, '#3d5079'); sky.addColorStop(1, '#8a93ad');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(190,200,225,0.18)';                              // soft clouds
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(rand(0, w), rand(10, h * 0.3), rand(50, 120), rand(8, 18), 0, 0, 7); ctx.fill(); }
  const sun = ctx.createRadialGradient(w * 0.86, h * 0.34, 0, w * 0.86, h * 0.34, 50);
  sun.addColorStop(0, 'rgba(255,225,170,0.9)'); sun.addColorStop(1, 'rgba(255,225,170,0)');
  ctx.fillStyle = sun; ctx.fillRect(w * 0.6, 0, w * 0.4, h * 0.7);
  ctx.fillStyle = '#18301d';                                             // distant tree line and tall trees
  for (let x = 0; x < w; x += 22) { ctx.beginPath(); ctx.arc(x + rand(-6, 6), h * 0.55, rand(24, 40), 0, 7); ctx.fill(); }
  [[70, 0.5, 70], [330, 0.52, 60], [400, 0.5, 55]].forEach(([x, y, r]) => {
    ctx.fillStyle = '#12261a';
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(x + rand(-r * 0.7, r * 0.7), h * y - rand(0, r * 1.2), rand(r * 0.35, r * 0.6), 0, 7); ctx.fill(); }
    ctx.fillRect(x - 4, h * y, 8, h * 0.12);
  });
  ctx.fillStyle = '#1f3b24'; ctx.fillRect(0, h * 0.6, w, h * 0.12);      // hedge
  const lawn = ctx.createLinearGradient(0, h * 0.7, 0, h);
  lawn.addColorStop(0, '#2b5030'); lawn.addColorStop(1, '#16301b');
  ctx.fillStyle = lawn; ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.fillStyle = '#243a28';                                             // round shrubs
  [[40, 0.74, 28], [160, 0.76, 22], [440, 0.74, 26]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, h * y, r, 0, 7); ctx.fill(); });
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, w, h);          // tinted glass
}, false);
const glassMat = new THREE.MeshStandardMaterial({ map: reflectionTex, roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.95 });
const steel = new THREE.MeshStandardMaterial({ color: col(0xc4c8ce), roughness: 0.28, metalness: 0.95 });
const planWalls = [];   // every full-height wall piece, for the minimap: [horiz, c, from, to]

// ---------- Floor plan ----------
// The house is laid out exactly like the ground floor plan, measured in FEET:
//   x runs west -> east (0..35), z runs north (back of the house) -> south (porch side, 0..37).
// S converts feet to game metres.
const S = 0.4;
const fx = (ft) => -7 + ft * S;
const fz = (ft) => -6 + ft * S;
const toFtX = (x) => (x + 7) / S;
const toFtZ = (z) => (z + 6) / S;

let H = 3.6;             // wall height = terrace floor height (ceiling height inside). makeHouse() borrows it briefly for other houses.
const T = 0.18;          // wall thickness
const FLOOR_Y = 0.11;    // top of the interior floor
const ROOF_REACH = 2.4;  // once the player is this high they are on terrace level
const white = 0xf4f4f2;

// ---------- Plinth: the house stands about 3 feet above the ground, with steps up to the porch ----------
const PLINTH = 0.8;
const plinth = (x1, z1, x2, z2) => rect(x1, z1, x2, z2, 0, PLINTH, 0x8f897c);
plinth(-0.4, -0.4, 35.4, 28.6);
plinth(-0.4, 28.6, 17.9, 33.4);
plinth(17.2, 28.6, 35, 37);       // porch
const PORCH_STEPS = { x1: 21.5, x2: 31.5, z0: 37, tread: 1.2, count: 3 };
for (let j = 0; j < PORCH_STEPS.count; j++) {
  const z1 = PORCH_STEPS.z0 + j * PORCH_STEPS.tread;
  rect(PORCH_STEPS.x1, z1, PORCH_STEPS.x2, z1 + PORCH_STEPS.tread, 0, (PLINTH + 0.1) * (PORCH_STEPS.count - j) / (PORCH_STEPS.count + 1), 0xd8d6d0);
}
// Kitchen steps (left side, outside the kitchen door): three steps that get wider as they go down, like the left-side elevation
const KITCHEN_STEPS = [   // [x from, x to, z from, z to], top step first; heights follow the porch steps
  [-1.5, 0, 19.9, 23.6], [-2.7, -1.5, 19.6, 23.9], [-3.9, -2.7, 19.3, 24.2],
];
KITCHEN_STEPS.forEach(([x1, x2, z1, z2], i) => {
  rect(x1, z1, x2, z2, 0, (PLINTH + 0.1) * (3 - i) / 4, 0xd8d6d0);
  obstacle(fx((x1 + x2) / 2), fz(z1), (x2 - x1) * S, 0.2, 0, 1.0);    // side faces are solid: you can only step on from the west
  obstacle(fx((x1 + x2) / 2), fz(z2), (x2 - x1) * S, 0.2, 0, 1.0);
});
// Edges of the porch steps are solid too
obstacle(fx(PORCH_STEPS.x1), fz(38.8), 0.2, 3.6 * S, 0, 1.0);
obstacle(fx(PORCH_STEPS.x2), fz(38.8), 0.2, 3.6 * S, 0, 1.0);
// Plinth faces are solid: you can only get up by the steps
obstacle(fx(19.35), fz(37), 4.3 * S, 0.2, 0, 1.0);
obstacle(fx(33.25), fz(37), 3.5 * S, 0.2, 0, 1.0);
obstacle(fx(35), fz(32.8), 0.2, 8.4 * S, 0, 1.0);
obstacle(fx(17.2), fz(32.8), 0.2, 8.4 * S, 0, 1.0);
const houseG = new THREE.Group();
houseG.position.y = PLINTH;
realScene.add(houseG);
scene = houseG;
buildOff = PLINTH;

const upper = new THREE.Group();  // roof + terrace parapets, hidden when the player is inside
scene.add(upper);

// Box from plan coordinates (feet): rect(x1, z1, x2, z2, bottomY, height, color)
function rect(x1, z1, x2, z2, y0, h, color, parent = scene, material) {
  return box([(x2 - x1) * S, h, (z2 - z1) * S], [fx((x1 + x2) / 2), y0 + h / 2, fz((z1 + z2) / 2)], color, parent, material);
}
// Furniture: a solid block the player bumps into (unless solid = false)
function furn(x1, z1, x2, z2, h, color, y0 = FLOOR_Y, solid = true) {
  const m = rect(x1, z1, x2, z2, y0, h, color);
  if (solid) obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, 0, 1.2);
  return m;
}

// A straight wall along the plan. horiz: wall runs along x at z = c; otherwise along z at x = c.
// openings: [from, to, type] where type is 'door' | 'open' | 'win' | 'vent'
function wallLine(horiz, c, a1, a2, openings = [], mat = cream) {
  const ext = T / 2 / S;
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
  const glass = (s, e, y0, y1) => {
    const mid = (s + e) / 2, len = (e - s) * S;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? len : 0.04, y1 - y0, horiz ? 0.04 : len),
      glassMat
    );
    m.position.set(horiz ? fx(mid) : fx(c), (y0 + y1) / 2, horiz ? fz(c) : fz(mid));
    scene.add(m);
    // Sliding window: dark aluminium frame, a centre divider between the two sashes and a grey stone sill
    trim(s - 0.3, e + 0.3, y0 - 0.12, y1 + 0.12, frameWhite, 0.12, T + 0.1, true);   // thick white border round the window
    const f = trim(s, e, y0, y1, frameMat, 0.07, T + 0.06, true);
    f.put(0.07, y1 - y0, 0, (y0 + y1) / 2);
    box(horiz ? [(e - s) * S + 0.18, 0.06, T + 0.2] : [T + 0.2, 0.06, (e - s) * S + 0.18], [horiz ? fx(mid) : fx(c), y0 - 0.03, horiz ? fz(c) : fz(mid)], 0, scene, sillMat);
  };
  let cursor = a1;
  [...openings].sort((p, q) => p[0] - q[0]).forEach(([a, b, type]) => {
    piece(cursor, a, 0, H);
    if (type === 'door') {
      piece(a, b, 2.1, H, { solid: false });
      trim(a, b, 0, 2.1, doorFrameMat, 0.08, T + 0.05);   // timber door frame
    }
    if (type === 'win' || type === 'vent') {
      const sill = type === 'win' ? 0.9 : 1.5, top = type === 'win' ? 2.2 : 2.3;
      piece(a, b, 0, sill, { solid: false });
      piece(a, b, top, H, { solid: false });
      piece(a, b, 0, H, { mesh: false });   // you cannot walk through a window
      planWalls.push([horiz, c, a, b]);
      glass(a, b, sill, top);
    }
    if (type === 'tall') {   // stairwell window: one tall pane from the usual sill up to the roof, carried on above the roof by the mumty
      const mid = (a + b) / 2, len = (b - a) * S, y0 = 0.9, midY = (y0 + H) / 2;
      const pane = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.04, H - y0, horiz ? 0.04 : len), glassMat);
      pane.position.set(horiz ? fx(mid) : fx(c), midY, horiz ? fz(c) : fz(mid));
      scene.add(pane);
      [a, b].forEach((edge, i) => {
        const off = i ? -0.06 : 0.06;
        box(horiz ? [0.12, H - y0, T + 0.1] : [T + 0.1, H - y0, 0.12], [horiz ? fx(edge) + off : fx(c), midY, horiz ? fz(c) : fz(edge) + off], 0, scene, frameWhite);
      });
      piece(a, b, 0, H, { mesh: false });
      piece(a, b, 0, y0, { solid: false });
      planWalls.push([horiz, c, a, b]);
    }
    cursor = b;
  });
  piece(cursor, a2, 0, H);
}

// Swinging door that opens when the player walks up to it. Purely visual: the gap is always walkable.
const doors = [];
const doorWood = textured(doorTex, 1, 0.55);
function door(horiz, c, a1, a2, hingeAtStart, swing) {
  const len = (a2 - a1) * S;
  const hinge = hingeAtStart ? a1 : a2;
  const pivot = new THREE.Group();
  pivot.position.set(horiz ? fx(hinge) : fx(c), FLOOR_Y, horiz ? fz(c) : fz(hinge));
  const leaf = box([len, 2.0, 0.06], [len / 2, 1.0, 0], 0, pivot, doorWood);
  leaf.receiveShadow = false;
  const base = horiz ? (hingeAtStart ? 0 : Math.PI) : (hingeAtStart ? -Math.PI / 2 : Math.PI / 2);
  pivot.rotation.y = base;
  scene.add(pivot);
  const mid = (a1 + a2) / 2;
  doors.push({ pivot, base, open: base + swing * Math.PI / 2, cx: horiz ? fx(mid) : fx(c), cz: horiz ? fz(c) : fz(mid) });
}

// Text painted on the floor, like the room names on the plan
function label(lines, xft, zft, width = 3.6) {
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

// ---------- Ground, road ----------
box([240, 0.2, 240], [0, -0.1, 0], 0, realScene, textured(grassTex, 3, 0.95, 0.5));
box([240, 0.1, 1.6], [0, 0.05, 12.8], 0, realScene, textured(tileTex('#a3a29d'), 1.2, 0.8, 1.0));   // pavement
box([240, 0.06, 6], [0, 0.03, 16.6], 0, realScene, textured(asphaltTex, 3, 0.85, 1.0));              // road
for (let x = -50; x <= 50; x += 6) box([2.5, 0.07, 0.18], [x, 0.04, 16.6], 0xe8e8e8, realScene);

// ---------- Floors ----------
rect(0, 0, 35, 33, 0, 0.1, 0xcfc8b8);                 // base slab
// Plain white marble everywhere inside: large polished slabs with hairline joints, no speckles
const marbleTex = makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#f3f2ee'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,120,120,0.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
});
const marbleFloor = textured(marbleTex, 1.2, 0.2, 1.0);
const woodFloor = marbleFloor;
const tileFloor = () => marbleFloor;
const tile = (x1, z1, x2, z2, material) => rect(x1, z1, x2, z2, 0.1, 0.01, 0, scene, material);
tile(0, 0, 13, 13.3, woodFloor);                      // M+bedroom-1 (wood)
tile(21.7, 0, 35, 13.3, woodFloor);                   // bedroom-2 (wood)
tile(13, 0, 17.7, 9.3, tileFloor('#9fb8c4'));         // bath + wc
tile(17.7, 0, 21.7, 6.2, tileFloor('#9fb8c4'));       // wc
tile(17.5, 13.3, 35, 28, tileFloor('#e4ddd0'));       // living hall
tile(0, 19.8, 13, 33, tileFloor('#b9b3a8'));          // kitchen
tile(13, 28.2, 17.5, 33, tileFloor('#b9b3a8'));       // old devghar corner, now part of the kitchen
rect(17.2, 28.6, 35, 37, 0, 0.1, 0xb9b0a0);           // porch

// ---------- Walls (see the ground floor plan) ----------
// Outer walls
wallLine(true, 0, 0, 35, [[4.5, 9.5, 'win'], [14.4, 16, 'vent'], [19, 20.5, 'vent'], [25.7, 30.7, 'win']]);
wallLine(false, 0, 0, 33, [[5.3, 11.4, 'win'], [14.55, 18.55, 'tall'], [20.2, 23.3, 'door'], [25.2, 30.2, 'win']]);   // west side: bedroom window, tall stairwell window (4 ft wide), kitchen door, kitchen window
wallLine(false, 35, 0, 28, [[4.7, 9.7, 'win'], [19, 24.5, 'win']]);
wallLine(true, 28, 17.5, 35, [[17.9, 21.2, 'door'], [24, 29.9, 'win'], [32.3, 34.7, 'door']], taupe);   // living hall front, main door
wallLine(true, 33, 0, 17.5, [[4.7, 9.7, 'win'], [14.4, 16, 'vent']], taupe);      // kitchen + devghar back
// Bedrooms, bath, wc
wallLine(false, 13, 0, 13.3, [[9.8, 12.8, 'door']]);          // bedroom-1 east wall
wallLine(false, 21.7, 0, 13.3, [[9.8, 12.8, 'door']]);        // bedroom-2 west wall
wallLine(false, 17.7, 0, 9.3);                                // bath | wc
wallLine(true, 9.3, 13, 17.7, [[15.7, 17.6, 'door']]);        // bath door
wallLine(true, 6.2, 17.7, 21.7, [[17.9, 20.1, 'door']]);      // wc door
wallLine(true, 13.3, 0, 13);                                  // bedroom-1 / staircase
wallLine(true, 13.3, 17.5, 35);                               // under wc, bedroom-2 / living hall
// Staircase, kitchen, devghar
wallLine(true, 19.8, 0, 13);                                  // staircase / kitchen
wallLine(false, 17.5, 19.8, 33);                              // kitchen + devghar | living hall

// Doors
door(false, 13, 9.8, 12.8, true, -1);       // bedroom-1 D1
door(false, 21.7, 9.8, 12.8, true, 1);      // bedroom-2 D1
door(true, 9.3, 15.7, 17.6, false, -1);     // bath D2
door(true, 6.2, 17.9, 20.1, true, 1);       // wc D2
door(false, 0, 20.2, 23.3, true, 1);        // kitchen -> dry balcony D1
door(true, 28, 17.9, 21.2, true, 1);        // MAIN DOOR

// ---------- Roof / terrace ----------
// One flat roof over the whole house, with a hole above the staircase. Everything here hides when you are inside.
const slab = (x1, z1, x2, z2) => rect(x1, z1, x2, z2, H - 0.2, 0.23, white, upper);   // 3 cm above the wall tops, so no wall lines show on the terrace
slab(-0.6, -0.6, 35.6, 13.3);
slab(13.2, 13.3, 35.6, 28.6);
slab(-0.6, 19.8, 13.2, 33.6);
slab(13.2, 28.6, 17.9, 33.6);
slab(17.9, 28.6, 35.6, 37.6);          // roof over the porch, level with the rest of the terrace
// Thick white fascia (0.7 m deep, projecting past the walls) over the porch and along the front of the left block, like the render
rect(17.9, 28.6, 36.3, 38.3, H - 0.7, 0.73, white, upper);
rect(-1.1, 33.0, 18.5, 34.3, H - 0.7, 0.73, white, upper);
slab(-0.6, 13.3, 0, 14.55);                 // west edge strip, with a gap for the tall stairwell window
slab(-0.6, 18.55, 0, 19.8);

function parapet(x1, z1, x2, z2) {
  rect(x1, z1, x2, z2, H, 0.9, white, upper);
  obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, H, H + 0.9);
}
parapet(-0.6, -0.6, 35.6, -0.1);
parapet(35.1, -0.1, 35.6, 37.6);       // the porch roof is part of the terrace: one edge wall runs all the way round
parapet(17.4, 37.1, 35.1, 37.6);
parapet(17.4, 33.6, 17.9, 37.1);
parapet(-0.6, 33.1, 17.9, 33.6);
parapet(-0.6, -0.1, -0.1, 11.55);          // the west edge wall stops where the stairwell tower comes through
parapet(-0.6, 21.55, -0.1, 33.1);

// Mumty (staircase headroom) on the terrace: 15 ft long x 10 ft wide, 0.6 ft thick walls, white roof slab, door on the east side.
const TW = { x1: 0, x2: 15, z1: 11.55, z2: 21.55, top: H + 2.8, wall: 0.6 };
const DOOR = { a1: 13.6, a2: 16.6 };   // door opening in the east wall (plan z, in feet), in line with the top of the stairs
// Two-tone horizontal cladding like the render: tan lower band, darker grey-olive upper part, thin grooves every 0.7 m
const claddingTex = (color) => makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, h - 3, w, 3);       // groove
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, 0, w, 2);    // highlight above it
});
const mumtyLower = textured(claddingTex('#a39c86'), 0.7, 0.9);
const mumtyUpper = textured(claddingTex('#7b7a6e'), 0.7, 0.9);
function mumtyWall(x1, z1, x2, z2, y0 = H, solid = true, y1 = TW.top) {
  if (y1 <= y0) return;
  const split = H + 1.4;   // tone changes 1.4 m above the terrace floor
  if (y0 < split) rect(x1, z1, x2, z2, y0, Math.min(split, y1) - y0, 0, upper, mumtyLower);
  const yu = Math.max(y0, split);
  if (y1 > yu) rect(x1, z1, x2, z2, yu, y1 - yu, 0, upper, mumtyUpper);
  if (solid) obstacle(fx((x1 + x2) / 2), fz((z1 + z2) / 2), (x2 - x1) * S, (z2 - z1) * S, y0, y1);
}
// Small window in the mumty's west (left) wall, near the front end
const MWIN = { z1: 14.55, z2: 18.55, y0: 0.9, y1: 0.9 + 4.8 };   // tall stairwell window, 4 ft wide x 12 ft high, one pane from the usual sill up past the roof
mumtyWall(TW.x1, TW.z1, TW.x2, TW.z1 + TW.wall);                                      // north wall
mumtyWall(TW.x1, TW.z2 - TW.wall, TW.x2, TW.z2);                                      // south wall
mumtyWall(TW.x1, TW.z1, TW.x1 + TW.wall, MWIN.z1);                                    // west wall, north of the window
mumtyWall(TW.x1, MWIN.z2, TW.x1 + TW.wall, TW.z2);                                    // west wall, south of the window
mumtyWall(TW.x1, MWIN.z1, TW.x1 + TW.wall, MWIN.z2, H, true, MWIN.y0);                // under the window
mumtyWall(TW.x1, MWIN.z1, TW.x1 + TW.wall, MWIN.z2, MWIN.y1);                         // over the window
{
  // The tower face: continuous cladding from the plinth to the roof cap, flush with the roof edge, with one tall 4 ft x 12 ft window (left-side elevation)
  const FX1 = -0.75, FX2 = -0.15;
  mumtyWall(FX1, TW.z1, FX2, MWIN.z1, 0);
  mumtyWall(FX1, MWIN.z2, FX2, 19.2, 0, true, H);     // below the roof the face stops before the kitchen door and steps
  mumtyWall(FX1, MWIN.z2, FX2, TW.z2, H);             // above the roof it runs the full width of the mumty
  mumtyWall(FX1, MWIN.z1, FX2, MWIN.z2, 0, true, MWIN.y0);        // under the window
  mumtyWall(FX1, MWIN.z1, FX2, MWIN.z2, MWIN.y1);                  // over the window
  const wx = fx(-0.45), wz = fz((MWIN.z1 + MWIN.z2) / 2), wy = (MWIN.y0 + MWIN.y1) / 2;
  const gw = (MWIN.z2 - MWIN.z1) * S, gh = MWIN.y1 - MWIN.y0, dark = 0x1f2226;
  glow([0.05, gh, gw], [wx, wy, wz], 0xffd08a, upper);                                                       // one tall lit pane
  box([0.26, 0.05, gw + 0.1], [wx, MWIN.y1 + 0.025, wz], dark, upper); box([0.26, 0.05, gw + 0.1], [wx, MWIN.y0 - 0.025, wz], dark, upper);
  box([0.26, gh, 0.05], [wx, wy, wz - gw / 2 - 0.025], dark, upper); box([0.26, gh, 0.05], [wx, wy, wz + gw / 2 + 0.025], dark, upper);
  box([0.3, 0.1, gw + 0.3], [wx, MWIN.y1 + 0.1, wz], white, upper); box([0.3, 0.1, gw + 0.3], [wx, MWIN.y0 - 0.1, wz], white, upper);
  box([0.3, gh + 0.2, 0.1], [wx, wy, wz - gw / 2 - 0.1], white, upper); box([0.3, gh + 0.2, 0.1], [wx, wy, wz + gw / 2 + 0.1], white, upper);
}
mumtyWall(TW.x2 - TW.wall, DOOR.a2, TW.x2, TW.z2);                                    // east wall, south of the door
mumtyWall(TW.x2 - TW.wall, DOOR.a1, TW.x2, DOOR.a2, H + 2.1, false);                  // wall above the door
// (no door leaf and no lamps: the mumty is a plain architectural block; the gap in the east wall is only the open way out of the stairs)
rect(TW.x1 - 0.9, TW.z1 - 0.9, TW.x2 + 0.9, TW.z2 + 0.9, TW.top, 0.15, white, upper);   // thin white roof slab with a slim overhang
// "Section for tank" on top of the mumty: a plain white box set back from the slab edge, with a slim lid, and small brackets under the roof slab ends
rect(TW.x1 + 1.5, TW.z1 + 0.8, TW.x2 - 1.5, TW.z2 - 0.8, TW.top + 0.15, 0.6, 0xe9e7e0, upper);
rect(TW.x1 + 1.3, TW.z1 + 0.6, TW.x2 - 1.3, TW.z2 - 0.6, TW.top + 0.75, 0.08, white, upper);
[[TW.z1 - 0.9, TW.z1], [TW.z2, TW.z2 + 0.9]].forEach(([za, zb]) => rect(TW.x1 - 0.9, za, TW.x2 + 0.9, zb, TW.top - 0.32, 0.32, white, upper));

// ---------- Front facade details (from the reference render) ----------
const charcoalClad = textured(claddingTex('#55534f'), 0.7, 0.9);
{
  // Tall charcoal accent panel with grooves, rising above the roof, with warm wall lamps
  const px1 = 10.3, px2 = 14.1, pz1 = 33.4, pz2 = 34.0;
  rect(px1, pz1, px2, pz2, 0, H, 0, scene, charcoalClad);
  rect(px1, pz1, px2, pz2, H, 1.4, 0, upper, charcoalClad);
  rect(px1 - 0.3, pz1 - 0.2, px2 + 0.3, pz2 + 0.3, H + 1.4, 0.12, white, upper);   // thin white cap
  obstacle(fx((px1 + px2) / 2), fz((pz1 + pz2) / 2), (px2 - px1) * S, (pz2 - pz1) * S, 0, H + 1.4);
  [[11.2, 2.3], [13.2, 2.3]].forEach(([xf, y]) => {
    box([0.2, 0.2, 0.12], [fx(xf), y, fz(pz2) + 0.06], 0x2a2a2a, scene);
    glow([0.14, 0.14, 0.04], [fx(xf), y, fz(pz2) + 0.13], 0xffe8b8, scene);
    wallGlow(fx(xf), y, fz(pz2) + 0.15);
  });
}
{
  // Decorative facade on the porch edge of the terrace: charcoal panel, recessed square frame, golden strips (no text)
  const h = 1.5;
  rect(26.5, 36.9, 34.3, 37.7, H, h, 0, upper, charcoalClad);
  rect(26.3, 36.7, 35.7, 37.9, H + h, 0.1, white, upper);
  rect(21.5, 36.9, 25.5, 37.7, H, h, white, upper);                                    // white frame
  rect(22.1, 37.4, 24.9, 37.75, H + 0.3, h - 0.6, 0x3b3a38, upper);                    // recessed square
  rect(34.3, 36.9, 35.6, 37.7, H, h, 0xd9a63a, upper);                                 // golden strips
  for (let i = 0; i < 3; i++) rect(34.55 + i * 0.35, 37.65, 34.6 + i * 0.35, 37.75, H, h, 0xa87a1f, upper);
  obstacle(fx(28.6), fz(37.3), 14.1 * S, 0.8 * S, H, H + h);
}
{
  // Recessed ceiling lights under the porch fascia
  const spot = new THREE.MeshBasicMaterial({ color: col(0xfff3d8) });
  for (let xf = 20; xf <= 33; xf += 3.25) for (const zf of [30.8, 34.8]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), spot);
    c.rotation.x = Math.PI / 2;
    c.position.set(fx(xf), H - 0.71, fz(zf));
    scene.add(c);
  }
}

{
  // Front-left of the terrace: a horizontal-slat railing above the edge wall (no planter, no plants: the terrace stays plain)
  [1.15, 1.4].forEach((y) => rect(-0.5, 33.2, 17.5, 33.36, H + y, 0.06, white, upper));
  for (let xf = -0.4; xf <= 17.5; xf += 3) rect(xf, 33.15, xf + 0.25, 33.4, H + 0.9, 0.55, white, upper);
  // Cladding panels on the front walls: tan beside the window, a vine strip, warm brown beside the porch window
  const tanClad = textured(claddingTex('#a89c88'), 0.7, 0.9);
  const brownClad = textured(claddingTex('#9a7b5c'), 0.7, 0.9);
  rect(-0.4, 33.4, 3.3, 33.7, 0, 2.3, 0, scene, tanClad);
  rect(3.4, 33.4, 4.3, 33.65, 0.3, 2.5, 0, scene, textured(leafTex, 0.45, 1));
  rect(30.5, 28.4, 34.7, 28.62, 0.1, 2.7, 0, scene, brownClad);
  // Porch columns: darker grey lower part, white above
  [[17.9, 36.6], [34.5, 36.6]].forEach(([x, z]) => rect(x - 0.65, z - 0.65, x + 0.65, z + 0.65, 0, 1.5, 0x6a665f, scene));
}

// Corner pilasters on the west face (the slim columns at both ends of the left-side elevation)
[[-0.4, 1.3], [31.7, 33.0]].forEach(([za, zb]) => rect(-0.5, za, 0, zb, 0, H, 0, scene, frameWhite));

// ---------- Staircase (U-shaped, 6'6" x 16'6" room) ----------
// Enter from the open passage on the east side, climb west along the south lane to the landing, turn, and climb east to the terrace.
const ST = { x1: 0, x2: 13.2, zMid: 16.8, z1: 13.3, z2: 19.8, landing: 3.8, steps: 8 };
const STEP_LEN = (ST.x2 - ST.landing) / ST.steps;
for (let i = 0; i < ST.steps; i++) {
  const lowH = (H / 2) * (i + 1) / ST.steps;
  rect(ST.x2 - (i + 1) * STEP_LEN, ST.zMid, ST.x2 - i * STEP_LEN, ST.z2, 0, lowH, 0xe9e9e6);                       // lower flight
  const upH = H / 2 + (H / 2) * (i + 1) / ST.steps;
  {
    // Upper flight is hollow: thin tread + riser + the partition wall below it (storeroom underneath)
    const xa = ST.landing + i * STEP_LEN, xb = xa + STEP_LEN, prevH = H / 2 + (H / 2) * i / ST.steps;
    rect(xa, ST.z1, xb, ST.zMid, upH - 0.12, 0.12, 0xe9e9e6);
    rect(xa, ST.z1, xa + 0.3, ST.zMid, prevH, upH - prevH - 0.12, 0xe9e9e6);
    rect(xa, ST.zMid - 0.15, xb, ST.zMid + 0.15, 0, upH - 0.12, 0xd8d4c8);
  }              // upper flight
}
rect(ST.x1, ST.z1, ST.landing, ST.z2, 0, H / 2, 0xe9e9e6);                                                         // landing
// Rail between the two flights, and a block that stops people stepping onto the upper flight from the ground
rect(ST.landing, ST.zMid - 0.12, ST.x2, ST.zMid + 0.12, H / 2, 1.0, white);
obstacle(fx((ST.landing + ST.x2) / 2), fz(ST.zMid), (ST.x2 - ST.landing) * S, 0.12, 0, H - 0.2);

// Storeroom under the upper flight: closed on the west by the landing, on the south by the partition, open to the passage through a door on the east
obstacle(fx(ST.landing), fz((ST.z1 + ST.zMid) / 2), 0.15, (ST.zMid - ST.z1) * S, 0, H / 2);
wallLine(false, ST.x2, ST.z1, ST.zMid, [[13.8, 16.4, 'door']]);
door(false, ST.x2, 13.8, 16.4, true, 1);
tile(ST.landing, ST.z1, ST.x2, ST.zMid, tileFloor('#9a948a'));
furn(5, 13.7, 11, 14.5, 1.5, 0x7a5a3a);                    // shelves along the north wall
furn(5, 15.7, 6.6, 16.5, 0.5, 0xb08a5a);                   // boxes
furn(7.2, 15.9, 8.6, 16.5, 0.4, 0xa07a4a);
label(['STOREROOM', 'under the stairs'], 9.5, 15.3, 3);
warmLight(fx(9), PLINTH + 1.7, fz(15), 0.8, 6);

// Height of the staircase floor at plan position (xf, zf)
function stairHeight(xf, zf, currentY) {
  if (xf < ST.landing) return H / 2;
  // Underneath the upper flight is the storeroom: if you are standing on the floor there, stay on the floor
  if (zf < ST.zMid) {
    const j = Math.min(Math.floor((xf - ST.landing) / STEP_LEN), ST.steps - 1);
    const treadH = H / 2 + (H / 2) * (j + 1) / ST.steps;
    if (currentY < treadH - 1.5) return FLOOR_Y;
  }
  if (zf >= ST.zMid) {
    const i = Math.floor((ST.x2 - xf) / STEP_LEN);
    return i < 0 ? 0.1 : (H / 2) * (Math.min(i, ST.steps - 1) + 1) / ST.steps;
  }
  const j = Math.floor((xf - ST.landing) / STEP_LEN);
  return H / 2 + (H / 2) * (Math.min(j, ST.steps - 1) + 1) / ST.steps;
}

// ---------- Porch, dry balcony ----------
// (the porch roof is now part of the terrace slab above, so there is no separate porch roof here)
[[17.9, 36.6], [34.5, 36.6]].forEach(([x, z]) => furn(x - 0.6, z - 0.6, x + 0.6, z + 0.6, H - 0.7, white, 0, true));   // porch columns hold up the thick fascia slab
// The area outside the kitchen door is open steps, not a closed balcony: walk out from the kitchen straight into the garden.

// ---------- Rooms: furniture ----------
const wood = 0x6b4f3a;
function bed(cx) {
  const z0 = 0.9;
  furn(cx - 2.75, z0 - 0.45, cx + 2.75, z0, 1.0, 0x4a3224);                              // headboard
  furn(cx - 2.75, z0, cx + 2.75, z0 + 6.5, 0.4, wood);                                   // frame
  furn(cx - 2.4, z0 + 0.2, cx + 2.4, z0 + 6.3, 0.25, 0xd9d0e6, FLOOR_Y + 0.4, false);    // mattress
  furn(cx - 2.4, z0 + 2.6, cx + 2.4, z0 + 6.3, 0.08, 0xe0b27a, FLOOR_Y + 0.65, false);   // blanket
  furn(cx - 2.2, z0 + 0.4, cx - 0.2, z0 + 1.6, 0.15, 0xf5ead2, FLOOR_Y + 0.65, false);   // pillows
  furn(cx + 0.2, z0 + 0.4, cx + 2.2, z0 + 1.6, 0.15, 0xf5ead2, FLOOR_Y + 0.65, false);
  [cx - 3.9, cx + 3.0].forEach((x) => {                                                  // side tables + lamps
    furn(x, z0 - 0.1, x + 1.2, z0 + 1.1, 0.5, 0x6b2e22);
    glow([0.14, 0.14, 0.14], [fx(x + 0.6), FLOOR_Y + 0.62, fz(z0 + 0.5)]);
  });
}
bed(7.1);
bed(28.9);

// L-shaped kitchen counter: along the back wall, then along the west wall up to the door
// White marble worktop with black veins, dark cabinets, and a stainless steel sink with a pull-down tap under the window
const marbleCounterTex = makeTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#f2f1ee'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {   // soft grey clouds
    ctx.fillStyle = `rgba(120,120,125,${rand(0.03, 0.07)})`;
    ctx.beginPath(); ctx.ellipse(rand(0, w), rand(0, h), rand(40, 110), rand(10, 30), rand(0, 3), 0, 7); ctx.fill();
  }
  for (let i = 0; i < 9; i++) {    // dark veins
    let x = rand(0, w), y = rand(0, h), a = rand(0, 6.28);
    ctx.strokeStyle = `rgba(25,25,30,${rand(0.55, 0.9)})`; ctx.lineWidth = rand(0.8, 2.6);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 14; k++) { a += rand(-0.7, 0.7); x += Math.cos(a) * rand(14, 34); y += Math.sin(a) * rand(14, 34); ctx.lineTo(x, y); }
    ctx.stroke();
  }
});
const marbleTop = textured(marbleCounterTex, 1.5, 0.12);
const cabinet = 0x2b2420;
const worktop = (x1, z1, x2, z2) => rect(x1, z1, x2, z2, FLOOR_Y + 0.9, 0.05, 0, scene, marbleTop);
const counter = (x1, z1, x2, z2) => { furn(x1, z1, x2, z2, 0.9, cabinet); worktop(x1, z1, x2, z2); };
counter(0.4, 24.4, 2.5, 32.8);                                    // west leg (stops just before the door)
counter(2.5, 30.6, 5.4, 32.8);                                    // back leg, left of the sink
counter(8.8, 30.6, 10.6, 32.8);                                   // back leg, right of the sink
// Sink unit (under the kitchen window): a low cabinet, worktop around a cut-out, steel basin
furn(5.4, 30.6, 8.8, 32.8, 0.5, cabinet);
worktop(5.4, 30.6, 5.9, 32.8); worktop(8.3, 30.6, 8.8, 32.8); worktop(5.9, 30.6, 8.3, 31.0); worktop(5.9, 32.4, 8.3, 32.8);
const basin = (x1, z1, x2, z2, y0, h) => rect(x1, z1, x2, z2, FLOOR_Y + y0, h, 0, scene, steel);
basin(5.9, 31.0, 8.3, 32.4, 0.5, 0.03);                           // basin floor
basin(5.9, 31.0, 6.0, 32.4, 0.5, 0.45); basin(8.2, 31.0, 8.3, 32.4, 0.5, 0.45);   // basin sides
basin(5.9, 31.0, 8.3, 31.1, 0.5, 0.45); basin(5.9, 32.3, 8.3, 32.4, 0.5, 0.45);
rect(6.9, 31.6, 7.3, 31.9, FLOOR_Y + 0.53, 0.005, 0x1a1a1a);      // drain
{
  // Pull-down tap: base, stem, curved spout and head, and a side lever
  const tx = fx(7.1), tz = fz(32.6), baseY = FLOOR_Y + 0.95, R = 0.1, stemH = 0.3;
  const part = (geo, x, y, z) => { const m = new THREE.Mesh(geo, steel); m.position.set(x, y, z); m.castShadow = true; scene.add(m); return m; };
  part(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 12), tx, baseY + 0.015, tz);
  part(new THREE.CylinderGeometry(0.016, 0.016, stemH, 10), tx, baseY + 0.03 + stemH / 2, tz);
  const arc = part(new THREE.TorusGeometry(R, 0.014, 8, 20, Math.PI), tx, baseY + 0.03 + stemH, tz - R);
  arc.rotation.y = Math.PI / 2;                                   // arc leans from the stem toward the front of the basin
  part(new THREE.CylinderGeometry(0.02, 0.016, 0.1, 10), tx, baseY + 0.03 + stemH - 0.05, tz - 2 * R);   // spout head
  part(new THREE.BoxGeometry(0.07, 0.015, 0.015), tx + 0.06, baseY + 0.05, tz);                           // lever
}
[[9.1, 31.1], [9.1, 32.0], [9.8, 31.1], [9.8, 32.0]].forEach(([x, z]) => furn(x, z, x + 0.7, z + 0.7, 0.03, 0x111111, FLOOR_Y + 0.95, false)); // stove
furn(10.8, 30.6, 12.7, 32.8, 1.8, 0xcfd4d8);                      // fridge at the end of the counter

// Living hall: L-shaped sofa, coffee table, TV console
const sofa = 0xa0627f;
furn(32.6, 18.3, 34.0, 25.2, 0.5, sofa);
furn(34.0, 18.3, 34.6, 25.2, 1.0, 0x86506a);
furn(22.2, 25.4, 29.2, 27.0, 0.5, sofa);   // starts 1 ft from the main door (which ends at 21.2)
furn(22.2, 27.0, 29.2, 27.6, 1.0, 0x86506a);
furn(28.6, 22.4, 31, 23.8, 0.4, 0x3b2a22);
furn(24.5, 13.8, 29.5, 15.3, 0.5, 0x3a2a22);                                               // TV console on the far (north) wall
furn(25.9, 14.2, 28.1, 14.5, 0.7, 0x0e0e12, FLOOR_Y + 0.5, false);                         // TV, facing the sofa

// WC + bath
furn(19.1, 0.5, 20.3, 1.1, 0.7, white);
furn(19.1, 1.1, 20.3, 2.8, 0.4, white);
furn(14, 0.7, 15.5, 1.7, 0.9, white);
furn(14, 7.4, 16.6, 8.8, 0.04, 0x7fa6c0, FLOOR_Y, false);                                  // shower tray

// Hand-wash basin in the lobby, against the west wall at plan (18.5, 8.4): cabinet, bowl, tap and mirror
furn(18.0, 7.6, 19.4, 9.2, 0.8, 0xe8e4dc);                                            // cabinet
furn(18.0, 7.7, 19.3, 9.1, 0.07, 0xf4f8fa, FLOOR_Y + 0.8, false);                     // basin top
furn(18.3, 8.1, 19.0, 8.7, 0.02, 0xaeb8bf, FLOOR_Y + 0.87, false);                    // bowl
const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), steel);
tap.position.set(fx(18.25), FLOOR_Y + 0.96, fz(8.4));
scene.add(tap);
const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), steel);
spout.rotation.z = Math.PI / 2;
spout.position.set(fx(18.25) + 0.05, FLOOR_Y + 1.03, fz(8.4));
scene.add(spout);
box([0.03, 0.62, 0.56], [fx(17.95) + 0.05, FLOOR_Y + 1.55, fz(8.4)], 0x2b2b2b);       // mirror frame
box([0.02, 0.56, 0.5], [fx(17.95) + 0.07, FLOOR_Y + 1.55, fz(8.4)], 0, scene, new THREE.MeshStandardMaterial({ color: col(0xdfe8ee), roughness: 0.04, metalness: 1 }));
label(['WASH BASIN', ''], 20.2, 8.4, 1.6);

// Devghar room (4x5) is left empty; the god section now stands on the porch
// Devghar (god section): 3' x 3' room in the right corner of the porch. Its back is to the porch, its front opens into the living hall.
const marble = 0xf0ece4, gold = 0xd9a441;
const DX1 = 32.4, DX2 = 34.6, DZ1 = 29.9, DZ2 = 31.4, DXC = (DX1 + DX2) / 2;
furn(DX1, DZ1, DX2, DZ2, 0.9, marble);                                               // marble base
rect(DX1, DZ1, DX1 + 0.5, DZ1 + 0.5, FLOOR_Y + 0.9, 1.1, marble);                    // front pillars (facing the hall)
rect(DX2 - 0.5, DZ1, DX2, DZ1 + 0.5, FLOOR_Y + 0.9, 1.1, marble);
rect(DX1, DZ1, DX2, DZ2, FLOOR_Y + 2.0, 0.18, 0xf5e6c0);                             // canopy
rect(DX1, DZ1, DX2, DZ1 + 0.2, FLOOR_Y + 2.18, 0.1, gold);                           // gold trim
const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), paint(gold, 0.35));
dome.position.set(fx(DXC), FLOOR_Y + 2.18, fz((DZ1 + DZ2) / 2));
dome.castShadow = true;
scene.add(dome);
const kalash = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), paint(gold, 0.3));
kalash.position.set(fx(DXC), FLOOR_Y + 2.67, fz((DZ1 + DZ2) / 2));
scene.add(kalash);
[[DXC - 0.7, 0xc0392b], [DXC, 0x2a6fb0], [DXC + 0.7, 0xe08a1e]].forEach(([x, c]) => {   // idols
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.38, 8), paint(c, 0.6));
  body.position.set(fx(x), FLOOR_Y + 1.1, fz(DZ2 - 0.5));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), paint(gold, 0.4));
  head.position.set(fx(x), FLOOR_Y + 1.38, fz(DZ2 - 0.5));
  scene.add(body, head);
});
[DX1 + 0.5, DX2 - 0.5].forEach((x) => glow([0.1, 0.12, 0.1], [fx(x), FLOOR_Y + 0.96, fz(DZ1 + 0.6)], 0xffa63a));   // diyas
for (let x = DX1 + 0.3; x < DX2; x += 0.45) glow([0.1, 0.08, 0.1], [fx(x), FLOOR_Y + 0.93, fz(DZ1 + 0.1)], 0xff9f1a); // marigold garland
const diyaLight = warmLight(fx(DXC), FLOOR_Y + 1.6, fz(DZ1 - 0.2), 0.8, 4.5);   // flickers like a real lamp
// Walls of the little room, and the opening into the living hall
wallLine(false, 35, 28, 31.8, [], taupe);
wallLine(false, 32, 28, 31.8, [], taupe);
wallLine(true, 31.8, 32, 35, [[33.1, 34.5, 'vent']], taupe);   // small window on the porch side of the devghar
tile(32, 28, 35, 31.8, tileFloor('#e8d9a8'));

// Room names painted on the floor
label(["M+BEDROOM-1", "12' x 12'"], 6.5, 11, 3.6);
label(["BEDROOM-2", "12' x 12'"], 28.3, 11, 3.6);
label(["BATH+WC", "4' x 8'"], 15.3, 5.3, 2.2);
label(["WC", "4' x 5'"], 19.7, 4.4, 1.6);
label(["LIVING HALL", "16'6\" x 14'"], 24.5, 17.5, 3.8);
label(["KITCHEN", "16'6\" x 12'"], 6.5, 28.7, 3.2);

label(["PORCH", "16'6\" x 9'"], 26.2, 33, 3.6);

// ---------- Windows get a lit look from outside; wall lamps by the main door ----------
[[fx(19.5), 2.4, fz(28.4)], [fx(22.5), 2.4, fz(28.4)]].forEach((p) => {
  glow([0.22, 0.22, 0.14], p, 0xffe8b8);
  wallGlow(p[0], p[1], p[2] + 0.12);
});

// Brick cladding beside the porch windows (like the render)
const brickMat = textured(brickTex, 1.0, 0.85, 1.2);
brickMat.transparent = true;
wallMats.push(brickMat);
[[21.5, 23.9], [30.0, 32.2]].forEach(([a, b]) => box([(b - a) * S, 2.6, 0.06], [fx((a + b) / 2), 1.3, fz(28) + T / 2 + 0.03], 0, scene, brickMat));

// ---------- Garden: hedges, palms, trees ----------
scene = realScene;   // back to ground level
buildOff = 0;
const hedgeMat = textured(leafTex, 0.8, 1);
function hedge(cx, cz, w, d) {
  box([w, 0.9, d], [cx, 0.45, cz], 0, scene, hedgeMat);
  for (let x = -w / 2 + 0.3; x <= w / 2 - 0.2; x += 0.5) {   // rounded top made of overlapping bushes
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), hedgeMat);
    bush.scale.set(1, 0.7, Math.max(d, 0.6) * 1.1);
    bush.position.set(cx + x, 0.9, cz);
    bush.castShadow = true;
    scene.add(bush);
  }
  obstacle(cx, cz, w, d, 0, 0.9);
}
hedge(-3.6, 10, 6.4, 0.9);
hedge(fx(35) + 0.2, 10, 1.4, 0.9);

const trunkMat = paint(0x6a4a2c, 1);
const frondMat = new THREE.MeshStandardMaterial({ color: col(0x3f8f3a), roughness: 0.8, side: THREE.DoubleSide });

// A palm frond: three leaf segments that rise and then droop
function frond(yaw) {
  const root = new THREE.Group();
  root.rotation.y = yaw;
  root.position.y = 1.6;
  let parent = root;
  for (let k = 0; k < 3; k++) {
    const seg = new THREE.Group();
    seg.rotation.z = k === 0 ? 0.55 : -0.55;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.26 - k * 0.07), frondMat);
    leaf.position.x = 0.275;
    leaf.castShadow = true;
    seg.add(leaf);
    const next = new THREE.Group();
    next.position.x = 0.55;
    seg.add(next);
    parent.add(seg);
    parent = next;
  }
  return root;
}

function palm(x, z, y = 0) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.6, 6), trunkMat);
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 9; i++) g.add(frond((i / 9) * Math.PI * 2 + rand(-0.2, 0.2)));
  g.position.set(x, y, z);
  (y ? upper : scene).add(g);
  glow([0.2, 0.1, 0.2], [x, y + 0.05, z + 0.3], 0xffcf70, y ? upper : scene); // uplight
}

// (no big trees around the house: the plot is kept clear)

// Stainless-steel handrails up the porch steps (like the render)
function rod(a, b, r, mat = steel) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  scene.add(m);
}
[PORCH_STEPS.x1 - 0.5, PORCH_STEPS.x2 + 0.5].forEach((xf) => {
  const x = fx(xf), zTop = fz(36.2), zBot = fz(40.4);
  const top = new THREE.Vector3(x, 0.9 + 0.95, zTop), bot = new THREE.Vector3(x, 0.2 + 0.95, zBot);
  rod(top, bot, 0.03);
  [0.3, 0.6].forEach((drop) => rod(top.clone().setY(top.y - drop), bot.clone().setY(bot.y - drop), 0.015));
  rod(new THREE.Vector3(x, 0.9, zTop), top, 0.03);   // posts
  rod(new THREE.Vector3(x, 0, zBot), bot, 0.03);
});

// Street lamps along the pavement: warm head, light pool on the ground (a cheap glow instead of a real light)
[-30, -14, 14, 30].forEach((x) => {
  const z = 12.2;
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

// Fireflies drifting over the garden
const FLY = 60;
const flyBase = Array.from({ length: FLY }, () => [rand(-25, 25), rand(0.4, 2.2), Math.random() < 0.6 ? rand(9.8, 14) : rand(-14, -8), rand(0, 6.28), rand(0.4, 1.0)]);
const flyGeo = new THREE.BufferGeometry();
flyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLY * 3), 3));
const dotTex = makeTexture(32, 32, (ctx) => { const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); }, false);
const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ map: dotTex, color: 0xc8ff7a, size: 0.22, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
flies.frustumCulled = false;
scene.add(flies);
function updateFireflies(t) {
  const pos = flyGeo.attributes.position;
  flyBase.forEach(([x, y, z, ph, sp], i) => {
    pos.setXYZ(i, x + Math.sin(t * 0.3 * sp + ph) * 1.5, y + Math.sin(t * 0.7 * sp + ph * 2) * 0.35, z + Math.cos(t * 0.25 * sp + ph) * 1.5);
  });
  pos.needsUpdate = true;
}

// ---------- Lights ----------
scene = houseG;   // house lights ride up with the plinth
warmLight(fx(6.5), 2.4, fz(6.5), 1.0, 9);     // bedroom-1
warmLight(fx(28.3), 2.4, fz(6.5), 1.0, 9);    // bedroom-2
warmLight(fx(15.3), 2.4, fz(4.5), 0.7, 7);    // bath
warmLight(fx(17), 2.4, fz(13), 0.9, 9);       // central passage
warmLight(fx(26), 2.4, fz(21), 1.1, 11, true); // living hall
warmLight(fx(7), 2.4, fz(26.5), 1.0, 10);     // kitchen
warmLight(fx(6.5), 2.4, fz(16.5), 0.8, 8);    // stairs
warmLight(fx(26), 2.6, fz(33), 1.0, 9, true); // porch
warmLight(fx(17), 5.5, fz(16), 0.6, 14);      // terrace
warmLight(0, 1.2, 10.5, 0.6, 9);              // garden
scene = realScene;

// ---------- Player: a person with jointed limbs ----------
// =====================================================================================================
// makeHouse(config): a reusable component. Draw any simple house by listing its rooms, doors and windows.
// Everything is in FEET on the same plan grid as the bungalow (x runs west -> east, z runs north -> south, so +z faces the road).
//
//   makeHouse({
//     name: 'My house',
//     at: [46, 3],                       // where the house's north-west corner sits on the plan
//     wall: 3.0,                         // wall height in metres (optional, default 3)
//     wallColor: '#d3c7ae',              // optional
//     rooms: [                           // rectangles, positions relative to `at`; rooms that touch share their wall
//       { name: 'Room', x: 0, z: 0, w: 12, d: 13 },
//       { name: 'Hall', x: 0, z: 13, w: 24, d: 10 },
//     ],
//     openings: [                        // side = which wall of that room: N, S, E or W
//       { room: 'Hall', side: 'S', from: 10.5, width: 3, type: 'door' },   // from = feet from the start of that wall (west end for N/S, north end for E/W)
//       { room: 'Room', side: 'N', from: 4, width: 3.5, type: 'win' },     // type: 'door' | 'win' | 'vent' | 'open'
//     ],
//     roof: { type: 'gable', ridge: 'x', rise: 1.4 },   // or { type: 'flat' }
//     furniture: [{ x: 1, z: 1, w: 4, d: 6, h: 0.45, color: 0x7c5a3a }],   // optional blocks, relative to `at`
//   });
// =====================================================================================================
const buildings = [];   // every house made by makeHouse(): used for floors and for hiding roofs when you walk inside
const tinTex = makeTexture(128, 128, (ctx, w, h) => {   // corrugated tin sheet, ribs run down the slope
  for (let x = 0; x < w; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, '#6f757a'); g.addColorStop(0.5, '#a8aeb3'); g.addColorStop(1, '#6f757a');
    ctx.fillStyle = g; ctx.fillRect(x, 0, 16, h);
  }
  ctx.fillStyle = 'rgba(120,70,40,0.12)';
  for (let i = 0; i < 12; i++) ctx.fillRect(rand(0, w), 0, rand(1, 3), h);   // faint rust streaks
  speckle(ctx, w, h, 600, 2, 0.05);
});
const tinMat = textured(tinTex, 1.0, 0.5);
tinMat.metalness = 0.35;

function makeHouse(cfg) {
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
  H = wallH;   // wallLine() builds walls up to H
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
  H = savedH;

  // 3. Doors swing into the room they belong to
  const swingInto = { S: 1, N: -1, E: -1, W: 1 };
  ops.forEach((o) => { if (o.type === 'door') door(o.horiz, o.c, o.a, o.b, true, swingInto[o.side]); });

  // 4. Floors, room names, lamps, furniture
  rooms.forEach((r) => {
    rect(r.x1, r.z1, r.x2, r.z2, 0, 0.1, cfg.floorColor ?? 0xa9a69f);
    const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
    label([r.name, `${r.w} x ${r.d} ft`], cx, cz, Math.min(3.4, r.w * S * 0.7));
    warmLight(fx(cx), 2.2, fz(cz), 0.9, 8);
  });
  (cfg.furniture || []).forEach((f) => furn(ox + f.x, oz + f.z, ox + f.x + f.w, oz + f.z + f.d, f.h ?? 0.5, f.color ?? 0x7c5a3a));

  // 5. Roof: slopes are hidden while you are inside; gable ends and the frame stay
  const roof = new THREE.Group();
  const roofCfg = cfg.roof || { type: 'gable' };
  const cx = fx((bounds.x1 + bounds.x2) / 2), cz = fz((bounds.z1 + bounds.z2) / 2);
  const lenX = (bounds.x2 - bounds.x1) * S, lenZ = (bounds.z2 - bounds.z1) * S;
  if (roofCfg.type === 'flat') {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(lenX + 0.5, 0.2, lenZ + 0.5), paint(0xe6e3dc));
    slab.position.set(cx, wallH + 0.1, cz); slab.castShadow = slab.receiveShadow = true; roof.add(slab);
    [[lenX + 0.5, 0.05, 0.4, 0, lenZ / 2 + 0.05], [lenX + 0.5, 0.05, 0.4, 0, -lenZ / 2 - 0.05]].forEach(([w, , d, x, z]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), paint(0xe6e3dc)); p.position.set(cx + x, wallH + 0.4, cz + z); roof.add(p);
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
      const sheet = new THREE.Mesh(geo, roofCfg.color ? paint(roofCfg.color, 0.6) : tinMat);
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

const player = new THREE.Group();     // position and facing
const body = new THREE.Group();       // everything above the hips: leans, twists and breathes
body.position.y = 0.95;
player.add(body);
const skin = paint(0xe0ac84, 0.7), shirt = paint(0x2a4d9b, 0.8), jeans = paint(0x2b2f3a, 0.85), shoeMat = paint(0x1b1b1b, 0.6), hair = paint(0x1c1410, 0.9);
function limbPart(parent, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
const joint = (parent, x, y) => { const g = new THREE.Group(); g.position.set(x, y, 0); parent.add(g); return g; };
// Torso, pelvis, neck, head
limbPart(body, new THREE.CylinderGeometry(0.21, 0.17, 0.6, 12), shirt, 0, 0.33, 0).scale.z = 0.62;
limbPart(body, new THREE.CylinderGeometry(0.17, 0.17, 0.2, 12), jeans, 0, 0.0, 0).scale.z = 0.65;
limbPart(body, new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), skin, 0, 0.67, 0);
const head = limbPart(body, new THREE.SphereGeometry(0.115, 14, 10), skin, 0, 0.81, 0);
head.scale.set(0.95, 1.12, 1);
limbPart(body, new THREE.SphereGeometry(0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.83, -0.012);
// Legs (hip joint at the root, so they do not lean with the torso) and arms (shoulder joints on the torso)
const legs = [-0.1, 0.1].map((x) => {
  const hip = joint(player, x, 0.95);
  limbPart(hip, new THREE.CylinderGeometry(0.085, 0.07, 0.46, 10), jeans, 0, -0.23, 0);
  const knee = joint(hip, 0, -0.46);
  limbPart(knee, new THREE.CylinderGeometry(0.065, 0.055, 0.44, 10), jeans, 0, -0.22, 0);
  limbPart(knee, new THREE.BoxGeometry(0.11, 0.07, 0.25), shoeMat, 0, -0.45, 0.05);
  return { hip, knee };
});
const arms = [-0.27, 0.27].map((x) => {
  const shoulder = joint(body, x, 0.55);
  limbPart(shoulder, new THREE.SphereGeometry(0.065, 10, 8), shirt, 0, 0, 0);
  limbPart(shoulder, new THREE.CylinderGeometry(0.05, 0.045, 0.3, 10), shirt, 0, -0.15, 0);
  const elbow = joint(shoulder, 0, -0.3);
  limbPart(elbow, new THREE.CylinderGeometry(0.042, 0.035, 0.27, 10), skin, 0, -0.135, 0);
  limbPart(elbow, new THREE.SphereGeometry(0.045, 8, 6), skin, 0, -0.29, 0);
  return { shoulder, elbow };
});
player.position.set(fx(26), 0, 11.5);
const spawn = /[?&]at=(-?[\d.]+),(-?[\d.]+)/.exec(location.search);   // debug: ?at=feetX,feetZ starts you somewhere on the plan (add &y=0.9 when starting on the plinth)
if (spawn) player.position.set(fx(+spawn[1]), +((/[?&]y=([\d.]+)/.exec(location.search) || [0, 0])[1]), fz(+spawn[2]));
player.scale.setScalar(0.8);   // person size (about 1.5 m tall in game units)
scene.add(player);

// ---------- Input ----------
const keys = {};
addEventListener('keydown', (e) => (keys[e.code] = true));
addEventListener('keyup', (e) => (keys[e.code] = false));

// Mouse camera (like PUBG): click to lock the mouse, move it to look around, wheel to zoom, click again (or Esc) to release
const cam = { yaw: 0, pitch: 0.3, distance: 5 };
{ // debug: ?yaw=-90&dist=18&pitch=0.1 sets the camera (yaw in degrees)
  const q = (k) => { const m = new RegExp('[?&]' + k + '=(-?[0-9.]+)').exec(location.search); return m ? +m[1] : null; };
  if (q('yaw') !== null) cam.yaw = q('yaw') * Math.PI / 180;
  if (q('dist') !== null) cam.distance = q('dist');
  if (q('pitch') !== null) cam.pitch = q('pitch');
}
renderer.domElement.addEventListener('click', (e) => {
  if (e.pointerType === 'touch') return;   // touch has its own controls below
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  else renderer.domElement.requestPointerLock();
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  cam.yaw -= e.movementX * 0.003;
  cam.pitch = Math.max(-0.2, Math.min(1.5, cam.pitch + e.movementY * 0.003));
});
addEventListener('wheel', (e) => {
  cam.distance = Math.max(3, Math.min(70, cam.distance + e.deltaY * 0.02));
});

// Touch screen: drag one finger on the game to rotate the camera, pinch with two fingers to zoom
const canvasEl = renderer.domElement;
canvasEl.style.touchAction = 'none';
let lastTouch = null, lastPinch = 0;
const pinchDistance = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
canvasEl.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (e.touches.length === 1) lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.touches.length === 2) { lastTouch = null; lastPinch = pinchDistance(e.touches); }
}, { passive: false });
canvasEl.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length === 1 && lastTouch) {
    const t = e.touches[0];
    cam.yaw -= (t.clientX - lastTouch.x) * 0.006;
    cam.pitch = Math.max(-0.2, Math.min(1.5, cam.pitch + (t.clientY - lastTouch.y) * 0.006));
    lastTouch = { x: t.clientX, y: t.clientY };
  } else if (e.touches.length === 2) {
    const d = pinchDistance(e.touches);
    cam.distance = Math.max(3, Math.min(70, cam.distance - (d - lastPinch) * 0.06));
    lastPinch = d;
  }
}, { passive: false });
canvasEl.addEventListener('touchend', () => { lastTouch = null; });

// On-screen buttons (bottom right) press the same keys as the keyboard
const transparentSwitch = document.getElementById('transparentSwitch');

// "Room view" button: inside a room, the camera pulls back to show the whole room in 3D, with its ceiling slab drawn above it
const rooms = [   // plan coordinates in feet: x1, z1, x2, z2
  { name: 'Bath', x1: 13, z1: 0, x2: 17.7, z2: 9.3 },
  { name: 'WC', x1: 17.7, z1: 0, x2: 21.7, z2: 6.2 },
  { name: 'Bedroom 1', x1: 0, z1: 0, x2: 13, z2: 13.3 },
  { name: 'Bedroom 2', x1: 21.7, z1: 0, x2: 35, z2: 13.3 },
  { name: 'Stairs', x1: 0, z1: 13.3, x2: 13.2, z2: 19.8 },
  { name: 'Living hall', x1: 17.5, z1: 13.3, x2: 35, z2: 28 },
  { name: 'Kitchen', x1: 0, z1: 19.8, x2: 17.5, z2: 33 },
];
const roomBtn = document.getElementById('roomViewBtn');
let roomViewOn = false;
roomBtn.addEventListener('click', () => {
  roomViewOn = !roomViewOn;
  roomBtn.classList.toggle('on', roomViewOn);
});
const roomSlab = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.2, 1),
  new THREE.MeshStandardMaterial({ color: col(0xf4f4f2), roughness: 0.8, transparent: true, opacity: 0.4, depthWrite: false })
);
roomSlab.visible = false;
realScene.add(roomSlab);

// Ceilings: the underside of the slab, seen from below (one-sided, so from above you still look straight into the room).
// Without them the roof is hidden indoors and you would see the night sky instead of the slab.
const ceilMat = new THREE.MeshStandardMaterial({ color: col(0xf6f5f1), roughness: 0.9 });
// POP design (like the reference): a dropped border with a glowing cove, diamond grooves in the middle panel, and spot lights
const diamondTex = makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#e8ded0'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 800, 2, 0.015);
  const diamond = (ox, oy, color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(0, h / 2 + oy); ctx.lineTo(w / 2 + ox, 0); ctx.lineTo(w, h / 2 + oy);
    ctx.moveTo(0, h / 2 + oy); ctx.lineTo(w / 2 + ox, h); ctx.lineTo(w, h / 2 + oy); ctx.stroke();
  };
  diamond(0, 0, '#b9ad99', 5);      // groove
  diamond(0, 3, '#fbf7ee', 2);      // highlight on the lower lip of the groove
});
const popMat = textured(diamondTex, 1.3, 0.9);
const coveMat = new THREE.MeshBasicMaterial({ color: col(0xffd9a0), transparent: true, opacity: 0.9, side: THREE.DoubleSide });
const spotMat = new THREE.MeshBasicMaterial({ color: col(0xfff3d8) });
const flat = (w, d, mat, x, y, z) => {            // a rectangle facing downwards
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  realScene.add(m);
  return m;
};
function ceiling(x1, z1, x2, z2, y) {
  const w = (x2 - x1) * S, d = (z2 - z1) * S, cx = fx((x1 + x2) / 2), cz = fz((z1 + z2) / 2);
  const bw = Math.min(0.45, Math.min(w, d) * 0.18), drop = 0.14, cove = 0.1;   // border width, how far it drops, glow strip width
  // Middle panel with diamond grooves (UVs scaled so every diamond is about 1.3 m wide)
  const iw = w - 2 * bw, id = d - 2 * bw;
  const panel = flat(iw, id, popMat, cx, y, cz);
  const uv = panel.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * iw / 1.3, uv.getY(i) * id / 1.3);
  // Dropped border (four boxes) with a soft glow on the ceiling beside it, like cove lighting
  const band = (bwid, bdep, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bwid, drop, bdep), ceilMat);
    m.position.set(x, y - drop / 2, z);
    realScene.add(m);
  };
  band(w, bw, cx, cz - d / 2 + bw / 2); band(w, bw, cx, cz + d / 2 - bw / 2);
  band(bw, d - 2 * bw, cx - w / 2 + bw / 2, cz); band(bw, d - 2 * bw, cx + w / 2 - bw / 2, cz);
  flat(iw, cove, coveMat, cx, y - 0.004, cz - id / 2 + cove / 2); flat(iw, cove, coveMat, cx, y - 0.004, cz + id / 2 - cove / 2);
  flat(cove, id - 2 * cove, coveMat, cx - iw / 2 + cove / 2, y - 0.004, cz); flat(cove, id - 2 * cove, coveMat, cx + iw / 2 - cove / 2, y - 0.004, cz);
  // Recessed spot lights near the corners of the middle panel
  const sx = Math.max(0.2, iw / 2 - 0.45), sz = Math.max(0.2, id / 2 - 0.45);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), spotMat);
    s.rotation.x = Math.PI / 2;
    s.position.set(cx + a * sx, y - 0.008, cz + b * sz);
    realScene.add(s);
  });
}
const slabBottom = PLINTH + H - 0.2 - 0.005;
rooms.forEach((r) => ceiling(r.x1, r.z1, r.x2, r.z2, r.name === 'Stairs' ? PLINTH + TW.top - 0.005 : slabBottom));
ceiling(17.7, 6.2, 21.7, 13.3, slabBottom);   // passage areas between the rooms
ceiling(13, 9.3, 17.7, 13.3, slabBottom);
ceiling(13.2, 13.3, 17.5, 19.8, slabBottom);
const touchSwitch = document.getElementById('touchSwitch');
const touchPad = document.getElementById('touchPad');
touchSwitch.addEventListener('change', () => {
  touchPad.style.display = touchSwitch.checked ? 'grid' : 'none';
  if (!touchSwitch.checked) Object.keys(keys).forEach((k) => (keys[k] = false));
});
touchPad.querySelectorAll('button').forEach((btn) => {
  const press = (down) => (e) => { e.preventDefault(); keys[btn.dataset.key] = down; btn.classList.toggle('down', down); };
  btn.addEventListener('pointerdown', press(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => btn.addEventListener(ev, press(false)));
});

// ---------- Helpers ----------
const RADIUS = 0.22;
const WALK = 3.4, RUN = 6.2;   // metres per second

// Inside the walls of the main house, in plan coordinates (feet)
const inHouse = (xf, zf) =>
  (xf > 0 && xf < 35 && zf > 0 && zf < 28.6) || (xf > 0 && xf < 17.9 && zf > 0 && zf < 33.6);
const inStairs = (xf, zf) => xf > ST.x1 && xf < ST.x2 && zf > ST.z1 && zf < ST.z2;

// Height of the floor under (x, z). On the terrace only if we are already up there.
function groundHeight(x, z, currentY) {
  const xf = toFtX(x), zf = toFtZ(z);
  if (buildings.some((b) => b.rooms.some((r) => xf > r.x1 && xf < r.x2 && zf > r.z1 && zf < r.z2))) return 0.1;   // floor of a makeHouse() house
  if (inStairs(xf, zf)) return PLINTH + stairHeight(xf, zf, currentY - PLINTH);
  const onPorchTerrace = xf > 17.9 && xf < 35.1 && zf >= 28.6 && zf < 37.1;   // the terrace continues over the porch
  if (onPorchTerrace && currentY > ROOF_REACH + PLINTH) return H + PLINTH;
  if (inHouse(xf, zf)) return currentY > ROOF_REACH + PLINTH ? H + PLINTH : PLINTH + FLOOR_Y;
  if ((xf > 17.2 && xf < 35 && zf > 28.6 && zf < 37)) return PLINTH + 0.1;
  for (let i = 0; i < KITCHEN_STEPS.length; i++) {
    const [x1, x2, z1, z2] = KITCHEN_STEPS[i];
    if (xf > x1 && xf <= x2 && zf > z1 && zf < z2) return (PLINTH + 0.1) * (3 - i) / 4;
  }
  const P = PORCH_STEPS;
  if (xf > P.x1 && xf < P.x2 && zf >= P.z0 && zf < P.z0 + P.count * P.tread) {
    const j = Math.floor((zf - P.z0) / P.tread);
    return (PLINTH + 0.1) * (P.count - j) / (P.count + 1);
  }
  return 0;
}

// Push the player out of every obstacle whose height range they are standing in
function collide(pos) {
  for (const [cx, cz, w, d, bottom, top] of obstacles) {
    if (pos.y < bottom - 0.7 || pos.y >= top - 0.7) continue;
    const nx = Math.max(cx - w / 2, Math.min(pos.x, cx + w / 2));
    const nz = Math.max(cz - d / 2, Math.min(pos.z, cz + d / 2));
    const dx = pos.x - nx, dz = pos.z - nz;
    const dist = Math.hypot(dx, dz);
    if (dist < RADIUS) {
      if (dist === 0) { pos.z += RADIUS; continue; }
      pos.x += (dx / dist) * (RADIUS - dist);
      pos.z += (dz / dist) * (RADIUS - dist);
    }
  }
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && mapEl) mapEl.style.display = mapEl.style.display === 'none' ? 'block' : 'none';
});

// ---------- Coordinates readout (press P to copy the position) ----------
// Plan feet match the ground floor plan: x = 0 at the west wall, 35 at the east wall; z = 0 at the back wall, 37 at the porch edge.
const coordsEl = document.getElementById('coords');
const ROOMS = [
  ['Devghar', 32, 28, 35, 31.8], ['Porch steps', 21.5, 37, 31.5, 40.6], ['Porch', 17.2, 28.6, 35, 37],
  ['M+Bedroom-1', 0, 0, 13, 13.3], ['Bath+WC', 13, 0, 17.7, 9.3], ['WC', 17.7, 0, 21.7, 6.2], ['Bedroom-2', 21.7, 0, 35, 13.3],
  ['Lobby', 13, 6.2, 21.7, 13.3], ['Staircase / storeroom', 0, 13.3, 13.2, 19.8], ['Kitchen', 0, 19.8, 13, 33],
  ['Central passage', 13, 13.3, 17.5, 33], ['Living hall', 17.5, 13.3, 35, 28], ['Kitchen steps', -3.9, 19.3, 0, 24.2],
];
const roomAt = (xf, zf) => (ROOMS.find(([, x1, z1, x2, z2]) => xf >= x1 && xf <= x2 && zf >= z1 && zf <= z2) || ['Outside'])[0];
let lastCoords = '';
function showCoords(p) {
  const xf = toFtX(p.x), zf = toFtZ(p.z);
  const level = p.y > PLINTH + 3 ? 'terrace' : p.y > 0.2 ? 'on the plinth' : 'ground';
  lastCoords = `x: ${xf.toFixed(1)}, z: ${zf.toFixed(1)}`;
  if (coordsEl) coordsEl.textContent = `PLAN (feet)  x ${xf.toFixed(1)}   z ${zf.toFixed(1)}\nRoom: ${roomAt(xf, zf)} (${level})\nGAME (m)  x ${p.x.toFixed(2)}  y ${p.y.toFixed(2)}  z ${p.z.toFixed(2)}`;
}
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyP') return;
  if (navigator.clipboard) navigator.clipboard.writeText(lastCoords).catch(() => {});
  console.log('Position:', lastCoords);
});

// ---------- Minimap (press M to hide) ----------
const mapEl = document.getElementById('minimap');
function drawMap(p) {
  if (!mapEl || mapEl.style.display === 'none') return;
  const g = mapEl.getContext('2d'), sc = 5, ox = 24, oz = 12;
  g.clearRect(0, 0, mapEl.width, mapEl.height);
  g.fillStyle = 'rgba(8,12,22,0.55)';
  g.fillRect(0, 0, mapEl.width, mapEl.height);
  g.strokeStyle = '#e9e4d8'; g.lineWidth = 2; g.beginPath();
  planWalls.forEach(([horiz, c, a, b]) => {
    if (horiz) { g.moveTo(ox + a * sc, oz + c * sc); g.lineTo(ox + b * sc, oz + c * sc); }
    else { g.moveTo(ox + c * sc, oz + a * sc); g.lineTo(ox + c * sc, oz + b * sc); }
  });
  g.stroke();
  g.strokeStyle = '#9fb8c4'; g.lineWidth = 1; g.setLineDash([4, 3]);
  g.strokeRect(ox + 17.2 * sc, oz + 28.6 * sc, 17.8 * sc, 8.4 * sc);   // porch
  g.strokeRect(ox + 21.5 * sc, oz + 37 * sc, 10 * sc, 3.6 * sc);       // porch steps
  g.setLineDash([]);
  g.fillStyle = '#9fb8c4'; g.font = '10px sans-serif';
  g.fillText('N', mapEl.width - 14, 14);
  if (p.y > PLINTH + 3) g.fillText('TERRACE', 8, 14);
  const px = Math.max(5, Math.min(mapEl.width - 5, ox + toFtX(p.x) * sc));
  const py = Math.max(5, Math.min(mapEl.height - 5, oz + toFtZ(p.z) * sc));
  const s = Math.sin(player.rotation.y), c = Math.cos(player.rotation.y);
  g.fillStyle = '#ffcf5a';
  g.beginPath();
  g.moveTo(px + s * 8, py + c * 8);
  g.lineTo(px - s * 4 + c * 4, py - c * 4 - s * 4);
  g.lineTo(px - s * 4 - c * 4, py - c * 4 + s * 4);
  g.closePath(); g.fill();
}

// ---------- Game loop ----------
const clock = new THREE.Clock();
let walkTime = 0, elapsed = 0, facing = 0, lastStepSign = 1, fov = 60;
const vel = { x: 0, z: 0 };
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camWant = new THREE.Vector3(), camAim = new THREE.Vector3();
let camReady = false;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Is a point inside something solid and tall (a wall, a column)? Used so the camera does not poke through walls outdoors.
function blocked(x, y, z) {
  for (const [cx, cz, w, d, bottom, top] of obstacles) {
    if (top - bottom < 1.4) continue;
    if (y > bottom - 0.2 && y < top + 0.1 && Math.abs(x - cx) < w / 2 + 0.12 && Math.abs(z - cz) < d / 2 + 0.12) return true;
  }
  return false;
}

function update(dt) {
  elapsed += dt;
  const right = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const sprint = !!(keys.ShiftLeft || keys.ShiftRight);

  // Walk / sprint with acceleration, relative to where the camera looks
  let wantX = 0, wantZ = 0;
  if (right || forward) {
    const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
    const dx = right * cos - forward * sin, dz = -right * sin - forward * cos;
    const len = Math.hypot(dx, dz), top = sprint ? RUN : WALK;
    wantX = (dx / len) * top; wantZ = (dz / len) * top;
  }
  const ease = 1 - Math.exp(-(right || forward ? 9 : 13) * dt);
  vel.x += (wantX - vel.x) * ease;
  vel.z += (wantZ - vel.z) * ease;
  player.position.x += vel.x * dt;
  player.position.z += vel.z * dt;
  const speed = Math.hypot(vel.x, vel.z);

  // Turn smoothly to face the way we move
  if (speed > 0.4) {
    let diff = Math.atan2(vel.x, vel.z) - facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    facing += diff * (1 - Math.exp(-12 * dt));
    player.rotation.y = facing;
  }

  collide(player.position);

  // Stick to steps going up, fall down smoothly
  const p = player.position;
  const target = groundHeight(p.x, p.z, p.y);
  if (target > p.y) p.y = target;
  else p.y = Math.max(target, p.y - 12 * dt);

  // ----- Character animation: swinging arms and legs, bending knees and elbows, leaning into a run -----
  const move = clamp01(speed / 1.5), run = clamp01((speed - WALK) / (RUN - WALK));
  walkTime += dt * speed * 1.7;
  const swing = (0.3 + 0.35 * run) * move, t = walkTime;
  legs[0].hip.rotation.x = -Math.sin(t) * swing * 1.5;
  legs[1].hip.rotation.x = Math.sin(t) * swing * 1.5;
  legs[0].knee.rotation.x = Math.max(0, Math.cos(t)) * (0.5 + 0.7 * run) * move;
  legs[1].knee.rotation.x = Math.max(0, -Math.cos(t)) * (0.5 + 0.7 * run) * move;
  arms[0].shoulder.rotation.x = Math.sin(t) * swing * 1.3;
  arms[1].shoulder.rotation.x = -Math.sin(t) * swing * 1.3;
  arms[0].elbow.rotation.x = arms[1].elbow.rotation.x = -(0.12 + (0.25 + 0.9 * run) * move);
  body.rotation.x = 0.03 + run * 0.2 * move;
  body.rotation.y = Math.sin(t) * 0.12 * move;
  body.position.y = 0.95 + Math.abs(Math.cos(t)) * 0.03 * move + Math.sin(elapsed * 1.8) * 0.004;
  // Doors swing open when you get close
  doors.forEach((d) => {
    const near = Math.hypot(p.x - d.cx, p.z - d.cz) < 2.2 && Math.abs(p.y - (d.pivot.position.y + PLINTH)) < 1.5;   // same floor as the door
    const goal = near ? d.open : d.base;
    d.pivot.rotation.y += (goal - d.pivot.rotation.y) * Math.min(1, dt * 6);
  });

  // Inside the house: hide the roof and make the walls see-through
  const inside = inHouse(toFtX(p.x), toFtZ(p.z)) && p.y < H - 0.2 + PLINTH;
  // Top view (looking steeply down from far away): lift the roof off so the whole plan of the house is visible
  const topView = cam.pitch > 1.1 && cam.distance > 12;
  upper.visible = !inside && !topView;
  const xf = toFtX(p.x), zf = toFtZ(p.z);
  const room = inside ? rooms.find((r) => xf > r.x1 && xf < r.x2 && zf > r.z1 && zf < r.z2) : null;
  const roomView = roomViewOn && !!room;
  roomSlab.visible = roomView;
  buildings.forEach((b) => { b.roof.visible = !(p.y < b.wall - 0.4 && b.rooms.some((r) => xf > r.x1 && xf < r.x2 && zf > r.z1 && zf < r.z2)); });   // lift the roof off while you are inside
  if (roomView) {
    roomSlab.scale.set((room.x2 - room.x1) * S, 1, (room.z2 - room.z1) * S);
    roomSlab.position.set(fx((room.x1 + room.x2) / 2), PLINTH + H - 0.1, fz((room.z1 + room.z2) / 2));
  }
  const seeThrough = roomView || !transparentSwitch || transparentSwitch.checked;   // "Transparent" switch, top right
  wallMats.forEach((m) => (m.opacity = inside && seeThrough ? 0.3 : 1));
  glassMat.opacity = inside && seeThrough ? 0.12 : 0.95;

  // Little life in the scene
  diyaLight.intensity = 0.32 * (0.85 + 0.15 * Math.sin(elapsed * 9) * Math.sin(elapsed * 3.7) + rand(-0.04, 0.04));
  updateFireflies(elapsed);

  // ----- Camera: over-the-shoulder, smooth, pushed in by walls when outdoors, wider FOV while sprinting -----
  const headY = p.y + 1.1;
  const flat = Math.cos(cam.pitch) * cam.distance;
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), shoulder = 0.45;
  const lookX = p.x + rx * shoulder, lookZ = p.z + rz * shoulder;
  camWant.set(lookX + Math.sin(cam.yaw) * flat, headY + Math.sin(cam.pitch) * cam.distance, lookZ + Math.cos(cam.yaw) * flat);
  let aimX = lookX, aimY = headY, aimZ = lookZ;
  if (roomView) {
    // Look at the middle of the room from far enough back to see all of it
    const diag = Math.hypot(room.x2 - room.x1, room.z2 - room.z1) * S;
    const dist = diag * 0.85 + 2, pitch = Math.max(cam.pitch, 0.6), horiz = Math.cos(pitch) * dist;
    aimX = fx((room.x1 + room.x2) / 2); aimY = PLINTH + 1.2; aimZ = fz((room.z1 + room.z2) / 2);
    camWant.set(aimX + Math.sin(cam.yaw) * horiz, aimY + Math.sin(pitch) * dist, aimZ + Math.cos(cam.yaw) * horiz);
  }
  // The camera is stopped by walls outdoors, and also indoors when Transparent is off (solid walls)
  if ((!inside || !seeThrough) && !topView) {
    let free = 1;
    for (let k = 0.06; k <= 1; k += 0.04) {
      if (blocked(lookX + (camWant.x - lookX) * k, headY + (camWant.y - headY) * k, lookZ + (camWant.z - lookZ) * k)) { free = Math.max(0.12, k - 0.08); break; }
    }
    camWant.set(lookX + (camWant.x - lookX) * free, headY + (camWant.y - headY) * free, lookZ + (camWant.z - lookZ) * free);
  }
  camWant.y = Math.max(camWant.y, 0.4);   // never dip under the ground
  const follow = camReady ? 1 - Math.exp(-16 * dt) : 1;
  camPos.lerp(camWant, follow);
  camLook.lerp(camAim.set(aimX, aimY, aimZ), roomView ? 1 - Math.exp(-8 * dt) : follow);
  camReady = true;
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  const wantFov = sprint && move > 0.5 ? 68 : 60;
  if (Math.abs(fov - wantFov) > 0.02) {
    fov += (wantFov - fov) * (1 - Math.exp(-6 * dt));
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  sky.position.copy(camera.position);
  updateLamps(p);
  if (++mapFrame % 6 === 0) drawMap(p);   // the minimap does not need 60 updates per second
  showCoords(p);
}
let mapFrame = 0, frame = 0;

function loop() {
  requestAnimationFrame(loop);
  update(Math.min(clock.getDelta(), 0.03));   // small steps so thin walls cannot be skipped
  if (frame++ % 2 === 0) renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
}
loop();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
});
