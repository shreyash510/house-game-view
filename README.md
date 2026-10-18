# House game view

A walkable 3D house (three.js) built entirely from a JSON description. The bungalow is `house.json`; another house is just another JSON file.

## Run

The game loads JSON with `fetch`, so open it through a local web server, not as a file:

```
npx http-server -c-1 .
```

Then open `http://localhost:8080/`. To load a different house: `http://localhost:8080/?house=houses/small-house.json`.

Debug URL options: `?at=26,20&y=0.9` (start at plan feet x,z), `?yaw=-90&dist=18&pitch=0.4` (camera), `?xray=1` (start with Electrical and Plumbing X-ray on), `?furniture=0` (start with empty rooms), `?settings=1` (start with the settings panel open), `?devices=1` (start with Devices on).

Keys: WASD / arrows to walk, Shift to run, mouse to look (click to lock), wheel to zoom, **X** Electrical X-ray (wiring), **Z** Plumbing X-ray (water and drains), **E** Devices (fans and lights), **F** Furniture on/off, **M** minimap, **P** copy position. All switches are in the ⚙ settings panel (top right).

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
| `walls` | `{ along: "x"\|"z", at, from, to, openings: [[from, to, type]], material, outside: 1\|-1 }`. Opening types: `door`, `arch` (open doorway with a rounded top, no door), `win`, `plain` (window without frame), `vent`, `tall` |
| `doors` | `{ along, at, from, to, hingeAtStart, swing: 1\|-1, handle }` |
| `roof` | `{ slabs: [rect], canopies: [rect], parapets: [rect], parapetHeight }` |
| `rooms` | `{ name, rect, ceilingY? }`: ceilings and Room view |
| `extraCeilings`, `zones`, `labels`, `mapOutlines` | Ceilings between rooms; names in the readout `[name, x1, z1, x2, z2]`; floor text `{ text: [l1, l2], at: [x, z], width }`; dashed minimap areas |
| `lights` | `{ at: [x, z], y, intensity, distance }` |
| `components`, `fixtures`, `furniture` | Lists of parts by `type` (below). `fixtures` are built-in fittings (counters, sink, WC, wash basin) and always stay; `furniture` (beds, sofas, TV, tables...) can be switched off with the Furniture switch (key F). Add `"skip": true` to leave one out |
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
| `sidePorch` | Deck against the west wall: `x1, x2, z1, z2, steps: [rect]`, `canopy`, `railing` |
| `staircase` | U-shaped stairs to the terrace: `x1, x2, z1, zMid, z2, landing, steps` |
| `mumty` | Stair room on the terrace: `x1, x2, z1, z2, height, wall, door: [z1, z2], window: { z1, z2, y0, height }, face` |
| `towerWindow` | Framed window with a tower above: `along, at, outside, frame: [a1, a2], window: [a1, a2], ledge, lamps, grooves` (the wall opening must be `plain`) |
| `shrine` | Pooja corner: `rect` |
| `item`, `bed`, `counter`, `sink`, `stove`, `washBasin` | Furniture: `item` = `rect, h, color, y0, solid`; `bed` = `x`; `counter`/`sink` = `rect`; `stove` = `at`; `washBasin` = `x, z` |
| `road`, `hedge`, `fireflies` | `road` = `z, width, pavement: { z, width }, lamps: { x: [...], z }`; `hedge` = `rect`; `fireflies` = `count` |

Materials: `cream`, `taupe`, `white`, `frameWhite`, `steel`, `glass`, `brick`, `charcoalClad`, `towerClad`, `porchClad`, `greyClad`, `mumtyLower`, `mumtyUpper`, `brownCladding` (see `js/materials.js`).

To add a new kind of part: write a function `(cfg, ctx)` in a file under `js/components/` and list it in `COMPONENTS` in `js/components/index.js`.

### Services (X-ray)

- `layers`: `{ key: { color, name, kind } }`, with one legend checkbox per layer. `kind` is `"electrical"` (shown by the Electrical switch, key X) or `"plumbing"` (Plumbing switch, key Z); without it, `cold`, `hot` and `drain` are plumbing and the rest electrical.
- `electrical`: `junctions` (`{ id: [x, z] }`, one light point per room), `links` and `powerLinks` (conduits in the slab, `[a, b]` or `[a, b, "zFirst"]`), `switchboards` (`{ from, at: [x, z], wall }`), `sockets` (`{ from, at: [x, y, z], wall, big }`), `board` (id of the main board junction), `lightY`, `powerY`, `lightPointY`.
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
| `tubeLight` | LED batten on a wall: `at: [x, y, z]` (on the wall face), `face: "+x"|"-x"|"+z"|"-z"` (into the room), `length` |
| `exhaustFan` | Exhaust fan in a wall: `at: [x, y, z]`, `face`, `size`, `speed` |
