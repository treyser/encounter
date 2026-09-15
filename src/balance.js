// Математика складності сутички за правилами D&D 5e.
// Kobold+ не має API і тримає дані у своєму localStorage, тож дістатись до
// нього ззовні неможливо. Але самі формули відкриті — переносимо їх сюди.

// Пороги досвіду на одного гравця за рівнем
const THRESHOLDS = {
  1:  [25, 50, 75, 100],       2:  [50, 100, 150, 200],
  3:  [75, 150, 225, 400],     4:  [125, 250, 375, 500],
  5:  [250, 500, 750, 1100],   6:  [300, 600, 900, 1400],
  7:  [350, 750, 1100, 1700],  8:  [450, 900, 1400, 2100],
  9:  [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],20:[2800, 5700, 8500, 12700],
};

export const DIFFICULTY = [
  { key: "easy",   name: "Легка",       index: 0 },
  { key: "medium", name: "Середня",     index: 1 },
  { key: "hard",   name: "Важка",       index: 2 },
  { key: "deadly", name: "Смертельна",  index: 3 },
];

// Множник за кількістю ворогів
function multiplierStep(count) {
  if (count <= 1) return 0;
  if (count === 2) return 1;
  if (count <= 6) return 2;
  if (count <= 10) return 3;
  if (count <= 14) return 4;
  return 5;
}

const STEPS = [1, 1.5, 2, 2.5, 3, 4];

// Мала партія рахується як складніша, велика — як легша
export function multiplier(count, partySize) {
  let step = multiplierStep(count);
  if (partySize < 3) step += 1;
  else if (partySize > 5) step -= 1;
  return STEPS[Math.max(0, Math.min(step, STEPS.length - 1))];
}

export function target(partySize, level, difficultyKey) {
  const row = THRESHOLDS[Math.max(1, Math.min(level, 20))];
  const index = DIFFICULTY.find((d) => d.key === difficultyKey)?.index ?? 1;
  return row[index] * partySize;
}

// Скоригований досвід групи — саме за ним рахується складність
export function adjustedXp(group, partySize) {
  const count = group.reduce((sum, g) => sum + g.count, 0);
  const raw = group.reduce((sum, g) => sum + g.monster.xp * g.count, 0);
  return Math.round(raw * multiplier(count, partySize));
}

// Підбір групи під потрібний досвід.
// Перебираємо випадкові комбінації й лишаємо найближчу до цілі —
// це дає різноманітність, чого не буде в жадібному алгоритмі.
export function generate(pool, partySize, level, difficultyKey, options = {}) {
  const goal = target(partySize, level, difficultyKey);
  const maxSpecies = options.maxSpecies ?? 2;
  const maxTotal = options.maxTotal ?? 12;
  if (!pool.length) return null;

  let best = null;

  for (let attempt = 0; attempt < 600; attempt++) {
    const species = 1 + Math.floor(Math.random() * maxSpecies);
    const picked = [];
    for (let i = 0; i < species; i++) {
      const monster = pool[Math.floor(Math.random() * pool.length)];
      if (picked.some((p) => p.monster.id === monster.id)) continue;
      picked.push({ monster, count: 1 + Math.floor(Math.random() * 6) });
    }
    if (!picked.length) continue;

    const total = picked.reduce((s, g) => s + g.count, 0);
    if (total > maxTotal) continue;

    const xp = adjustedXp(picked, partySize);
    const score = Math.abs(xp - goal);
    if (!best || score < best.score) best = { group: picked, xp, score };
  }

  if (!best) return null;
  return { ...best, goal };
}
