// Component registry: every "type" that house.json can use in "components" and "furniture".
// To add a new kind of thing, write a function (cfg, ctx) in one of these files and list it here.
import { useScene, currentScene, realScene, PLINTH, obstacles } from '../core.js';
import * as basic from './basic.js';
import * as furniture from './furniture.js';
import * as structures from './structures.js';
import * as outdoor from './outdoor.js';
import * as interior from './interior.js';

export const COMPONENTS = {
  // basic.js
  block: basic.block, piece: basic.piece, glow: basic.glowBox, solid: basic.solid, wallLamp: basic.wallLamp,
  spots: basic.spots, namePlate: basic.namePlate, waterTank: basic.waterTank, cementTank: basic.cementTank,
  // furniture.js
  item: furniture.item, bed: furniture.bed, counter: furniture.counter, marbleRack: furniture.marbleRack, fridge: furniture.fridge, sink: furniture.sink, stove: furniture.stove,
  washBasin: furniture.washBasin, label: furniture.floorLabel,
  // structures.js
  steps: structures.steps, sidePorch: structures.sidePorch, staircase: structures.staircase, mumty: structures.mumty,
  towerWindow: structures.towerWindow, shrine: structures.shrine,
  // interior.js (interior design, built from interior.json)
  popCeiling: interior.popCeiling, wallFinish: interior.wallFinish, wallPanel: interior.wallPanel, ibox: interior.ibox, sofa: interior.sofa,
  table: interior.table, chair: interior.chair, rug: interior.rug, curtain: interior.curtain, pendant: interior.pendant, floorLamp: interior.floorLamp,
  plant: interior.plant, frame: interior.frame, shelf: interior.shelf, bedSet: interior.bedSet, wardrobe: interior.wardrobe,
  // outdoor.js
  road: outdoor.road, hedge: outdoor.hedge, fireflies: outdoor.fireflies, openShed: outdoor.openShed, concreteRoad: outdoor.concreteRoad, sandRoad: outdoor.sandRoad, wireFence: outdoor.wireFence, coconutTree: outdoor.coconutTree, compound: outdoor.compound, pavers: outdoor.pavers, parking: outdoor.parking, car: outdoor.car, carShade: outdoor.carShade,
  lawn: outdoor.lawn, flowerBed: outdoor.flowerBed, steppingStones: outdoor.steppingStones, fruitTree: outdoor.fruitTree, tulsi: outdoor.tulsi, swing: outdoor.swing, bench: outdoor.bench, orchard: outdoor.orchard, farm: outdoor.farm, bund: outdoor.bund, farshi: outdoor.farshi,
};
// These stand on the ground (heights from the ground, not from the plinth top)
const GROUND = new Set(['steps', 'sidePorch', 'road', 'hedge', 'fireflies', 'openShed', 'concreteRoad', 'sandRoad', 'wireFence', 'coconutTree', 'compound', 'pavers', 'parking', 'car', 'carShade', 'lawn', 'flowerBed', 'steppingStones', 'fruitTree', 'tulsi', 'swing', 'bench', 'orchard', 'farm', 'bund', 'farshi']);

// Any entry can have "lift": 1.2 to stand on a plinth that high (heights are then measured from the plinth top, like "ground" but raised).
// Build a list of components. ctx = { houseG, upper }. Entries with "skip": true are left out.
// "future": true = part of the future plan (compound wall, paver blocks...): built into a group of its own that shows,
// and blocks the player, only while Settings > Interior is on (main.js). "current": true = the opposite: today's
// state that the future plan replaces (farm inside the compound...), shown only while Interior is off
export const futureGroups = [];
export function buildComponents(list = [], ctx) {
  list.forEach((cfg, i) => {
    if (cfg.skip) return;
    const make = COMPONENTS[cfg.type];
    if (!make) throw new Error(`house.json: unknown component type "${cfg.type}" (entry ${i}). Known: ${Object.keys(COMPONENTS).join(', ')}`);
    const ground = GROUND.has(cfg.type) || cfg.ground;
    const [back, backOff] = currentScene();   // the group being built into (house, furniture or interior): return to it afterwards
    if (cfg.future || cfg.current) {
      const g = new THREE.Group();
      g.visible = !!cfg.current;
      g.userData.current = !!cfg.current;
      (ground ? realScene : ctx.houseG).add(g);
      futureGroups.push(g);
      const first = obstacles.length;
      useScene(g, ground ? 0 : PLINTH);
      make(cfg, ctx);
      obstacles.slice(first).forEach((o) => (cfg.current ? (o.current = true) : (o.future = true)));
      useScene(back, backOff);
      return;
    }
    if (cfg.lift) {   // stands on a plinth of its own: "lift" = its height in metres (for the otherHouses on a plinth)
      const g = new THREE.Group();
      g.position.y = cfg.lift;
      realScene.add(g);
      useScene(g, cfg.lift);
      make(cfg, ctx);
      useScene(back, backOff);
      return;
    }
    if (ground) useScene(realScene, 0);
    make(cfg, ctx);
    if (ground) useScene(back, backOff);
  });
}
