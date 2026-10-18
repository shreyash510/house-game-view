// Outdoor components (ground level): road with pavement and street lamps, hedges, fireflies.
import { scene, box, glow, obstacle, textured, tileTex, makeTexture, speckle, paint, glowTex, ghostMats, updaters, fx, fz, S, rand } from '../core.js';

// ---------- Road: asphalt with lane dashes, a pavement and street lamps, running along x ----------
// { "z": road centre line, "width", "pavement": { "z", "width" }, "lamps": { "x": [...], "z" } } (feet)
const asphaltTex = () => makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#26262b'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 14000, 2, 0.12);
});
export function road(c) {
  const roadMat = textured(asphaltTex(), 3, 0.85, 1.0), paveMat = textured(tileTex('#a3a29d'), 1.2, 0.8, 1.0);
  ghostMats.push(roadMat, paveMat);
  if (c.pavement) box([240, 0.1, c.pavement.width * S], [0, 0.05, fz(c.pavement.z)], 0, scene, paveMat);
  box([240, 0.06, c.width * S], [0, 0.03, fz(c.z)], 0, scene, roadMat);
  for (let x = -50; x <= 50; x += 6) box([2.5, 0.07, 0.18], [x, 0.04, fz(c.z)], 0xe8e8e8);
  // Street lamps: warm head, light pool on the ground (a cheap glow instead of a real light)
  (c.lamps?.x || []).forEach((xf) => {
    const x = fx(xf), z = fz(c.lamps.z);
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
}

// ---------- Hedge with a rounded top made of overlapping bushes: { "rect": [x1, z1, x2, z2] } ----------
const leafTex = () => makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#1f4a22'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgb(${rand(25, 60)},${rand(70, 125)},${rand(25, 55)})`;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, rand(1.5, 4), 0, 7); ctx.fill();
  }
});
let hedgeMat;
export function hedge(c) {
  hedgeMat ||= textured(leafTex(), 0.8, 1);
  const [x1, z1, x2, z2] = c.rect, cx = fx((x1 + x2) / 2), cz = fz((z1 + z2) / 2), w = (x2 - x1) * S, d = (z2 - z1) * S;
  box([w, 0.9, d], [cx, 0.45, cz], 0, scene, hedgeMat);
  for (let x = -w / 2 + 0.3; x <= w / 2 - 0.2; x += 0.5) {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), hedgeMat);
    bush.scale.set(1, 0.7, Math.max(d, 0.6) * 1.1);
    bush.position.set(cx + x, 0.9, cz);
    bush.castShadow = true;
    scene.add(bush);
  }
  obstacle(cx, cz, w, d, 0, 0.9);
}

// ---------- Fireflies drifting over the garden: { "count" } ----------
export function fireflies(c) {
  const FLY = c.count ?? 60;
  const flyBase = Array.from({ length: FLY }, () => [rand(-25, 25), rand(0.4, 2.2), Math.random() < 0.6 ? rand(9.8, 14) : rand(-14, -8), rand(0, 6.28), rand(0.4, 1.0)]);
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLY * 3), 3));
  const dotTex = makeTexture(32, 32, (ctx) => { const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); }, false);
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ map: dotTex, color: 0xc8ff7a, size: 0.22, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flies.frustumCulled = false;
  scene.add(flies);
  updaters.push((t) => {
    const pos = flyGeo.attributes.position;
    flyBase.forEach(([x, y, z, ph, sp], i) => {
      pos.setXYZ(i, x + Math.sin(t * 0.3 * sp + ph) * 1.5, y + Math.sin(t * 0.7 * sp + ph * 2) * 0.35, z + Math.cos(t * 0.25 * sp + ph) * 1.5);
    });
    pos.needsUpdate = true;
  });
}
