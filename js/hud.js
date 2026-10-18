// HUD: the coordinates readout (press P to copy the position) and the minimap (press M to hide).
// Plan feet match the floor plan: x = 0 at the west wall, z = 0 at the back wall.
import { PLINTH, planWalls, toFtX, toFtZ } from './core.js';

const coordsEl = document.getElementById('coords');
const mapEl = document.getElementById('minimap');
let zones = [], outlines = [], lastCoords = '';

// zones: [[name, x1, z1, x2, z2]...] named areas for the readout (first match wins);
// outlines: [[x1, z1, x2, z2]...] dashed areas on the minimap (porch, steps)
export function setupHud(house) {
  zones = house.zones || [];
  outlines = house.mapOutlines || [];
}
const roomAt = (xf, zf) => (zones.find(([, x1, z1, x2, z2]) => xf >= x1 && xf <= x2 && zf >= z1 && zf <= z2) || ['Outside'])[0];

export function showCoords(p) {
  const xf = toFtX(p.x), zf = toFtZ(p.z);
  const level = p.y > PLINTH + 3 ? 'terrace' : p.y > 0.2 ? 'on the plinth' : 'ground';
  lastCoords = `x: ${xf.toFixed(1)}, z: ${zf.toFixed(1)}`;
  if (coordsEl) coordsEl.textContent = `PLAN (feet)  x ${xf.toFixed(1)}   z ${zf.toFixed(1)}\nRoom: ${roomAt(xf, zf)} (${level})\nGAME (m)  x ${p.x.toFixed(2)}  y ${p.y.toFixed(2)}  z ${p.z.toFixed(2)}`;
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') {
    if (navigator.clipboard) navigator.clipboard.writeText(lastCoords).catch(() => {});
    console.log('Position:', lastCoords);
  }
  if (e.code === 'KeyM' && mapEl) mapEl.style.display = mapEl.style.display === 'none' ? 'block' : 'none';
});

export function drawMap(p, facing) {
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
  outlines.forEach(([x1, z1, x2, z2]) => g.strokeRect(ox + x1 * sc, oz + z1 * sc, (x2 - x1) * sc, (z2 - z1) * sc));
  g.setLineDash([]);
  g.fillStyle = '#9fb8c4'; g.font = '10px sans-serif';
  g.fillText('N', mapEl.width - 14, 14);
  if (p.y > PLINTH + 3) g.fillText('TERRACE', 8, 14);
  const px = Math.max(5, Math.min(mapEl.width - 5, ox + toFtX(p.x) * sc));
  const py = Math.max(5, Math.min(mapEl.height - 5, oz + toFtZ(p.z) * sc));
  const s = Math.sin(facing), c = Math.cos(facing);
  g.fillStyle = '#ffcf5a';
  g.beginPath();
  g.moveTo(px + s * 8, py + c * 8);
  g.lineTo(px - s * 4 + c * 4, py - c * 4 - s * 4);
  g.lineTo(px - s * 4 - c * 4, py - c * 4 + s * 4);
  g.closePath(); g.fill();
}
