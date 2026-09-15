export const ID = "com.nikita.encounter";

export const LIBRARY = `${ID}/library`;  // картинки монстрів — метадані КІМНАТИ
export const PARTY = `${ID}/party`;      // склад партії — метадані КІМНАТИ
export const MONSTER = `${ID}/monster`;  // мітка на створеному ворогові

// Розширення «Бій» — пишемо в його метадані, щоб вороги одразу
// потрапляли в порядок ходу. Ключ має збігатися з тим, що там.
export const BATTLE = "com.nikita.battle/state";
