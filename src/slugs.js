// Англійські назви токенів у бібліотеці Owlbear -> id монстра з бестіарію.
// Зчитування зі сцени шукає збіг за назвою токена, ігноруючи хвіст _1, _2, _3.
export const SLUGS = {
  6: "giant_crocodile",
  7: "giant_shark",
  9: "shellback",
  10: "ancient_abyssal",
  11: "forest_goblin",
  12: "green_raider",
  13: "crooktooth",
  14: "thornling",
  15: "tree_guardian",
  16: "rootling",
  17: "spider_keeper",
  18: "forest_witch",
  19: "shadow_hunter",
  20: "elder_rootling",
  21: "cave_dweller",
  22: "stone_rider",
  23: "colossal_giant",
  24: "clawfiend",
  25: "stone_guardian",
  26: "winged_predator",
  27: "stone_gaze",
  29: "mountain_vulture",
  30: "ancient_rockling",
  31: "fire_imp",
  32: "ash_imp",
  33: "magmaling",
  34: "fire_elemental",
  35: "hellhound",
  36: "spiked_demon",
  37: "hell_executioner",
  38: "fire_serpent",
  39: "chain_demon",
  40: "flame_lord",
  41: "skeleton",
  42: "walking_dead",
  43: "gravekeeper",
  44: "rotter",
  45: "shadow",
  46: "phantom",
  47: "soul_eater",
  48: "disembodied",
  49: "cursed_priest",
  50: "bloodsucker",
  51: "bandit",
  52: "robber",
  53: "mercenary",
  54: "cultist",
  55: "fanatic",
  56: "heavy_warrior",
  57: "veteran",
  58: "knight",
  59: "battle_mage",
  60: "assassin",
};

export const SLUG_TO_ID = Object.fromEntries(
  Object.entries(SLUGS).map(([id, slug]) => [slug, Number(id)])
);

// Звести назву токена до порівнюваного вигляду: прибрати розширення файлу,
// пробіли й дефіси звести до підкреслень, відкинути номер варіанта в кінці.
export function normalize(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.(png|jpe?g|webp|gif|svg)$/i, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_?\d+$/, "");
}
