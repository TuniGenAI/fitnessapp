/**
 * Open Food Facts client — free, keyless food search + barcode lookup.
 * https://world.openfoodfacts.org (CORS-enabled, public data).
 *
 * We normalize every product to per-serving macros (falling back to per-100 g
 * when no serving size is published), so the rest of the app deals in one shape.
 */
export interface OffFood {
  off_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_label: string;
  serving_size_g: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const BASE = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,brands,serving_size,nutriments";

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/** Parse a serving string like "30 g" / "1 scoop (30g)" → grams, if present. */
function parseServingGrams(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/([\d.]+)\s*g/i);
  return m ? Math.round(parseFloat(m[1])) : null;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, unknown>;
}

function normalize(p: OffProduct): OffFood | null {
  const name = (p.product_name ?? "").trim();
  if (!name) return null;
  const n = p.nutriments ?? {};

  const hasServing = n["energy-kcal_serving"] != null || n["proteins_serving"] != null;
  const suffix = hasServing ? "_serving" : "_100g";
  const servingGrams = parseServingGrams(p.serving_size);

  return {
    off_id: p.code ?? "",
    name,
    brand: p.brands ? p.brands.split(",")[0].trim() : null,
    barcode: p.code ?? null,
    serving_label: hasServing
      ? p.serving_size?.trim() || "1 serving"
      : "100 g",
    serving_size_g: hasServing ? servingGrams : 100,
    calories: Math.round(num(n[`energy-kcal${suffix}`])),
    protein_g: Math.round(num(n[`proteins${suffix}`]) * 10) / 10,
    carbs_g: Math.round(num(n[`carbohydrates${suffix}`]) * 10) / 10,
    fat_g: Math.round(num(n[`fat${suffix}`]) * 10) / 10,
  };
}

export async function searchFoods(query: string): Promise<OffFood[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Food search failed (${res.status})`);
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? [])
    .map(normalize)
    .filter((f): f is OffFood => f != null && f.calories > 0);
}

export async function lookupBarcode(code: string): Promise<OffFood | null> {
  const c = code.trim();
  if (!c) return null;
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(c)}.json?fields=${FIELDS}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;
  return normalize({ ...data.product, code: c });
}
