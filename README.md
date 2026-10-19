# House game view

A walkable 3D house (three.js) built entirely from a JSON description. The bungalow is `house.json`; another house is just another JSON file.

## Run

The game loads JSON with `fetch`, so open it through a local web server, not as a file. Easiest: double-click `start.bat` (starts the server on port 8080 and opens the browser). Or run it by hand:

```
npx http-server -c-1 .
```

Then open `http://localhost:8080/`. To load a different house: `http://localhost:8080/?house=houses/small-house.json`.

Debug URL options: `?at=26,20&y=0.9` (start at plan feet x,z), `?yaw=-90&dist=18&pitch=0.4` (camera), `?xray=1` (start with Electrical and Plumbing X-ray on), `?furniture=0` (start with empty rooms), `?settings=1` (start with the settings panel open), `?devices=1` (start with Devices on), `?eye=1` (start in eye view), `?laser=0` (start with the laser off).

**Laser pointer** (eye view, camera button or key C; Settings > Laser): a red beam from the right hand to what it points at. It shows only while you move the hand (and for about a second after), then hides. The dot shows its plan position in feet (x, z) and height in m above the plinth top, next to the dot and in the readout box, so you can quote it when asking for a change. Move the hand with I / J / K / L, H = centre; on touch use the round pad left of the joystick (double tap = centre). Code: `js/laser.js`.

Keys: WASD / arrows to walk, Shift to run, mouse to look (click to lock), wheel to zoom, **X** Electrical X-ray (wiring, with the fans and lights shown), **Z** Plumbing X-ray (water and drains), **E** Devices (fans and lights), **F** Furniture on/off, **M** minimap, **P** copy position. All switches are in the ⚙ settings panel (top right).

## Files

| File | What it does |
|---|---|
| `house.json` | The bungalow: plan, walls, roof, rooms, furniture, components, services |
| `houses/small-house.json` | A small example house made only from the parts below |
| `js/main.js` | Loads the JSON, builds everything, game loop (movement, camera, X-ray) |
| `js/core.js` | Renderer, sky, lamps, plan coordinates, materials, builders (`rect`, `wallLine`, `door`, `label`...) |
| `js/house.js` | Builds one house from its JSON |
| `js/components/*.js` | Every reusable part (`basic`, `furniture`, `structures`, `outdoor`) and the registry in `index.js` |
| `js/materials.js` | Named materials (`"material": "brick"`) |
| `js/ceilings.js`, `js/services.js` | POP ceilings; wiring and plumbing (X-ray) |
| `js/makeHouse.js` | Quick room-list houses (`"otherHouses"`) |
| `js/player.js`, `js/controls.js`, `js/hud.js` | Character, input and switches, coordinates and minimap |

## The house JSON

**Units:** plan positions are **feet** (`x` west → east, `z` back → road). Heights `y`, `y0`, `h` are **metres above the plinth top** (for ground-level parts, above the ground). A height can also be written relative to the wall height: `"H"`, `"H+0.9"`, `"H-0.71"`. A `rect` is always `[x1, z1, x2, z2]`. Colours are `"#rrggbb"`.

| Key | Meaning |
|---|---|
| `wallHeight` | Wall height = terrace level, metres |
| `plinth` | `{ height, color, areas: [rect], solidEdges: [[x1,z1,x2,z2]] }`: the raised base, and low edges you cannot walk through |
| `footprint` | `[rect]`: inside the house (roof hides, walls fade, floor height) |
| `terraceExtra`, `decks` | Extra terrace areas; outdoor floors at plinth level |
| `floors` | `{ slabs: [{ rect, color }], marble: [rect] }` |
| `walls` | `{ along: "x"\|"z", at, from, to, openings: [[from, to, type]], material, outside: 1\|-1 }`. Opening types: `door`, `arch` (open doorway with a rounded top, no door), `open` (gap; `[from, to, "open", 2.1]` carries the wall on above it from 2.1 m), `win` (sliding window), `plain` (window without frame, for `towerWindow`), `wood` (timber window, 2 x 3 panes and a grill), `vent`, `tall` (`[from, to, "tall", sillY, topY]`) |
| `doors` | `{ along, at, from, to, hingeAtStart, swing: 1\|-1, handle }` |
| `roof` | `{ slabs: [rect], canopies: [rect], parapets: [rect], parapetHeight }` |
| `rooms` | `{ name, rect, ceilingY? }`: ceilings and Room view |
| `extraCeilings`, `zones`, `labels`, `mapOutlines` | Ceilings between rooms; names in the readout `[name, x1, z1, x2, z2]`; floor text `{ text: [l1, l2], at: [x, z], width }`; dashed minimap areas |
| `lights` | `{ at: [x, z], y, intensity, distance }` |
| `components`, `fixtures`, `furniture` | Lists of parts by `type` (below). `fixtures` are built-in fittings (counters, sink, WC, wash basin) and always stay; `furniture` (beds, sofas, TV, tables...) can be switched off with the Furniture switch (key F). Add `"skip": true` to leave one out |
| `versions` | Design versions listed in Settings > Design: `[{ id, name }]`. `?v=<id>` loads `versions/<id>.json` (with no `?v=`, the top-level `defaultVersion` is loaded; `?v=current` opens house.json as it is), whose `fixtures`, `furniture`, `components`, `devices`, `services.electrical.sockets` and `services.pipes` lists replace every entry tagged with its `group` (e.g. `"group": "kitchen"`); house.json itself is not changed |
| `otherHouses` | Simple houses from a room list (format at the top of `js/makeHouse.js`) |
| `spawn` | `{ at: [x, z], y }` |
| `devices` | Fans and lights shown by the Devices switch (below) |
| `services` | Wiring and plumbing for X-ray mode (below) |

### Component types

| Type | Fields |
|---|---|
| `block` | `rect` or `rects`, `y0`, `h`, `color` or `material`, `roof` (hides indoors), `solid` |
| `piece` | Box sized in metres: `at: [x, y, z]`, `size: [w, h, d]`, `color`/`material`, `roof` |
| `glow` | Glowing box: `at`, `size`, `color`, `roof` |
| `solid` | Invisible obstacle: `rect`/`rects`, `y0`, `h` |
| `wallLamp` | `at: [x, y, z]`, `face: "+x"\|"-x"\|"+z"\|"-z"`, `size`, `spill` |
| `spots` | Round ceiling lights: `points: [[x, z]]` or `grid: { x: [from, to, step], z: [...] }`, `y` |
| `namePlate` | `text: [l1, l2]`, `at`, `size: [w, h]`, `roof` |
| `label` | Floor text: `text`, `at`, `width` |
| `steps` | Front steps going toward +z: `x1, x2, z0, tread, count, handrails` |
| `sidePorch` | Deck against the west wall: `x1, x2, z1, z2, steps: [rect]`, `canopy`, `railing`, `spots` (`false` = no small ceiling spots under the canopy) |
| `staircase` | U-shaped stairs to the terrace: `x1, x2, z1, zMid, z2, landing, steps` |
| `mumty` | Stair room on the terrace: `x1, x2, z1, z2, height, wall, door: [z1, z2], doorLeaf, window: { z1, z2, y0, height }, face, top` (`top: { hollow: true }` = open-topped pit on its roof for water tanks; `top: false` = plain roof) |
| `towerWindow` | Framed window with a tower above: `along, at, outside, frame: [a1, a2], window: [a1, a2], ledge, lamps, grooves` (the wall opening must be `plain`) |
| `shrine` | Pooja corner: `rect` |
| `item`, `bed`, `counter`, `sink`, `stove`, `washBasin`, `fridge`, `marbleRack` | Furniture: `item` = `rect, h, color, y0, solid`; `bed` = `x`; `counter`/`sink` = `rect`; `stove` = `at`; `washBasin` = `x, z, face: "+x"|"-x"` (wall-side edge, which way it faces); `fridge` = `rect, face, height, color, badge`; `marbleRack` = `rect, shelves, height` |
| `waterTank`, `cementTank` | Round plastic / RCC tank: `at: [x, z], y0, radius, height, color, roof` |
| `road`, `hedge`, `fireflies` | `road` = `z, width, pavement: { z, width }, lamps: { x: [...], z }`; `hedge` = `rect`; `fireflies` = `count` |
| `concreteRoad`, `sandRoad` | `concreteRoad` = `z, width, x: [from, to], joint` (cement road along x); `sandRoad` = `along: "z"|"x", at, from, to, width` (kaccha road) |
| `openShed` | Farm shed on posts with trusses and a tin gable roof: `rect, eave, rise, ridge: "z"|"x", bays, overhang, color, floor, wall: { height, door: { side, from, width } }` (4 ft compound wall with a gate) |
| `wireFence`, `coconutTree` | `wireFence` = `rect, height, spacing, strands, gaps: [[side, from, to]]`; `coconutTree` = `at, height, lean, leanDir` |

Materials: `cream`, `taupe`, `white`, `frameWhite`, `steel`, `glass`, `brick`, `charcoalClad`, `towerClad`, `porchClad`, `greyClad`, `mumtyLower`, `mumtyUpper`, `brownCladding`, `vine` (see `js/materials.js`).

### Simple houses (`otherHouses`)

Room-list houses built by `js/makeHouse.js` (full format at the top of that file): `name, at, wall, wallColor, weathered, rooms, openings` (`door`, `win`, `wood`, `vent`, `open`), `roof` (`gable`, `flat`, or `shed` = single slope `{ high: "S"|"N", rise: [low, high], overhang }`), `ota` (3 ft plinth + front veranda: `{ height, depth, steps, roof: { back, front, posts } }`), `kitchenOta` (cooking platform `{ room, side, from, width, depth, height }`), `furniture`.

To add a new kind of part: write a function `(cfg, ctx)` in a file under `js/components/` and list it in `COMPONENTS` in `js/components/index.js`.

### Services (X-ray)

- `layers`: `{ key: { color, name, kind } }`, with one legend checkbox per layer. `kind` is `"electrical"` (shown by the Electrical switch, key X) or `"plumbing"` (Plumbing switch, key Z); without it, `cold`, `hot` and `drain` are plumbing and the rest electrical.
- `electrical`: `junctions` (`{ id: [x, z] }`, one light point per room), `links` and `powerLinks` (conduits in the slab, `[a, b]` or `[a, b, "zFirst"]`), `switchboards` (`{ from, at: [x, z], wall, room, items: [{ name, count, for }] }`: hovering a board, or tapping it on a touch screen, shows a small card with the room and each item, e.g. `{ "name": "Switch", "count": 4, "for": "tube light, fan..." }`, `{ "name": "Fan regulator (roller)", "count": 1 }`), `sockets` (`{ from, at: [x, y, z], wall, big }`), `board` (id of the main board junction), `lightY`, `powerY`, `lightPointY`.
- `pipes`: `{ layer, r, points: [[x, y, z]] }`.
- `fittings`: `{ layer, size, at, color, glow, material }`.
- `tanks`: `{ at: [x, z], y0, radius, height }`.
- `chambers`: `{ at }`.
- `pits`: `{ rect, y0, h, opacity }`.
- `tags`: `{ layer, text, at }`.

### Devices

Shown with the **Devices** switch (key **E**). Fans spin while shown. Positions in plan feet, heights in metres above the plinth top (or `"H-0.2"`).

| Type | Fields |
|---|---|
| `fan` | Ceiling fan: `at: [x, z]`, `y` (ceiling, default `"H-0.2"`), `rod`, `sweep`, `speed` |
| `ceilingLight` | Round LED panel on the ceiling: `at: [x, z]`, `y`, `radius` |
| `tubeLight` | LED batten on a wall: `at: [x, y, z]` (on the wall face), `face: "+x"|"-x"|"+z"|"-z"` (into the room), `length`; or on the ceiling: `at: [x, z]`, `y` (default `"H-0.2"`), `along: "x"|"z"` |
| `exhaustFan` | Exhaust fan in a wall: `at: [x, y, z]`, `face`, `size`, `speed` |
| `footLamp` | Small foot lamp low on a wall (lit slot at the bottom): `at: [x, y, z]`, `face`, `size` |
| `bulb` | Small bulb in a round holder: on the ceiling `at: [x, z]`, `y` (default `"H-0.2"`), or on a wall `at: [x, y, z]`, `face`; `radius` (m, default 0.05), `halo: true` (ceiling bulb only: a soft warm glow so it shows from a distance) |
