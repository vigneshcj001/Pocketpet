import cat from "./cat.js";
import duck from "./duck.js";
import panda from "./panda.js";
import penguin from "./penguin.js";

import droplet from "./droplet.js";

export const PETS = { droplet, cat, duck, panda, penguin };
export const DEFAULT_PET = "droplet";

export function getPet(id) {
  return PETS[id] ?? PETS[DEFAULT_PET];
}
