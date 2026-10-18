// The player: a person with jointed limbs (hips, knees, shoulders, elbows), animated in main.js.
import { paint } from './core.js';

export const player = new THREE.Group();     // position and facing
export const body = new THREE.Group();       // everything above the hips: leans, twists and breathes
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
export const legs = [-0.1, 0.1].map((x) => {
  const hip = joint(player, x, 0.95);
  limbPart(hip, new THREE.CylinderGeometry(0.085, 0.07, 0.46, 10), jeans, 0, -0.23, 0);
  const knee = joint(hip, 0, -0.46);
  limbPart(knee, new THREE.CylinderGeometry(0.065, 0.055, 0.44, 10), jeans, 0, -0.22, 0);
  limbPart(knee, new THREE.BoxGeometry(0.11, 0.07, 0.25), shoeMat, 0, -0.45, 0.05);
  return { hip, knee };
});
export const arms = [-0.27, 0.27].map((x) => {
  const shoulder = joint(body, x, 0.55);
  limbPart(shoulder, new THREE.SphereGeometry(0.065, 10, 8), shirt, 0, 0, 0);
  limbPart(shoulder, new THREE.CylinderGeometry(0.05, 0.045, 0.3, 10), shirt, 0, -0.15, 0);
  const elbow = joint(shoulder, 0, -0.3);
  limbPart(elbow, new THREE.CylinderGeometry(0.042, 0.035, 0.27, 10), skin, 0, -0.135, 0);
  limbPart(elbow, new THREE.SphereGeometry(0.045, 8, 6), skin, 0, -0.29, 0);
  return { shoulder, elbow };
});
player.scale.setScalar(0.8);   // person size (about 1.5 m tall in game units)
