/**
 * Curated stock imagery — hotlinked from Unsplash's CDN (zero disk, free to
 * hotlink under the Unsplash license). Every id below was verified to load.
 *
 * Selection is category-accurate: workout/cardio/yoga heroes are picked from
 * the matching pool by keyword, and food imagery is chosen by *meal type* (a
 * category), never guessed from an individual food's name. A deterministic
 * hash keeps a given day/meal on the same photo instead of flickering.
 *
 * The <Photo> component always renders a gradient fallback, so a URL that ever
 * fails to load degrades to a brand gradient rather than a broken image.
 */

/** Build an Unsplash CDN url at a given width (auto format + crop). */
export function unsplash(id: string, w = 800): string {
  return `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`;
}

// Strength / gym / general resistance training.
const STRENGTH = [
  "1517836357463-d25dfeac3438",
  "1534438327276-14e5300c3a48",
  "1571019613454-1cb2f99b2d8b",
  "1581009146145-b5ef050c2e1e",
  "1550345332-09e3ac987658",
  "1541534741688-6078c6bfb5c5",
  "1599058917765-a780eda07a3e",
  "1584735935682-2f2b69dff9d2",
  "1517838277536-f5f99be501cd",
];

// Running / conditioning.
const CARDIO = ["1526506118085-60ce8714f8c5", "1538805060514-97d9cc17730c"];

// Mobility / yoga / recovery.
const MOBILITY = ["1594737625785-a6cbdabd333c"];

// Food, keyed by meal type so the photo matches the category.
const FOOD_BY_MEAL: Record<string, string> = {
  breakfast: "1567620905732-2d1ec7ab7445", // pancakes / breakfast
  lunch: "1512621776951-a57141f2eefd", // fresh salad
  dinner: "1595078475328-1ab05d0a6a0e", // hearty bowl
  snack: "1490645935967-10de6ba17061", // light plate
  other: "1546069901-ba9599a7e63c", // salad jar
};
const FOOD_POOL = Object.values(FOOD_BY_MEAL);

/** Stable small hash → index, so the same seed always maps to the same photo. */
function pick(pool: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
}

/** Hero photo for a workout/session, chosen by keyword in its name. */
export function heroImage(name: string, w = 800): string {
  const n = (name || "workout").toLowerCase();
  let pool = STRENGTH;
  if (/run|jog|cardio|hiit|conditioning|sprint|treadmill|row/.test(n)) pool = CARDIO;
  else if (/yoga|mobility|stretch|recovery|rest|flexib/.test(n)) pool = MOBILITY;
  return unsplash(pick(pool, n), w);
}

/** Food photo for a meal type (breakfast/lunch/dinner/snack/other). */
export function mealImage(mealType: string, w = 400): string {
  return unsplash(FOOD_BY_MEAL[mealType] ?? FOOD_BY_MEAL.other, w);
}

/** Generic food photo for a saved-meal card, deterministic by its name. */
export function foodImage(seed: string, w = 400): string {
  return unsplash(pick(FOOD_POOL, seed || "meal"), w);
}
