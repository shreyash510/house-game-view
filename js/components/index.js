// Component registry: every "type" that house.json can use in "components" and "furniture".
// To add a new kind of thing, write a function (cfg, ctx) in one of these files and list it here.
import { useScene, realScene, PLINTH } from '../core.js';
import * as basic from './basic.js';
import * as furniture from './furniture.js';
import * as structures from './structures.js';
import * as outdoor from './outdoor.js';

export const COMPONENTS = {
  // basic.js
  block: basic.block, piece: basic.piece, glow: basic.glowBox, solid: basic.solid, wallLamp: basic.wallLamp,
  spots: basic.spots, namePlate: basic.namePlate,
  // furniture.js
  item: furniture.item, bed: furniture.bed, counter: furniture.counter, sink: furniture.sink, stove: furniture.stove,
  washBasin: furniture.washBasin, label: furniture.floorLabel,
  // structures.js
  steps: structures.steps, sidePorch: structures.sidePorch, staircase: structures.staircase, mumty: structures.mumty,
  towerWindow: structures.towerWindow, shrine: structures.shrine,
  // outdoor.js
  road: outdoor.road, hedge: outdoor.hedge, fireflies: outdoor.fireflies, openShed: outdoor.openShed, concreteRoad: outdoor.concreteRoad, sandRoad: outdoor.sandRoad, wireFence: outdoor.wireFence, coconutTree: outdoor.coconutTree,
};
// These stand on the ground (heights from the ground, not from the plinth top)
const GROUND = new Set(['steps', 'sidePorch', 'road', 'hedge', 'fireflies', 'openShed', 'concreteRoad', 'sandRoad', 'wireFence', 'coconutTree']);

// Build a list of components. ctx = { houseG, upper }. Entries with "skip": true are left out.
export function buildComponents(list = [], ctx) {
  list.forEach((cfg, i) => {
    if (cfg.skip) return;
    const make = COMPONENTS[cfg.type];
    if (!make) throw new Error(`house.json: unknown component type "${cfg.type}" (entry ${i}). Known: ${Object.keys(COMPONENTS).join(', ')}`);
    const ground = GROUND.has(cfg.type) || cfg.ground;
    if (ground) useScene(realScene, 0);
    make(cfg, ctx);
    if (ground) useScene(ctx.houseG, PLINTH);
  });
}
