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
  const existing = Object.entries(library).find(
    ([, v]) => v.image?.url === token.image?.url
  );
  if (existing) select.value = existing[0];

  $("save").addEventListener("click", save);
  $("drop").addEventListener("click", drop);
  await refresh();
}

async function getLibrary() {
  const meta = await OBR.room.getMetadata();
  return meta[LIBRARY] ?? {};
}

async function save() {
  const id = $("pick").value;
  if (!id) {
    $("hint").textContent = "Спершу обери монстра зі списку";
    return;
  }
  const library = { ...(await getLibrary()) };
  library[id] = {
    image: token.image,
    grid: token.grid,
    scale: token.scale,
  };
  await OBR.room.setMetadata({ [LIBRARY]: library });
  await refresh();
}

async function drop() {
  const id = $("pick").value;
  if (!id) return;
  const library = { ...(await getLibrary()) };
  delete library[id];
  await OBR.room.setMetadata({ [LIBRARY]: library });
  await refresh();
}

async function refresh() {
  const library = await getLibrary();
  const known = Object.keys(library).length;
  const id = $("pick").value;
  $("hint").textContent = id && library[id]
    ? `Токен запамʼятано. Усього в бібліотеці: ${known} з 60`
    : `У бібліотеці: ${known} з 60`;
}
