// Entry point: load the house JSON (house.json, or ?house=other.json), build it, then run the game loop.
import {
  realScene, camera, renderer, sky, H, PLINTH, FLOOR_Y, ROOF_REACH, S, fx, fz, toFtX, toFtZ, rand, box, textured, makeTexture,
  obstacles, doors, wallMats, glassMat, ghostMats, ghost, updateLamps, updaters, walkables, col,
} from './core.js';
import { buildHouse } from './house.js';
import { buildCeilings, ceilingG } from './ceilings.js';
import { buildServices } from './services.js';
import { makeHouse, buildings } from './makeHouse.js';
import { player, body, legs, arms } from './player.js';
import { keys, cam, joy, query, transparentSwitch, servicesSwitch, view, buildLegend } from './controls.js';
import { setupHud, showCoords, drawMap } from './hud.js';

// ---------- Load the house ----------
const houseUrl = query('house') || 'house.json';
let data;
try {
  const res = await fetch(houseUrl, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  data = await res.json();
} catch (err) {
  document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:40px;color:#fff;background:#300c;padding:16px;white-space:pre-wrap">Could not load ${houseUrl}: ${err.message}\n\nOpen the game through a local web server (for example: npx http-server), not as a file.</pre>`);
  throw err;
}

// ---------- Ground ----------
const grassTex = makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#1d3b20'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 14000; i++) {
    ctx.strokeStyle = `rgb(${rand(20, 50)},${rand(60, 110)},${rand(20, 45)})`;
    const x = Math.random() * w, y = Math.random() * h;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand(-2, 2), y - rand(2, 6)); ctx.stroke();
  }
});
box([240, 0.2, 240], [0, -0.1, 0], 0, realScene, ghost(textured(grassTex, 3, 0.95, 0.5)));

// ---------- The house, its ceilings and services, and any simple neighbour houses ----------
const house = buildHouse(data);
const { upper, rooms } = house;
buildCeilings(rooms, data.extraCeilings);
const services = buildServices(data.services || {}, house.houseG);
const legendEl = buildLegend(services.layers);
(data.otherHouses || []).forEach(makeHouse);
setupHud(data);

const inRects = (list, xf, zf) => (list || []).some(([x1, z1, x2, z2]) => xf > x1 && xf < x2 && zf > z1 && zf < z2);
// Inside the walls of the main house, in plan coordinates (feet)
const inHouse = (xf, zf) => inRects(data.footprint, xf, zf);

// Room view: a see-through slab drawn over the room you are in
const roomSlab = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.2, 1),
  new THREE.MeshStandardMaterial({ color: col(0xf4f4f2), roughness: 0.8, transparent: true, opacity: 0.4, depthWrite: false })
);
roomSlab.visible = false;
realScene.add(roomSlab);

// ---------- Player ----------
const spawn = data.spawn || { at: [26, 43.75] };
player.position.set(fx(spawn.at[0]), spawn.y ?? 0, fz(spawn.at[1]));
if (query('at')) {   // debug: ?at=feetX,feetZ starts you somewhere on the plan (add &y=0.9 when starting on the plinth)
  const [ax, az] = query('at').split(',').map(Number);
  player.position.set(fx(ax), +(query('y') || 0), fz(az));
}
realScene.add(player);

// ---------- Movement helpers ----------
const RADIUS = 0.22;
const WALK = 3.4, RUN = 6.2;   // metres per second

// Height of the floor under (x, z). On the terrace only if we are already up there.
function groundHeight(x, z, currentY) {
  const xf = toFtX(x), zf = toFtZ(z);
  if (buildings.some((b) => b.rooms.some((r) => xf > r.x1 && xf < r.x2 && zf > r.z1 && zf < r.z2))) return 0.1;   // floor of a makeHouse() house
  const walk = (first) => {
    for (const w of walkables) if (!!w.first === first) { const h = w(xf, zf, currentY); if (h !== null) return h; }
    return null;
  };
  const early = walk(true);   // the staircase comes before everything else
  if (early !== null) return early;
  const high = currentY > ROOF_REACH + PLINTH;
  if (inRects(data.terraceExtra, xf, zf) && high) return H + PLINTH;   // terrace over the porch
  if (inHouse(xf, zf)) return high ? H + PLINTH : PLINTH + FLOOR_Y;
  if (inRects(data.decks, xf, zf)) return PLINTH + 0.1;
  const late = walk(false);
  return late !== null ? late : 0;
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

// Is a point inside something solid and tall (a wall, a column)? Used so the camera does not poke through walls outdoors.
function blocked(x, y, z) {
  for (const [cx, cz, w, d, bottom, top] of obstacles) {
    if (top - bottom < 1.4) continue;
    if (y > bottom - 0.2 && y < top + 0.1 && Math.abs(x - cx) < w / 2 + 0.12 && Math.abs(z - cz) < d / 2 + 0.12) return true;
  }
  return false;
}

// ---------- Game loop ----------
const clock = new THREE.Clock();
let walkTime = 0, elapsed = 0, facing = 0, fov = 60, xrayWas = false, mapFrame = 0, frame = 0;
const vel = { x: 0, z: 0 };
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camWant = new THREE.Vector3(), camAim = new THREE.Vector3();
let camReady = false;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function update(dt) {
  elapsed += dt;
  const clampAxis = (v) => Math.max(-1, Math.min(1, v));
  const right = clampAxis((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x);
  const forward = clampAxis((keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y);
  const stick = Math.hypot(joy.x, joy.y);
  const sprint = !!(keys.ShiftLeft || keys.ShiftRight) || stick > 0.9;   // push the joystick to the edge to run

  // Walk / sprint with acceleration, relative to where the camera looks. The joystick gives analog speed.
  let wantX = 0, wantZ = 0;
  if (right || forward) {
    const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
    const dx = right * cos - forward * sin, dz = -right * sin - forward * cos;
    const len = Math.hypot(dx, dz), top = (sprint ? RUN : WALK) * Math.min(1, Math.hypot(right, forward));
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
  const xf = toFtX(p.x), zf = toFtZ(p.z);
  const inside = inHouse(xf, zf) && p.y < H - 0.2 + PLINTH;
  // Top view (looking steeply down from far away): lift the roof off so the whole plan of the house is visible
  const topView = cam.pitch > 1.1 && cam.distance > 12;
  // Services (X-ray): roof and ceilings off, floors and ground turn to a ghost, pipes and wiring appear
  const xray = servicesSwitch.checked;
  if (xray !== xrayWas) {
    xrayWas = xray;
    services.group.visible = xray;
    ceilingG.visible = !xray;
    legendEl.style.display = xray ? 'block' : 'none';
    ghostMats.forEach((m) => { m.transparent = xray; m.opacity = xray ? 0.25 : 1; m.depthWrite = !xray; m.needsUpdate = true; });
  }
  upper.visible = !inside && !topView && !xray;
  const room = inside ? rooms.find((r) => xf > r.x1 && xf < r.x2 && zf > r.z1 && zf < r.z2) : null;
  const roomView = view.room && !!room;
  roomSlab.visible = roomView;
  buildings.forEach((b) => { b.roof.visible = !(p.y < b.wall - 0.4 && b.rooms.some((r) => xf > r.x1 && xf < r.x2 && zf > r.z1 && zf < r.z2)); });   // lift the roof off while you are inside
  if (roomView) {
    roomSlab.scale.set((room.x2 - room.x1) * S, 1, (room.z2 - room.z1) * S);
    roomSlab.position.set(fx((room.x1 + room.x2) / 2), PLINTH + H - 0.1, fz((room.z1 + room.z2) / 2));
  }
  const seeThrough = roomView || !transparentSwitch || transparentSwitch.checked;   // "Transparent" switch, top right
  wallMats.forEach((m) => (m.opacity = xray ? 0.12 : inside && seeThrough ? 0.3 : 1));
  glassMat.opacity = xray ? 0.06 : inside && seeThrough ? 0.12 : 0.95;

  // Little life in the scene (fireflies, flickering lamps...)
  updaters.forEach((fn) => fn(elapsed, dt));

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
  if ((!inside || !seeThrough) && !topView && !xray) {
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
  if (++mapFrame % 6 === 0) drawMap(p, player.rotation.y);   // the minimap does not need 60 updates per second
  showCoords(p);
}

function loop() {
  requestAnimationFrame(loop);
  update(Math.min(clock.getDelta(), 0.03));   // small steps so thin walls cannot be skipped
  if (frame++ % 2 === 0) renderer.shadowMap.needsUpdate = true;
  renderer.render(realScene, camera);
}
loop();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
