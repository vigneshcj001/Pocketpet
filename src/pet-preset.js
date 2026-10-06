import { BUILTIN_IDS, normalizeAccessories } from "./preferences.js";

/** Website exports appearance only. No settings, credentials, or trust rules. */
export function parsePetPreset(value) {
  if (!value || value.app !== "PocketPet" || value.type !== "pet-preset" || value.version !== 1 || !BUILTIN_IDS.includes(value.pet)) {
    throw new Error("Choose a PocketPet website pet preset JSON file.");
  }
  const color = typeof value.color === "string" && /^#[0-9a-f]{6}$/i.test(value.color) ? value.color.toLowerCase() : "";
  return { pet: value.pet, colors: { [value.pet]: color }, accessories: { [value.pet]: normalizeAccessories(value.accessories) } };
}

/** Accept only appearance data from the app's custom URL scheme. */
export function parsePetPresetLink(link) {
  if (typeof link !== "string" || link.length > 4096) throw new Error("Invalid PocketPet pet link.");
  const url = new URL(link);
  if (url.protocol !== "pocketpet:" || url.host !== "pet" || url.pathname !== "/apply" || url.hash || url.username || url.password) {
    throw new Error("Invalid PocketPet pet link.");
  }
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 3 || !["pet", "color", "accessories"].every((key) => url.searchParams.getAll(key).length === 1)) {
    throw new Error("Invalid PocketPet pet link.");
  }
  return parsePetPreset({
    app: "PocketPet", type: "pet-preset", version: 1,
    pet: url.searchParams.get("pet"), color: url.searchParams.get("color"),
    accessories: JSON.parse(url.searchParams.get("accessories")),
  });
}
