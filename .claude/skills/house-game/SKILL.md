---
name: house-game
description: How to change the existing 3D house game in this repo (house-game-view, three.js) - move, add, remove or resize walls, windows, doors, rooms, stairs, roof parts, porches, tanks, sheds, roads, fences, trees, furniture, lights, fans or the small tin-roof house - and check the result with a screenshot. Use it whenever the user asks for any change to the house or the scene, sends a screenshot of the game (often with a red mark or the PLAN (feet) readout), gives plan coordinates, compares the game with a reference photo, or uses words like ota, patra, mumty, slab, parapet, plinth or compound - even if they do not say "game" or "house.json".
---

# Changing the house game

This repo is a walkable 3D bungalow built from `house.json`. Almost every change is an edit to `house.json`; code changes are only needed for a new *kind* of part. The full JSON format is in `README.md` - read the section you need before editing.

## 1. Find what the user means

- **Screenshot with a readout:** the box `PLAN (feet) x .. z ..` is the player's position on the plan, so the thing they point at is near that spot. Use it to search `house.json`.
- **Red mark:** that one thing, nothing else. If two parts could match, ask for a marked screenshot instead of guessing - wrong guesses got reverted many times in this project.
- **Top views are often rotated.** Orient by landmarks before deciding which side is which (see the table below): the sand road runs north-south at x 106, the bungalow's porch is on the south (road) side, north is the back.
- **Reference photo:** the overall design already follows the user's renders. List the specific differences and ask which to fix rather than redesigning.
- Search: every component has a `"name"`, so `grep -n "kitchen porch" house.json` or grep the coordinates (`"at": 13.2`).

### Plan and units

- Plan positions are **feet**: `x` west -> east, `z` north (back) -> south (road side). A `rect` is `[x1, z1, x2, z2]`.
- Heights are **metres above the plinth top** (ground-level components like roads and sheds: above the ground). `"H"` = wall height (3.6 m), `"H+0.9"` etc. also work. The plinth is 0.8 m (about 3 ft).
- Walls are 0.18 m thick, centred on their line: the inner face of a wall at `x = 13` is at `13 - 0.225` ft.

### Where things are

Positions change as the user edits; treat this as a starting point and confirm in `house.json` (find entries by `"name"`, not by list index).

| Thing | Where (plan feet) | In house.json |
|---|---|---|
| Main bungalow | x 0-35, z 0-33, porch to z 37 | `walls`, `doors`, `rooms`, `roof`, `components` |
| Kitchen, staircase, storeroom, central passage | x 0-17.5, z 13.3-33 | `rooms`, `staircase`, walls at x 13.2 / 17.5 |
| Stair room on the terrace (mumty) + water tanks in its hollow top | x 0-15, z 11.55-21.55 | `mumty` (`top: { hollow }`), `waterTank` x2, `services.tanks` |
| Kitchen door porch (west side) | x -3-0, z 21-33 | `sidePorch` |
| Small tin-roof (patra) house with ota and kitchen ota | `at: [40.6, 35.9]`, 24 x 13 ft | `otherHouses` entry `"name": "Tin-roof house"` (built by `js/makeHouse.js`) |
| 1BHK bungalow (900 sq ft) | `at: [-31.5, -62.9]` | `otherHouses` entry `"name": "1BHK bungalow (900 sq ft)"` |
| Barbed-wire compound, coconut trees | behind the houses; trees near x 49-56, z 65 | `wireFence`, `coconutTree` |
| Farm shed with 4 ft compound wall and gate | x 70.4-95.4, z 1.7-33.7 | `openShed` |
| Cement concrete road (east-west) | z -72 | `concreteRoad` |
| Sand road (north-south) | x 106.4 | `sandRoad` |
| Main asphalt road | z 56.5 | `road` (currently `"skip": true`) |
| Interior design (POP ceilings, designed furniture, curtains...), shown with Settings > Interior | per room | **`interior.json`** (not house.json), one entry per room in `rooms` |

## 2. Make the smallest change that does what was asked

- Change only what was asked. "Don't change the design" is a standing rule here: keep sizes, colours and the look of everything else.
- To hide something, prefer `"skip": true` on the entry over deleting it - easy to bring back if the user says "revert".
- **Other people edit these files at the same time** (the user, other chats). Re-read the part of the file just before editing and replace exact text; never rewrite the whole file from an old copy.
- Files use **CRLF line endings**. When editing with a script, normalise `\r\n` to `\n`, edit, and write back with `\r\n`; plain exact-string edits work too.
- A wall's openings: `[from, to, type]`; `[from, to, "open", 2.1]` keeps the wall above a gap from 2.1 m. Window types: `win` (sliding), `wood` (2 x 3 panes + grill), `plain` (with `towerWindow`), `vent`, `tall`.
- When something is connected, move it together: e.g. a basin's water and drain pipes live in `services.pipes`; fans sit on `services.electrical.junctions`.
- **New kind of part:** write `function (cfg, ctx)` in `js/components/<basic|furniture|structures|outdoor>.js`, add it to `COMPONENTS` in `js/components/index.js` (and to `GROUND` if heights are from the ground), add `"roof": true` support if it sits on the terrace, and add a row to the README tables.
- Check syntax after a code edit: `node --check js/<file>.js`. Check JSON: `node -e "JSON.parse(require('fs').readFileSync('house.json','utf8'))"`.

## 3. Look at the result before saying it is done

The game uses ES modules and `fetch`, so it only runs from a web server (opening `index.html` as a file shows nothing). Use the bundled script - it serves the folder, takes a headless Edge screenshot and stops (about 10 s):

```
node .claude/skills/house-game/scripts/shot.js <out.png> "<url options>" [width] [height]
```

Then open the PNG with the Read tool and compare it with what the user asked for. Save screenshots in your scratchpad, not in the repo.

URL options (from `js/controls.js` / `js/main.js`):

| Option | Meaning |
|---|---|
| `at=x,z` | Player position in plan feet. Add `y=0.9` to stand inside the house (on the plinth), `y=4.5` on the terrace |
| `yaw=deg` | Where the camera sits relative to the player: `0` = south of him looking north, `90` = east looking west, `-90` = west looking east, `180` = north looking south |
| `dist=m`, `pitch=rad` | Camera distance and tilt (`pitch=1.2` with `dist=14` is a near top-down view) |
| `xray=1`, `furniture=0`, `settings=1`, `eye=1` | Start with Services X-ray on, (devices are on by default; `devices=0` hides them), rooms empty, settings open, eye-level camera |

Tips: if the player ends up somewhere else (pushed out by a wall), check the readout in the screenshot and move `at`. Inside the house the walls turn see-through, so thin parts look faint - that is normal. One or two screenshots are enough; the user does not like long exploratory screenshot runs.

## 4. Tell the user

Short and plain: what changed, where, that you checked it in a screenshot (or that you did not), and anything you were unsure about with one concrete question. Say which file/entry holds the change so it is easy to tweak. Do not commit unless asked - the user commits and pushes with GitLens; the git repo is this `game` folder (`cd /d E:\houseDesign\game` in cmd).

## The user

- Writes short messages in English mixed with Marathi words. Glossary: **ota** = raised platform/veranda (also *kitchen ota* = cooking platform), **patra** = corrugated tin roof sheet, **mumty / cap mamaty** = stair room on the terrace, **pokal** = hollow, **taaranche** = barbed wire, **kaccha** = unpaved, **slap** = slab, **holl** = hall, **gril** = window grill.
- "revert it" means undo your last change right away, exactly. Then ask what they meant, ideally for a screenshot with a red mark.
- Approximate sizes like "3 fit" are feet. Estimate positions from screenshots by comparing with nearby parts of known size (doors are 2.1 m, windows 0.9-2.2 m).
