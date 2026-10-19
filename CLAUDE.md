# House game view

A walkable 3D village bungalow in three.js, built from JSON. Work here is almost always **changing this existing scene** (walls, windows, rooms, roof, porch, tanks, shed, roads, the small tin-roof house), not building something new.

- **Before any change, load the `house-game` skill** (`.claude/skills/house-game/SKILL.md`): where things are, plan units, how to find what the user points at, and how to check the result with a screenshot.
- **Format reference:** `README.md` (every `house.json` key, component type, material and debug URL option). Keep it updated when you add a component type or option.
- **Run it:** `start.bat` (needs a web server; opening `index.html` as a file does not work). Screenshot for checking: `node .claude/skills/house-game/scripts/shot.js out.png "at=7,41&yaw=0&dist=7"`.

## Files

- `house.json`: the whole scene. Edit this first.
- `js/`: `main.js` (load + game loop), `core.js` (builders: `rect`, `wallLine`, `door`...), `house.js`, `makeHouse.js` (simple houses), `components/*.js` (reusable parts, registered in `components/index.js`), `materials.js`, `services.js` (X-ray wiring and plumbing), `devices.js` (fans, lights), `controls.js`, `hud.js`.

## Rules that matter here

- Change only what was asked and keep the existing design. When the target is unclear, ask for a screenshot with a red mark.
- "revert it" = undo your last change immediately and exactly.
- The user and other chats edit the same files at the same time: re-read before editing, use exact-text edits, keep CRLF line endings, and prefer `"skip": true` over deleting.
- Do not commit unless asked. The git repo is this folder (`E:\houseDesign\game`); the user commits and pushes with GitLens.
