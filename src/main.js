import "./style.css";
import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { LIBRARY, PARTY, MONSTER } from "./common.js";
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
  return meta[LIBRARY] ?? {};
}

// У пул ідуть лише ті монстри, чий токен уже привʼязано
async function pool() {
  const lib = await library();
  const cat = $("category").value;
  return BESTIARY.filter(
    (m) => lib[m.id] && (!cat || m.cat === cat)
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
    $("hint").textContent = `Ціль: ${goal} досвіду. У бібліотеці: ${Object.keys(lib).length} з 60`;
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

  // розгортаємо групу в плаский список
  const queue = [];
  for (const g of plan.group) {
    for (let i = 0; i < g.count; i++) queue.push(g.monster);
  }

  const spots = await findSpots(queue.length, {
    dpi,
    bounds,
    heroPoints,
    minCells: Number($("near").value),
    maxCells: Number($("far").value),
  });

  if (!spots.length) {
    $("hint").textContent = "Не знайшлося місця — спробуй зменшити відстань";
    return;
  }

  // нумеруємо однакових, щоб не плутатись у бою
  const seen = {};
  const items = queue.slice(0, spots.length).map((m, i) => {
    seen[m.id] = (seen[m.id] ?? 0) + 1;
    const same = queue.filter((x) => x.id === m.id).length;
    const label = same > 1 ? `${m.name} ${seen[m.id]}` : m.name;

    return buildImage(lib[m.id].image, lib[m.id].grid)
      .position(spots[i])
      .scale(lib[m.id].scale ?? { x: 1, y: 1 })
      .layer("CHARACTER")
      .name(label)
      .text({ plainText: `${m.hp} ХП · КД ${m.ac}`, type: "PLAIN", richText: [] })
      .metadata({ [MONSTER]: m.id })
      .build();
  });

  await OBR.scene.items.addItems(items);

  const missing = queue.length - items.length;
  $("hint").textContent = missing
    ? `Створено ${items.length}, місця забракло для ${missing}`
    : `Створено ворогів: ${items.length}`;
}

async function clearMonsters() {
  const mobs = await OBR.scene.items.getItems((i) => Boolean(i.metadata[MONSTER]));
  if (!mobs.length) {
    $("hint").textContent = "Ворогів на сцені немає";
    return;
  }
  await OBR.scene.items.deleteItems(mobs.map((i) => i.id));
  $("hint").textContent = `Прибрано: ${mobs.length}`;
}
