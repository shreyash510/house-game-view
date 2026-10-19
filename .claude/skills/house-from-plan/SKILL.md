---
name: house-from-plan
description: Build a complete new building in the three.js house game from a photo/render of the bungalow plus its floor plan - rooms, walls, doors, windows, plinth, porch, steps, roof, parapets, facade cladding, columns, name plate, fixtures and basic furniture - as a new house JSON file that opens in the game. Use it whenever the user sends a house/bungalow photo or 3D render together with a plan (sketch, CAD drawing, PDF page, photo of a paper plan, or room sizes in text) and wants it built, modelled, recreated or "made in the game", even if they only say "make this", "banvaa", "build my plan" or send the images with one line. For changes to the existing bungalow in house.json, use the house-game skill instead.
---

# Build a whole house from a photo + plan

The game already knows how to draw a house from JSON (format in `README.md`). This skill turns the user's **plan** into the room layout and the **photo** into the look, writes a new house file, and checks it in screenshots until it matches. Read the `house-game` skill too (`.claude/skills/house-game/SKILL.md`): units, screenshot script and the user's vocabulary are explained there and apply here.

Output: **`houses/<short-name>.json`**, opened with `?house=houses/<short-name>.json` (and `start.bat` / the screenshot script). `house.json`, the user's main bungalow, is never touched by this skill. If the user wants the new building placed on the existing plot next to the bungalow instead, a small one can go into `house.json` → `otherHouses` (room-list format at the top of `js/makeHouse.js`); ask first, because that file is shared.

## How the game is built: reusable components driven by JSON

Nothing in a house is hand-placed geometry in code. Every part is a **reusable component**: a function `(cfg, ctx)` that draws one *kind* of thing from its JSON settings, registered by its `"type"` name in `js/components/index.js`. A house file is a list of these with different settings. So a new building is mostly a new JSON file, and code is written only for a kind of part that does not exist yet.

| File | Components (the `"type"` names you can use) |
|---|---|
| `js/components/basic.js` | `block`, `piece`, `glow`, `solid`, `wallLamp`, `spots`, `namePlate`, `waterTank`, `cementTank` |
| `js/components/structures.js` | `steps`, `sidePorch`, `staircase`, `mumty`, `towerWindow`, `shrine` |
| `js/components/furniture.js` | `item`, `bed`, `counter`, `sink`, `stove`, `washBasin`, `fridge`, `marbleRack`, `label` |
| `js/components/outdoor.js` | `road`, `hedge`, `fireflies`, `openShed`, `concreteRoad`, `sandRoad`, `wireFence`, `coconutTree`, `compound`, `pavers` |
| `js/components/interior.js` | `popCeiling`, `wallFinish`, `wallPanel`, `ibox`, `sofa`, `table`, `chair`, `rug`, `curtain`, `pendant`, `floorLamp`, `plant`, `frame`, `shelf`, `bedSet`, `wardrobe` |
| `js/makeHouse.js` | whole simple houses from a room list (`otherHouses`) |
| `js/devices.js`, `js/services.js` | fans and lights (`devices`), wiring and plumbing for X-ray (`services`) |

The exact settings of each type are in `README.md` → Component types; the file itself shows defaults. Named materials (`"material": "brick"`, `"walnut"`...) come from `js/materials.js`.

Flags that work on any entry:
- `"name"`: what it is, so the user can point at it later.
- `"skip": true`: hide it without deleting it.
- `"future": true`: future plan, shown only with Settings > Interior.
- `"group"`: replaced by a design version in `versions/`.
- `"ground": true`: heights measured from the ground, not the plinth.
- `"roof": true`: hidden when you walk inside.

**When the photo shows something no component covers** (a jaali screen, an arched gate, a sloped Mangalore-tile roof, a spiral stair...), add a **new reusable component** instead of piling up dozens of `block`s:
1. Write it general: give it a size or rect, the useful options, and sensible defaults, so the next house can use it with other settings.
2. Put it in the right file under `js/components/` and reuse the `core.js` helpers (`rect`, `box`, `furn`, `glow`, `makeTexture`, `obstacle`) and `matOf`/`material` from `materials.js`.
3. List it in `COMPONENTS` in `js/components/index.js`, and in `GROUND` if it stands on the ground.
4. Add a row for it to the README Component types table, then use it from the JSON.
5. Check it with `node --check js/components/<file>.js`.

A one-off tweak (a single coloured band, one extra post) is fine as a `block` or `piece`; a shape you would draw more than twice deserves a component.

## 1. Read the plan into a room schedule

Work out, and write down as a table in your reply before building:

| Room | rect [x1, z1, x2, z2] (ft, wall centre lines) | clear size on plan | doors / windows |
|---|---|---|---|

How to get the numbers right:
- **Axes:** x runs west → east, z runs back → front. Put the side facing the road / main entrance at **high z** (front), whatever the drawing's own north arrow says, so the porch and steps face +z like the existing bungalow. Put the back-left corner of the house at (0, 0).
- **Plans give clear (inside) sizes** like `12'0" x 11'6"`. Rooms in the game are rectangles on wall **centre lines**, so add one wall thickness per room: with 9" walls (the Indian default) a 12' x 11'6" room is 12.75 x 12.25 on centre lines. A 4.5" partition (bath, WC) adds 0.375'. Chain rooms so shared walls share one coordinate.
- **Check the totals**: the room widths along each row must add up to the overall dimension written on the plan (or the plot size). If they do not, re-read the labels before guessing. Read openings the same way: a door "3' wide, 1' from the corner" → `from = wall start + 1 + wall/2`.
- **Openings**: door (D, D1 = 3'-3'6"), window (W = 4'-5', V = vent 1.5'-2'), open passage / arch. Note which way doors swing (the arc on the plan) and which side the main door is.
- Stairs, ota, sit-out, porch, parking: porch / ota / sit-out are `outdoor` areas (on the plinth, no walls). Stairs use the `staircase` component; a stair room on the terrace is `mumty`.
- If something is genuinely unreadable (a dimension hidden, two plans disagree, which side is the road), ask one short question with your best guess. Everything else, decide and list it as an assumption.

## 2. Generate the starter house

Write the schedule as a spec (format at the top of `scripts/build_house.js`) and run:

```
node .claude/skills/house-from-plan/scripts/build_house.js <scratchpad>/spec.json houses/<name>.json
```

It produces walls (merged per line, outer walls marked), all openings and door leaves, marble floors, ceilings, a flat roof with 0.6 ft overhang and parapets, plinth (rooms + outdoor areas), front steps, floor labels with clear sizes, a light per room and a spawn point in front. If it prints `NOT PLACED`, an opening is not on a room edge: fix its `at`/`from`/`to`.

Take one top-down screenshot now and compare it with the plan, room by room, before spending time on the facade:
`node .claude/skills/house-game/scripts/shot.js <scratchpad>/top.png "house=houses/<name>.json&at=<centre x>,<centre z>&dist=<1.2 x house width>&pitch=1.3&laser=0" 1200 800`

## 3. Dress it from the photo

List what the photo shows, then add it in this order (biggest visual effect first). Use existing component types (README → Component types) before writing code:

| In the photo | In the house JSON |
|---|---|
| Wall height, number of storeys | `wallHeight` (≈ 3.0-3.6 m per storey); count brick courses or compare with the door height (2.1 m) |
| Plinth height, steps | `plinth.height`, `steps` (`count` ≈ plinth / 0.15 m) |
| Outside wall colour, two-tone bands | wall `material` (`cream`, `taupe`, `facade`) or a `block` with `material` over the outer face |
| Stone / brick / grooved cladding, charcoal or brown panels | `block` with `brick`, `charcoalClad`, `greyClad`, `porchClad`, `brownCladding`, `towerClad` (add a new material in `js/materials.js` if none is close) |
| Porch slab, canopy, sunshades (chajja) over windows | `roof.canopies`, or `block` with `"roof": true` |
| Columns, pillars | `block` with `"solid": true` (+ a darker base block) |
| Framed window with a tower or box around it | `towerWindow` (the wall opening must be `plain`) |
| Railings, parapet style, glass balcony | `block` slats / `piece` posts on the roof (`"roof": true`) |
| Name plate, wall lamps, ceiling spots | `namePlate`, `wallLamp`, `spots`, `devices` |
| Sloped / tin roof | flat slab + `block`s, or for a simple house `otherHouses` with `roof: gable / shed` |
| Kitchen platform, WC, wash basin, beds, sofa | `fixtures` (`counter`, `sink`, `stove`, `item`, `washBasin`) and `furniture` (`bed`, `item`) |
| Compound wall, gate, paving, trees | `compound`, `pavers`, `coconutTree`, `hedge` |

Match colours by eye from the photo (pick the mid-tone of a lit wall, not the shadow). Keep everything in one file; name every entry (`"name"`) after what it is so the user can point at it later.

## 4. Check against the photo, then fix

Take a screenshot from roughly the photo's camera position: stand the player in front (`at=<x>,<front z + 15>`), `yaw` so the camera looks the same way (0 = looking north / at the front of a house whose front faces +z), `dist` 10-20, `pitch` 0.1-0.3. Read the PNG and write a short list of differences (proportions, missing elements, colours, window sizes). Fix the biggest ones and look again. Two or three rounds is normal; stop when the remaining differences are small details, and say what they are. The user dislikes long screenshot runs, so batch fixes between shots.

Also walk the plan once: an eye-level shot inside the main room (`eye=1&y=<plinth+0.1>`) to make sure doors open and nothing blocks the way.

## 5. Tell the user

- How to open it: `start.bat`, then add `?house=houses/<name>.json` to the address (or the full link).
- The room schedule table you used, and every assumption (wall thickness, heights, which side faces the road, things you could not read).
- What still differs from the photo, with one concrete question if a decision is theirs.
- Do not commit; the user commits with GitLens.

## Things that went wrong before (keep in mind)

- Plan images are often rotated or mirrored compared with the photo; match them by the main door and porch before placing anything.
- Feet for plan positions, **metres** for heights. A `rect` is `[x1, z1, x2, z2]`, always low-to-high.
- Walls are 0.18 m (0.45 ft) thick, centred on their line: an inside face is 0.225 ft from the line. Items against a wall start at the face, not the line.
- Files use CRLF line endings; other chats edit the repo at the same time, so re-read before editing anything outside your new file.
- The Interior switch loads `interior.json` only for the main bungalow; a new house can have its own interior file via `"interiorFile": "houses/<name>-interior.json"` (same format as `interior.json`).
