import "./style.css";
import OBR from "@owlbear-rodeo/sdk";
import { BESTIARY, CATEGORIES } from "./bestiary.js";
import { readLibrary, addVariants, removeVariant } from "./library.js";

const $ = (id) => document.getElementById(id);
let token = null;

OBR.onReady(init);

async function init() {
  const selection = (await OBR.player.getSelection()) ?? [];
  if (!selection.length) return;

  const items = await OBR.scene.items.getItems(selection);
  token = items[0];
  $("who").textContent = token?.name || "Токен";

  const select = $("pick");
  for (const cat of CATEGORIES) {
    const group = document.createElement("optgroup");
    group.label = cat.name;
    for (const m of BESTIARY.filter((x) => x.cat === cat.key)) {
      group.appendChild(new Option(`${m.id}. ${m.name} (CR ${m.cr})`, m.id));
    }
    select.appendChild(group);
  }

  const library = await readLibrary();
  const existing = Object.entries(library).find(([, variants]) =>
    variants.some((v) => v.u === token.image?.url)
  );
  if (existing) select.value = existing[0];

  select.addEventListener("change", refresh);
  $("save").addEventListener("click", save);
  $("drop").addEventListener("click", drop);

  await refresh();
}

// Один монстр може мати кілька токенів — при спавні береться випадковий.
async function save() {
  const id = $("pick").value;
  if (!id) {
    $("hint").textContent = "Спершу обери монстра зі списку";
    return;
  }

  try {
    const added = await addVariants([{ id, item: token }]);
    if (!added) {
      $("hint").textContent = "Цей токен уже в списку";
      return;
    }
  } catch (err) {
    $("hint").textContent = "Не вдалося зберегти: " + (err?.message ?? err);
    console.error(err);
    return;
  }
  await refresh();
}

// Забути лише цей токен, інші варіанти лишаються
async function drop() {
  const id = $("pick").value;
  if (!id) return;
  await removeVariant(id, token.image?.url);
  await refresh();
}

async function refresh() {
  const library = await readLibrary();
  const known = Object.keys(library).length;
  const id = $("pick").value;
  const variants = id ? (library[id]?.length ?? 0) : 0;
  const here = id && library[id]?.some((v) => v.u === token.image?.url);

  $("hint").textContent =
    (id
      ? `${here ? "Цей токен у списку" : "Цього токена ще немає"} · варіантів: ${variants}. `
      : "") + `У бібліотеці: ${known} з 60`;
}
