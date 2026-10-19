// Switchboard details: hover a switchboard (or tap it on a touch screen) to see a small card with what is on it:
// how many switches and what they run, fan regulator (roller), sockets, indicator lamps... from "room" and "items" on each
// entry of services.electrical.switchboards in house.json. While the mouse is locked for looking around, the board in the
// middle of the screen is used instead of the one under the pointer.
const NEAR = 4;   // metres: only boards this close to the camera, so ones far away or through a wall do not pop up

export function setupBoardInfo(boards, camera, canvas) {
  if (!boards.length) return;
  const card = document.createElement('div');
  card.id = 'boardInfo';
  card.hidden = true;
  document.body.appendChild(card);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  ray.far = NEAR;
  let shown = null, hideTimer = 0;

  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const render = (info) => {
    const rows = info.items.map((it) => `<li><b>${it.count ?? 1} &times;</b> ${esc(it.name)}${it.for ? `<small>${esc(it.for)}</small>` : ''}</li>`).join('');
    const total = info.items.reduce((n, it) => n + (it.count ?? 1), 0);
    card.innerHTML = `<h4>Switchboard &middot; ${esc(info.room)}</h4><ul>${rows || '<li>No details yet</li>'}</ul><p>${total} items on the board</p>`;
  };
  // Board under a screen point (client pixels), or null
  const pick = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(boards, false)[0];
    return hit ? hit.object.userData.board : null;
  };
  const show = (info, cx, cy) => {
    if (info !== shown) { render(info); shown = info; }
    card.hidden = false;
    // Next to the pointer, kept on screen
    const w = card.offsetWidth, h = card.offsetHeight;
    card.style.left = Math.min(innerWidth - w - 8, cx + 16) + 'px';
    card.style.top = Math.max(8, Math.min(innerHeight - h - 8, cy - h / 2)) + 'px';
  };
  const hide = () => { card.hidden = true; shown = null; };

  addEventListener('mousemove', (e) => {
    const locked = document.pointerLockElement === canvas;
    const cx = locked ? innerWidth / 2 : e.clientX, cy = locked ? innerHeight / 2 : e.clientY;
    if (!locked && e.target !== canvas) return hide();
    const info = pick(cx, cy);
    if (info) show(info, cx, cy); else hide();
  });
  // Touch: a quick tap on a board shows its card for a few seconds
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || !down) return;
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 400;
    down = null;
    if (!tap) return;
    const info = pick(e.clientX, e.clientY);
    clearTimeout(hideTimer);
    if (info) { show(info, e.clientX, e.clientY); hideTimer = setTimeout(hide, 4000); } else hide();
  });
}
