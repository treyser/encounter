import OBR from "@owlbear-rodeo/sdk";
import { MONSTER } from "./common.js";

// Межі мапи: беремо все, що лежить на шарі MAP. Якщо мапи немає,
// відштовхуємось від героїв — інакше ворогів нема куди ставити.
export async function mapBounds(fallbackCenter, dpi) {
  const maps = await OBR.scene.items.getItems((i) => i.layer === "MAP");
  if (maps.length) {
    try {
      return await OBR.scene.items.getItemBounds(maps.map((i) => i.id));
    } catch {
      // сюди потрапляємо, якщо мапа щойно зникла зі сцени
    }
  }
  const r = dpi * 12;
  return {
    min: { x: fallbackCenter.x - r, y: fallbackCenter.y - r },
    max: { x: fallbackCenter.x + r, y: fallbackCenter.y + r },
    center: fallbackCenter,
    width: r * 2,
    height: r * 2,
  };
}

// Токени гравців — усе живе на шарі CHARACTER, крім наших же монстрів
export async function heroes() {
  return OBR.scene.items.getItems(
    (i) => i.layer === "CHARACTER" && i.type === "IMAGE" && !i.metadata[MONSTER]
  );
}

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// Прилипання рахуємо самі. Звертатись по нього до Owlbear не можна:
// кожен виклик — обмін повідомленнями, а спроб тут сотні,
// і пошук розтягується на хвилини.
const snap = (p, dpi) => ({
  x: Math.floor(p.x / dpi) * dpi + dpi / 2,
  y: Math.floor(p.y / dpi) * dpi + dpi / 2,
});

// Підбір точок: не ближче minCells до героїв, не далі maxCells,
// не ближче однієї клітинки одна до одної, і все це в межах мапи.
export async function findSpots(count, opts) {
  const { dpi, bounds, heroPoints, minCells = 4, maxCells = 10 } = opts;

  const min = minCells * dpi;
  const max = maxCells * dpi;
  const pad = dpi * 0.5;

  const spots = [];
  const inside = (p) =>
    p.x > bounds.min.x + pad && p.x < bounds.max.x - pad &&
    p.y > bounds.min.y + pad && p.y < bounds.max.y - pad;

  const farEnough = (p) =>
    heroPoints.every((h) => dist(p, h) >= min) &&
    spots.every((s) => dist(p, s) >= dpi * 0.9);

  const nearEnough = (p) =>
    !heroPoints.length || heroPoints.some((h) => dist(p, h) <= max);

  const random = () => snap({
    x: bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
    y: bounds.min.y + Math.random() * (bounds.max.y - bounds.min.y),
  }, dpi);

  // Спершу чесний пошук: усі умови разом
  for (let tries = 0; tries < 4000 && spots.length < count; tries++) {
    const p = random();
    if (inside(p) && farEnough(p) && nearEnough(p)) spots.push(p);
  }

  // Якщо мапа тісна — послаблюємо дальність, лишаючи головне:
  // вороги все одно не опиняться впритул до героїв
  for (let tries = 0; tries < 4000 && spots.length < count; tries++) {
    const p = random();
    if (!inside(p)) continue;
    if (!heroPoints.every((h) => dist(p, h) >= min * 0.7)) continue;
    if (spots.every((s) => dist(p, s) >= dpi * 0.9)) spots.push(p);
  }

  return spots;
}
