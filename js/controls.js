// Input: keyboard, mouse camera (pointer lock), touch drag / pinch, the on-screen joystick and the top-right switches.
import { renderer } from './core.js';

export const keys = {};
addEventListener('keydown', (e) => (keys[e.code] = true));
addEventListener('keyup', (e) => (keys[e.code] = false));

// Debug URL options: ?yaw=-90&dist=18&pitch=0.1 sets the camera (yaw in degrees)
export const query = (k) => { const m = new RegExp('[?&]' + k + '=([^&]+)').exec(location.search); return m ? decodeURIComponent(m[1]) : null; };

// Mouse camera (like PUBG): click to lock the mouse, move it to look around, wheel to zoom, click again (or Esc) to release
export const cam = { yaw: 0, pitch: 0.3, distance: 5 };
if (query('yaw') !== null) cam.yaw = +query('yaw') * Math.PI / 180;
if (query('dist') !== null) cam.distance = +query('dist');
if (query('pitch') !== null) cam.pitch = +query('pitch');
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

// ---------- Settings (gear, top right): opens the panel with all the switches ----------
const settingsBtn = document.getElementById('settingsBtn'), settingsPanel = document.getElementById('settingsPanel');
const openSettings = (open) => {
  settingsPanel.hidden = !open;
  settingsBtn.classList.toggle('open', open);
  settingsBtn.setAttribute('aria-expanded', open);
};
settingsBtn.addEventListener('click', () => openSettings(settingsPanel.hidden));
if (query('settings') === '1') openSettings(true);   // debug: ?settings=1 starts with the panel open
// Close it when clicking anywhere else, or with Esc
addEventListener('pointerdown', (e) => { if (!settingsPanel.hidden && !e.target.closest('#settings')) openSettings(false); });
addEventListener('keydown', (e) => { if (e.code === 'Escape') openSettings(false); });

// ---------- Switches (inside the settings panel) ----------
export const transparentSwitch = document.getElementById('transparentSwitch');
export const servicesSwitch = document.getElementById('servicesSwitch');
if (query('xray') === '1') servicesSwitch.checked = true;   // debug: ?xray=1 starts with Services on
addEventListener('keydown', (e) => { if (e.code === 'KeyX') servicesSwitch.checked = !servicesSwitch.checked; });
export const devicesSwitch = document.getElementById('devicesSwitch');
if (query('devices') === '1') devicesSwitch.checked = true;   // debug: ?devices=1 starts with the devices shown
addEventListener('keydown', (e) => { if (e.code === 'KeyE') devicesSwitch.checked = !devicesSwitch.checked; });
export const furnitureSwitch = document.getElementById('furnitureSwitch');
if (query('furniture') === '0') furnitureSwitch.checked = false;   // debug: ?furniture=0 starts with the rooms empty
addEventListener('keydown', (e) => { if (e.code === 'KeyF') furnitureSwitch.checked = !furnitureSwitch.checked; });
// "Room view" button: inside a room, the camera pulls back to show the whole room in 3D, with its ceiling slab drawn above it
export const view = { room: false };
const roomBtn = document.getElementById('roomViewBtn');
roomBtn.addEventListener('click', () => {
  view.room = !view.room;
  roomBtn.classList.toggle('on', view.room);
});

// ---------- Virtual joystick (touch) ----------
// Press the round pad and drag in the direction you want to walk; push to the edge to run.
// Direction and strength follow the thumb, and everything resets the moment the finger lifts or the browser takes the touch away.
export const joy = { x: 0, y: 0, id: null };   // x: right(+)/left(-), y: forward(+)/back(-), both in -1..1
const touchSwitch = document.getElementById('touchSwitch');
const touchPad = document.getElementById('touchPad');
const joyBase = document.getElementById('joyBase'), joyKnob = document.getElementById('joyKnob');
function joyReset() {
  joy.x = joy.y = 0; joy.id = null;
  joyKnob.style.transform = 'translate(0px, 0px)';
  joyBase.classList.remove('active');
}
touchSwitch.addEventListener('change', () => {
  touchPad.style.display = touchSwitch.checked ? 'grid' : 'none';
  if (!touchSwitch.checked) { Object.keys(keys).forEach((k) => (keys[k] = false)); joyReset(); }
});
touchPad.style.display = touchSwitch.checked ? 'grid' : 'none';   // touch mode is on by default
function joyMove(e) {
  const r = joyBase.getBoundingClientRect();
  const radius = r.width / 2;
  let dx = e.clientX - (r.left + radius), dy = e.clientY - (r.top + radius);
  const len = Math.hypot(dx, dy), max = radius * 0.8;
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  const dead = 0.12;   // tiny movements near the centre are ignored
  const nx = dx / max, ny = -dy / max, mag = Math.hypot(nx, ny);
  if (mag < dead) { joy.x = joy.y = 0; return; }
  const scale = (mag - dead) / (1 - dead) / mag;
  joy.x = nx * scale; joy.y = ny * scale;
}
['contextmenu', 'selectstart', 'dragstart', 'touchstart', 'touchmove'].forEach((ev) => joyBase.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
joyBase.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (joy.id !== null) return;
  joy.id = e.pointerId;
  try { joyBase.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  joyBase.classList.add('active');
  joyMove(e);
});
joyBase.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) { e.preventDefault(); joyMove(e); } });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => joyBase.addEventListener(ev, (e) => { if (e.pointerId === joy.id) joyReset(); }));
// Safety nets: all fingers lifted, page hidden or focus lost
addEventListener('touchend', (e) => { if (e.touches.length === 0) joyReset(); });
addEventListener('touchcancel', joyReset);
addEventListener('blur', joyReset);
document.addEventListener('visibilitychange', joyReset);

// Legend for the Services layers: one checkbox per layer
export function buildLegend(layers) {
  const legendEl = document.getElementById('legend');
  Object.values(layers).forEach((l) => {
    const row = document.createElement('label');
    row.innerHTML = `<input type="checkbox" checked><i style="background:#${new THREE.Color(l.color).getHexString()}"></i>${l.name}`;
    row.firstChild.addEventListener('change', (e) => (l.group.visible = e.target.checked));
    legendEl.appendChild(row);
  });
  return legendEl;
}
