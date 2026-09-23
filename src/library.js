import OBR from "@owlbear-rodeo/sdk";
import { LIBRARY } from "./common.js";

// Метадані кімнати мають жорсткий ліміт на розмір — 159 варіантів туди
// не влізають навіть у стислому вигляді й розкладені по частинах.
// Тому бібліотека живе в localStorage браузера Майстра: місця там на
// порядки більше, а ці дані потрібні лише йому — ворогів створює тільки він.
//
// Плата за це — бібліотека привʼязана до браузера. Для переїзду є
// вивантаження й завантаження файлом.

const KEY = "encounter-library";

const pack = (item) => ({
  u: item.image.url,
  w: item.image.width,
  h: item.image.height,
  m: item.image.mime,
  d: item.grid?.dpi,
  ox: item.grid?.offset?.x,
  oy: item.grid?.offset?.y,
  sx: item.scale?.x,
  sy: item.scale?.y,
});

export const unpack = (v) => ({
  image: { url: v.u, width: v.w, height: v.h, mime: v.m || guessMime(v.u) },
  grid: v.d
    ? { dpi: v.d, offset: { x: v.ox ?? v.w / 2, y: v.oy ?? v.h / 2 } }
    : null,
  scale: { x: v.sx ?? 1, y: v.sy ?? 1 },
});

function guessMime(url = "") {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "webp" ? "image/webp"
    : ext === "gif" ? "image/gif"
    : "image/png";
}

function fromStorage() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export async function readLibrary() {
  const local = fromStorage();

  // те, що колись лягло в метадані кімнати, підхоплюємо один раз
  try {
    const meta = await OBR.room.getMetadata();
    const old = meta[LIBRARY];
    if (old && Object.keys(old).length) {
      let changed = false;
      for (const [id, value] of Object.entries(old)) {
        const list = Array.isArray(value) ? value : [value];
        const packed = list.filter((v) => v?.image?.url).map(pack);
        const merged = [...(local[id] ?? [])];
        for (const v of packed) {
          if (!merged.some((x) => x.u === v.u)) { merged.push(v); changed = true; }
        }
        if (merged.length) local[id] = merged;
      }
      if (changed) save(local);
    }
  } catch {
    // поза кімнатою метаданих немає — не біда
  }

  return local;
}

function save(library) {
  localStorage.setItem(KEY, JSON.stringify(library));
}

export async function addVariants(entries) {
  const library = await readLibrary();
  let added = 0;

  for (const { id, item } of entries) {
    const v = pack(item);
    if (!v.u) continue;
    const list = [...(library[id] ?? [])];
    if (list.some((x) => x.u === v.u)) continue;
    list.push(v);
    library[id] = list;
    added += 1;
  }

  if (added) save(library);
  return added;
}

export async function removeVariant(id, url) {
  const library = await readLibrary();
  const list = (library[id] ?? []).filter((v) => v.u !== url);
  if (list.length) library[id] = list;
  else delete library[id];
  save(library);
}

export async function clearLibrary() {
  localStorage.removeItem(KEY);
  // і прибираємо старий слід у кімнаті, щоб він не повертався
  try {
    await OBR.room.setMetadata({ [LIBRARY]: undefined });
  } catch {
    // нічого страшного
  }
}

export function exportLibrary() {
  return JSON.stringify(fromStorage(), null, 2);
}

export function importLibrary(text) {
  const data = JSON.parse(text);
  const library = fromStorage();
  let added = 0;

  for (const [id, list] of Object.entries(data)) {
    if (!Array.isArray(list)) continue;
    const merged = [...(library[id] ?? [])];
    for (const v of list) {
      if (v?.u && !merged.some((x) => x.u === v.u)) { merged.push(v); added += 1; }
    }
    library[id] = merged;
  }

  save(library);
  return added;
}
