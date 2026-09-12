import cat from "./cat.js";
import duck from "./duck.js";
import panda from "./panda.js";
import penguin from "./penguin.js";

export const PETS = { cat, duck, panda, penguin };
export const DEFAULT_PET = "cat";

export function getPet(id) {
  return PETS[id] ?? PETS[DEFAULT_PET];
}
