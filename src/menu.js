import "./style.css";
import OBR from "@owlbear-rodeo/sdk";
import { LIBRARY } from "./common.js";
import { BESTIARY, CATEGORIES } from "./bestiary.js";

const $ = (id) => document.getElementById(id);
let token = null;

OBR.onReady(init);

async function init() {
  const selection = (await OBR.player.getSelection()) ?? [];
  if (!selection.length) return;

  const items = await OBR.scene.items.getItems(selection);
  token = items[0];
  $("who").textContent = token?.name || "Токен";

  // список з групуванням за категоріями
  const select = $("pick");
  for (const cat of CATEGORIES) {
    const group = document.createElement("optgroup");
    group.label = cat.name;
    for (const m of BESTIARY.filter((x) => x.cat === cat.key)) {
      group.appendChild(new Option(`${m.id}. ${m.name} (CR ${m.cr})`, m.id));
    }
    select.appendChild(group);
  }

  const library = await getLibrary();
  const existing = Object.entries(library).find(([, list]) =>
    variants(list).some((v) => v.image?.url === token.image?.url)
  );
  if (existing) select.value = existing[0];

  select.addEventListener("change", refresh);

  $("save").addEventListener("click", save);
  $("drop").addEventListener("click", drop);
  await refresh();
}

async function getLibrary() {
  const meta = await OBR.room.getMetadata();
  return meta[LIBRARY] ?? {};
}

// Раніше під монстром лежав один запис, тепер список.
// Старі кімнати читаються без переносу даних.
function variants(entry) {
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

async function save() {
  const id = $("pick").value;
  if (!id) {
    $("hint").textContent = "Спершу обери монстра зі списку";
    return;
  }

  const library = { ...(await getLibrary()) };
  const list = variants(library[id]);

  // той самий малюнок двічі не додаємо
  if (list.some((v) => v.image?.url === token.image?.url)) {
    $("hint").textContent = "Цей вигляд уже є в списку";
    return;
  }

  library[id] = [...list, { image: token.image, grid: token.grid, scale: token.scale }];
  await OBR.room.setMetadata({ [LIBRARY]: library });
  await refresh();
}

// Забути лише цей вигляд; решта варіантів лишається
async function drop() {
  const id = $("pick").value;
  if (!id) return;

  const library = { ...(await getLibrary()) };
  const rest = variants(library[id]).filter(
    (v) => v.image?.url !== token.image?.url
  );

  if (rest.length) library[id] = rest;
  else delete library[id];

  await OBR.room.setMetadata({ [LIBRARY]: library });
  await refresh();
}

async function refresh() {
  const library = await getLibrary();
  const known = Object.keys(library).length;
  const id = $("pick").value;
  const list = variants(library[id]);
  const mine = list.some((v) => v.image?.url === token.image?.url);

  const about = !id
    ? ""
    : list.length
      ? `Виглядів у цього монстра: ${list.length}${mine ? ", цей уже серед них" : ""}. `
      : "Цього монстра ще немає. ";

  $("hint").textContent = `${about}У бібліотеці: ${known} з 60`;
}
