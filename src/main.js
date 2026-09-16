import "./style.css";
import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { LIBRARY, PARTY, MONSTER, BATTLE } from "./common.js";
import { BESTIARY, CATEGORIES, byId } from "./bestiary.js";
import { DIFFICULTY, generate, adjustedXp, target } from "./balance.js";
import { mapBounds, heroes, findSpots } from "./place.js";

const $ = (id) => document.getElementById(id);

let difficulty = "medium";
let plan = null;   // згенерована група

OBR.onReady(init);

async function init() {
  const isGM = (await OBR.player.getRole()) === "GM";
  $("gm").hidden = !isGM;
  $("player").hidden = isGM;
  if (!isGM) return;

  for (const cat of CATEGORIES) {
    $("category").appendChild(new Option(cat.name, cat.key));
  }

  const box = $("difficulty");
  for (const d of DIFFICULTY) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d.name;
    b.dataset.key = d.key;
    b.setAttribute("aria-selected", String(d.key === difficulty));
    b.addEventListener("click", () => {
      difficulty = d.key;
      box.querySelectorAll("button").forEach((x) =>
        x.setAttribute("aria-selected", String(x.dataset.key === difficulty))
      );
      show();
    });
    box.appendChild(b);
  }

  // склад партії памʼятаємо між сесіями
  const meta = await OBR.room.getMetadata();
  const party = meta[PARTY];
  if (party) {
    $("size").value = party.size ?? 4;
    $("level").value = party.level ?? 3;
  }
  for (const id of ["size", "level"]) {
    $(id).addEventListener("change", saveParty);
  }

  $("roll").addEventListener("click", roll);
  $("spawn").addEventListener("click", spawn);
  $("clear").addEventListener("click", clearMonsters);

  await show();
}

async function saveParty() {
  await OBR.room.setMetadata({
    [PARTY]: { size: Number($("size").value), level: Number($("level").value) },
  });
}

async function library() {
  const meta = await OBR.room.getMetadata();
  const raw = meta[LIBRARY] ?? {};

  // Стара версія зберігала один токен на монстра, нова — список варіантів.
  // Приводимо до списку, щоб записи, зроблені раніше, не ламали спавн.
  const fixed = {};
  for (const [id, value] of Object.entries(raw)) {
    const variants = Array.isArray(value) ? value : [value];
    const usable = variants.filter((v) => v?.image?.url);
    if (usable.length) fixed[id] = usable;
  }
  return fixed;
}

// Раніше на монстра зберігався один токен об'єктом, тепер список варіантів.
// Старі записи читаємо так само, щоб нічого не загубилось.
function variantsOf(lib, id) {
  const entry = lib[id];
  if (!entry) return [];
  const list = Array.isArray(entry) ? entry : [entry];
  return list.filter((v) => v?.image?.url);
}

// Під монстром може лежати кілька виглядів; старі кімнати мають один запис
function variants(entry) {
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

// Кожному ворогові — випадковий вигляд зі списку
const pickLook = (entry) => {
  const list = variants(entry);
  return list[Math.floor(Math.random() * list.length)];
};

// У пул ідуть лише ті монстри, чий токен уже привʼязано
async function pool() {
  const lib = await library();
  const cat = $("category").value;
  return BESTIARY.filter(
    (m) => variantsOf(lib, m.id).length && (!cat || m.cat === cat)
  );
}

async function roll() {
  const list = await pool();
  if (!list.length) {
    $("hint").textContent =
      "Немає жодного привʼязаного монстра з цієї категорії. ПКМ на токені → «Бестіарій».";
    plan = null;
    await show();
    return;
  }

  const size = Number($("size").value);
  const level = Number($("level").value);
  plan = generate(list, size, level, difficulty);
  await show();
}

async function show() {
  const size = Number($("size").value);
  const level = Number($("level").value);
  const goal = target(size, level, difficulty);
  const box = $("result");
  box.innerHTML = "";

  if (!plan) {
    $("spawn").disabled = true;
    const lib = await library();
    const looks = Object.values(lib).reduce((n, e) => n + variants(e).length, 0);
    $("hint").textContent =
      `Ціль: ${goal} досвіду. У бібліотеці: ${Object.keys(lib).length} з 60, виглядів: ${looks}`;
    return;
  }

  for (const g of plan.group) {
    const row = document.createElement("div");
    row.className = "entry";

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `${g.count}×`;

    const name = document.createElement("div");
    name.className = "name";
    name.innerHTML = `${g.monster.name}<small>CR ${g.monster.cr} · КД ${g.monster.ac} · ХП ${g.monster.hp}</small>`;

    row.append(count, name);
    box.appendChild(row);
  }

  const total = plan.group.reduce((s, g) => s + g.count, 0);
  $("hint").textContent =
    `${adjustedXp(plan.group, size)} досвіду проти цілі ${goal}. Ворогів: ${total}`;
  $("spawn").disabled = false;
}

async function spawn() {
  if (!plan) return;
  try {
    await doSpawn();
  } catch (err) {
    $("hint").textContent = "Збій під час спавну: " + describe(err);
    console.error("Спавн:", err);
  }
}

// Owlbear інколи віддає помилку об'єктом без поля message,
// і тоді звичайне склеювання з рядком дає «[object Object]».
function describe(err) {
  if (!err) return "невідома причина";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  if (err.error) return describe(err.error);
  try {
    return JSON.stringify(err).slice(0, 300);
  } catch {
    return String(err);
  }
}

async function doSpawn() {
  if (!(await OBR.scene.isReady())) {
    $("hint").textContent = "Спершу відкрий сцену";
    return;
  }

  const lib = await library();
  const dpi = await OBR.scene.grid.getDpi();

  const party = await heroes();
  let heroPoints = [];
  let center = { x: 0, y: 0 };

  if (party.length) {
    // центр кожного героя, а не кут картинки — інакше відстань поповзе
    for (const hero of party) {
      const hb = await OBR.scene.items.getItemBounds([hero.id]);
      heroPoints.push(hb.center);
    }
    const all = await OBR.scene.items.getItemBounds(party.map((i) => i.id));
    center = all.center;
  }

  const bounds = await mapBounds(center, dpi);

  // якщо когось із плану немає в бібліотеці — краще сказати прямо
  const missingArt = plan.group
    .filter((g) => !lib[g.monster.id]?.length)
    .map((g) => g.monster.name);
  if (missingArt.length) {
    $("hint").textContent =
      "Немає токена для: " + missingArt.join(", ") + ". Привʼяжи через ПКМ → «Бестіарій»";
    return;
  }

  // розгортаємо групу в плаский список
  const queue = [];
  for (const g of plan.group) {
    for (let i = 0; i < g.count; i++) queue.push(g.monster);
  }

  const noArt = [...new Set(queue.filter((m) => !variantsOf(lib, m.id).length).map((m) => m.name))];
  if (noArt.length) {
    $("hint").textContent = `Немає токена для: ${noArt.join(", ")}. Привʼяжи через ПКМ → «Бестіарій».`;
    return;
  }

  if (!party.length) {
    // не помилка: вороги просто розсядуться будь-де в межах мапи
    console.info("Токенів гравців на сцені немає — відстань ні від чого рахувати");
  }

  const spots = await findSpots(queue.length, {
    dpi,
    bounds,
    heroPoints,
    minCells: Number($("near").value),
    maxCells: Number($("far").value),
  });

  if (!spots.length) {
    $("hint").textContent = heroPoints.length
      ? `Не знайшлося місця: мапа ${Math.round(bounds.width / dpi)}×${Math.round(bounds.height / dpi)} клітинок. Зменш «не ближче» або збільш «не далі».`
      : "Не знайшлося місця на мапі — перевір, чи є на сцені зображення на шарі Map.";
    return;
  }

  // нумеруємо однакових, щоб не плутатись у бою
  const seen = {};
  const items = queue.slice(0, spots.length).map((m, i) => {
    seen[m.id] = (seen[m.id] ?? 0) + 1;
    const same = queue.filter((x) => x.id === m.id).length;
    const numbered = same > 1 ? `${m.name} ${seen[m.id]}` : m.name;
    // ХП і КД кладемо в назву: підпис під токеном (text) вимагає повної
    // структури зі стилем і розмірами, інакше Owlbear відхиляє елемент
    const label = `${numbered} · ${m.hp} ХП · КД ${m.ac}`;
    const look = pickLook(lib[m.id]);

    return buildImage(look.image, look.grid)
      .position(spots[i])
      .scale(look.scale ?? { x: 1, y: 1 })
      .layer("CHARACTER")
      .name(label)
      .metadata({ [MONSTER]: m.id })
      .build();
  });

  await OBR.scene.items.addItems(items);

  const missing = queue.length - items.length;
  $("hint").textContent = missing
    ? `Створено ${items.length}, місця забракло для ${missing}`
    : `Створено ворогів: ${items.length}`;
}

// Дописуємо створених у список бою сусіднього розширення
async function addToBattle(items) {
  try {
    const meta = await OBR.room.getMetadata();
    const state = meta[BATTLE];
    if (!state) return;   // розширення «Бій» не встановлене або ще не чіпали

    const order = [...(state.order ?? [])];
    for (const item of items) {
      if (order.some((e) => e.id === item.id)) continue;
      order.push({
        id: item.id,
        sheetId: null,
        name: item.name,
        side: "foe",
        dex: 0,
        init: null,
        roll: null,
      });
    }
    await OBR.room.setMetadata({ [BATTLE]: { ...state, order } });
  } catch (err) {
    console.error("Не вдалося додати в бій:", err);
  }
}

async function clearMonsters() {
  const mobs = await OBR.scene.items.getItems((i) => Boolean(i.metadata[MONSTER]));
  if (!mobs.length) {
    $("hint").textContent = "Ворогів на сцені немає";
    return;
  }
  const ids = mobs.map((i) => i.id);
  await OBR.scene.items.deleteItems(ids);

  const meta = await OBR.room.getMetadata();
  const state = meta[BATTLE];
  if (state?.order?.length) {
    await OBR.room.setMetadata({
      [BATTLE]: { ...state, order: state.order.filter((e) => !ids.includes(e.id)) },
    });
  }

  $("hint").textContent = `Прибрано: ${mobs.length}`;
}
