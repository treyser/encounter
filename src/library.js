import OBR from "@owlbear-rodeo/sdk";
import { ID, LIBRARY } from "./common.js";

// Метадані кімнати мають обмеження на розмір. Повний об'єкт картинки на
// кожен варіант швидко його вичерпує — на п'ятому десятку записів Owlbear
// просто перестає приймати запис. Тому зберігаємо стисло і розкладаємо
// бібліотеку на шість частин по десять монстрів.

const CHUNKS = 6;
const chunkKey = (n) => `${ID}/lib/${n}`;
const chunkOf = (id) => Math.floor((Number(id) - 1) / 10);

// Стислий запис: лише те, без чого не збудувати токен
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
  image: { url: v.u, width: v.w, height: v.h, mime: v.m },
  grid: v.d
    ? { dpi: v.d, offset: { x: v.ox ?? v.w / 2, y: v.oy ?? v.h / 2 } }
    : null,
  scale: { x: v.sx ?? 1, y: v.sy ?? 1 },
});

export async function readLibrary() {
  const meta = await OBR.room.getMetadata();
  const out = {};

  // старий єдиний ключ — читаємо, щоб не втратити вже привʼязане
  for (const [id, value] of Object.entries(meta[LIBRARY] ?? {})) {
    const list = Array.isArray(value) ? value : [value];
    const usable = list.filter((v) => v?.image?.url).map(pack);
    if (usable.length) out[id] = usable;
  }

  for (let n = 0; n < CHUNKS; n++) {
    for (const [id, list] of Object.entries(meta[chunkKey(n)] ?? {})) {
      const merged = [...(out[id] ?? [])];
      for (const v of list) {
        if (v?.u && !merged.some((x) => x.u === v.u)) merged.push(v);
      }
      out[id] = merged;
    }
  }

  return out;
}

// Записати цілу бібліотеку, розклавши по частинах
export async function writeLibrary(library) {
  const update = {};
  for (let n = 0; n < CHUNKS; n++) update[chunkKey(n)] = {};

  for (const [id, list] of Object.entries(library)) {
    if (!list?.length) continue;
    const n = chunkOf(id);
    if (n < 0 || n >= CHUNKS) continue;   // id поза бестіарієм
    update[chunkKey(n)][id] = list;
  }

  update[LIBRARY] = undefined;   // старий ключ більше не потрібен
  await OBR.room.setMetadata(update);
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

  if (added) await writeLibrary(library);
  return added;
}

export async function removeVariant(id, url) {
  const library = await readLibrary();
  const list = (library[id] ?? []).filter((v) => v.u !== url);
  if (list.length) library[id] = list;
  else delete library[id];
  await writeLibrary(library);
}

export async function clearLibrary() {
  await writeLibrary({});
}
