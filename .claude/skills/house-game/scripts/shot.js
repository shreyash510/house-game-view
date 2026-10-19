// Take a screenshot of the game from a chosen spot, without opening a browser window.
// Starts a tiny web server for the game folder, runs headless Edge (or Chrome) on it, saves a PNG, then stops.
//
//   node .claude/skills/house-game/scripts/shot.js <out.png> "<url options>" [width] [height]
//
// Examples (url options are the game's debug options, see README "Debug URL options"):
//   node .claude/skills/house-game/scripts/shot.js front.png "at=7,41&yaw=0&dist=7&pitch=0.12"
//   node .claude/skills/house-game/scripts/shot.js stairs.png "at=15.5,16.5&y=0.9&yaw=90&dist=3&pitch=0.1" 800 800
//   node .claude/skills/house-game/scripts/shot.js xray.png "at=10,16&y=0.9&dist=14&pitch=1.25&xray=1"
//
// Camera: yaw is the direction the camera sits FROM the player (degrees): 0 = camera south of the player looking north,
// 90 = camera east looking west, -90 = camera west looking east, 180 = camera north looking south.
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');

const [out, query = '', width = '1000', height = '700'] = process.argv.slice(2);
if (!out) { console.error('usage: node shot.js <out.png> "<url options>" [width] [height]'); process.exit(1); }
const root = path.resolve(__dirname, '../../../..');   // the game folder (this file is in .claude/skills/house-game/scripts)
const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));
if (!browser) { console.error('No Edge or Chrome found'); process.exit(1); }

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
server.listen(0, () => {   // any free port, so it never clashes with a server you already have running
  const url = `http://localhost:${server.address().port}/index.html?${query}`;
  const args = ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${width},${height}`,
    '--virtual-time-budget=10000', `--screenshot=${path.resolve(out)}`, url];
  const file = path.resolve(out);
  try { fs.unlinkSync(file); } catch (e) { /* no old screenshot */ }
  // Headless Edge often keeps running after it has written the screenshot, so watch for the file and stop it then
  const proc = spawn(browser, args, { stdio: 'ignore' });
  const started = Date.now();
  let lastSize = -1;
  const done = (ok) => {
    clearInterval(timer);
    try { proc.kill(); } catch (e) { /* already gone */ }
    server.close();
    if (ok) console.log('saved', file); else console.error('Screenshot failed (no image after 90 s)');
    process.exit(ok ? 0 : 1);
  };
  const timer = setInterval(() => {
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (size > 0 && size === lastSize) return done(true);   // written and no longer growing
    lastSize = size;
    if (Date.now() - started > 90000) done(false);
  }, 1000);
  proc.on('exit', () => setTimeout(() => done(fs.existsSync(file) && fs.statSync(file).size > 0), 500));
});
