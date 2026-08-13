/**
 * Client-side mirror of the default supplement stack
 * (`supabase/migrations/…_seed_supplement_templates.sql`).
 *
 * When signed in, the new-user DB trigger copies these into the user's
 * `supplements` table. In demo mode we copy this list into the local store on
 * first use, so the dashboard checklist works with no backend.
 */
export interface SeedSupplement {
  name: string;
  serving_label: string;
  category: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sort_order: number;
}

export const SEED_SUPPLEMENTS: SeedSupplement[] = [
  { name: "Whey Protein", serving_label: "1 scoop (30 g)", category: "protein", calories: 120, protein_g: 24, carbs_g: 3, fat_g: 2, sort_order: 10 },
  { name: "Creatine", serving_label: "5 g", category: "general", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sort_order: 20 },
  { name: "Multivitamin", serving_label: "1 tablet", category: "vitamins", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sort_order: 30 },
  { name: "Fish Oil (Omega-3)", serving_label: "1 softgel", category: "vitamins", calories: 10, protein_g: 0, carbs_g: 0, fat_g: 1, sort_order: 40 },
  { name: "Pre-Workout", serving_label: "1 scoop", category: "stimulant", calories: 5, protein_g: 0, carbs_g: 1, fat_g: 0, sort_order: 50 },
];
