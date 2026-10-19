// Laser pointer in the avatar's hand (eye view only, always visible while the Laser switch is on): a red beam from the right hand to whatever it points at, with a dot
// and a label showing that spot on the plan (feet) and its height above the plinth top (m). The hand is moved with
// I / J / K / L (up / left / down / right), H puts it back in the middle, or with the small round pad on touch screens.
import { realScene, camera, sky, PLINTH, toFtX, toFtZ } from './core.js';
import { view, query, laserSwitch } from './controls.js';
import { setLaserText } from './hud.js';

const hand = { x: 0, y: 0 };   // where the beam points on the screen, -1..1 from the middle (starts at the crosshair)
const pad = { x: 0, y: 0, id: null };
const keyDown = {};
addEventListener('keydown', (e) => {
  keyDown[e.code] = true;
  if (e.code === 'KeyH') { hand.x = hand.y = 0; }
});
addEventListener('keyup', (e) => (keyDown[e.code] = false));
addEventListener('blur', () => Object.keys(keyDown).forEach((k) => (keyDown[k] = false)));

// ----- the small round pad that moves the hand (touch screens, shown only in eye view) -----
const touchSwitch = document.getElementById('touchSwitch');
const padEl = document.getElementById('handPad'), padKnob = document.getElementById('handKnob');
function padMove(e) {
  const r = padEl.getBoundingClientRect(), radius = r.width / 2, max = radius * 0.7;
  let dx = e.clientX - (r.left + radius), dy = e.clientY - (r.top + radius);
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  padKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  pad.x = dx / max; pad.y = -dy / max;
}
function padReset() { pad.x = pad.y = 0; pad.id = null; padKnob.style.transform = 'translate(0px, 0px)'; }
['contextmenu', 'selectstart', 'dragstart', 'touchstart', 'touchmove'].forEach((ev) => padEl.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
padEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (pad.id !== null) return;
  pad.id = e.pointerId;
  try { padEl.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  padMove(e);
});
padEl.addEventListener('pointermove', (e) => { if (e.pointerId === pad.id) { e.preventDefault(); padMove(e); } });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => padEl.addEventListener(ev, (e) => { if (e.pointerId === pad.id) padReset(); }));
padEl.addEventListener('dblclick', () => { hand.x = hand.y = 0; });   // double tap the pad: hand back to the middle

// ----- the beam, the pen in the hand and the dot -----
const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a, depthTest: false, transparent: true, opacity: 0.9 });
const group = new THREE.Group();
group.renderOrder = 999;
const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), red);   // unit cylinder, stretched to the hit point
const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), red);
const pen = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.16), new THREE.MeshBasicMaterial({ color: 0x222428, depthTest: false }));
[beam, dot, pen].forEach((m) => { m.renderOrder = 999; m.frustumCulled = false; group.add(m); });
group.visible = false;
realScene.add(group);

const raycaster = new THREE.Raycaster();
const forward = new THREE.Vector3(0, 0, 1), origin = new THREE.Vector3(), target = new THREE.Vector3(), dir = new THREE.Vector3(), mid = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const screen = new THREE.Vector2();
let frameNo = 0, hit = null;   // the laser stays visible in eye view for as long as the Laser switch is on

const label = document.createElement('div');
label.id = 'laserLabel';
label.style.display = 'none';
document.body.appendChild(label);

// Is the mesh really there to be seen (it and everything above it are visible), and not the sky?
function solid(o) {
  for (let n = o; n; n = n.parent) if (!n.visible || n === sky) return false;
  return true;
}

export function updateLaser(dt) {
  const on = view.eye && laserSwitch.checked;
  padEl.style.display = on && touchSwitch.checked ? 'grid' : 'none';   // the pad is always there in eye view; the laser is not
  if (!on) { group.visible = false; label.style.display = 'none'; setLaserText(''); return; }
  group.visible = true;

  // Move the hand: keys and the pad
  const sp = 1.1 * dt;
  hand.x += ((keyDown.KeyL ? 1 : 0) - (keyDown.KeyJ ? 1 : 0) + pad.x) * sp;
  hand.y += ((keyDown.KeyI ? 1 : 0) - (keyDown.KeyK ? 1 : 0) + pad.y) * sp;
  hand.x = Math.max(-0.95, Math.min(0.95, hand.x));
  hand.y = Math.max(-0.95, Math.min(0.95, hand.y));

  // Where does the ray through the hand's screen point first hit something? (every second frame is plenty)
  camera.updateMatrixWorld(true);
  if (frameNo++ % 2 === 0) {
    group.visible = false;
    screen.set(hand.x, hand.y);
    raycaster.setFromCamera(screen, camera);
    raycaster.far = 80;
    hit = raycaster.intersectObjects(realScene.children, true).find((h) => h.object.isMesh && solid(h.object)) || null;
    group.visible = true;
  }
  origin.set(0.22, -0.22, -0.4).applyMatrix4(camera.matrixWorld);   // the right hand, low in the view
  if (hit) target.copy(hit.point);
  else { raycaster.setFromCamera(screen.set(hand.x, hand.y), camera); target.copy(raycaster.ray.at(40, target)); }
  dir.subVectors(target, origin);
  const len = dir.length();
  dir.normalize();
  mid.addVectors(origin, target).multiplyScalar(0.5);
  beam.position.copy(mid);
  beam.quaternion.setFromUnitVectors(up, dir);
  beam.scale.set(0.004, len, 0.004);
  pen.position.copy(origin).addScaledVector(dir, 0.06);
  pen.quaternion.setFromUnitVectors(forward, dir);
  dot.visible = !!hit;
  dot.position.copy(target);
  const ds = Math.max(0.018, camera.position.distanceTo(target) * 0.006);   // stays visible far away
  dot.scale.set(ds, ds, ds);

  // The reading, in plan feet like house.json: x west -> east, z north -> south, height in m above the plinth top
  if (hit) {
    const xf = toFtX(target.x), zf = toFtZ(target.z), up_ = target.y - PLINTH;
    const text = `x ${xf.toFixed(1)}   z ${zf.toFixed(1)} ft\nup ${up_.toFixed(2)} m`;
    setLaserText(`LASER (feet)  x ${xf.toFixed(1)}   z ${zf.toFixed(1)}   up ${up_.toFixed(2)} m`);
    label.textContent = text;
    const p = target.clone().project(camera);
    label.style.left = `${(p.x * 0.5 + 0.5) * innerWidth + 14}px`;
    label.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - 40}px`;
    label.style.display = p.z < 1 ? 'block' : 'none';
  } else {
    setLaserText('LASER: pointing at the sky');
    label.style.display = 'none';
  }
}

if (query('laser') === '0') laserSwitch.checked = false;   // debug: ?laser=0 starts with the laser off
