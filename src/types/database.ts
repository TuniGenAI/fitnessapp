/**
 * Database types — the shape of every table, hand-kept in sync with the SQL
 * migrations in `supabase/migrations/`.
 *
 * This mirrors the format Supabase's `gen types typescript` produces, so once
 * the project is linked you can regenerate this file automatically:
 *
 *   supabase gen types typescript --linked > src/types/database.ts
 *
 * Until then it's maintained by hand. Feed it to the client for full type-safety:
 *   createClient<Database>(url, key)
 *
 * Conventions (see CLAUDE.md §5): canonical units in the DB — weight in KG,
 * volume in ML, macros in GRAMS. `Row` = what you read, `Insert` = what you
 * write (optionals have DB defaults), `Update` = partial patch.
 */

// ---- Column enums (mirror the SQL CHECK constraints) -----------------------
export type WeightUnit = "kg" | "lb";
export type VolumeUnit = "ml" | "oz";
export type CoachMode = "reactions" | "recap";
export type GoalType = "cut" | "bulk" | "maintain";
export type GoalSource = "calculated" | "manual";
export type ExerciseType = "free_weight" | "machine" | "cable" | "bodyweight";
export type FoodSource = "custom" | "open_food_facts";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type RecordType = "weight" | "volume" | "reps";
export type CoachRole = "briefing" | "recap" | "reaction";

// Helper: a table definition with its Row / Insert / Update triple.
type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          weight_unit: WeightUnit;
          volume_unit: VolumeUnit;
          coach_mode: CoachMode;
          coach_enabled: boolean;
          gemini_api_key: string | null;
          onboarded: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          weight_unit?: WeightUnit;
          volume_unit?: VolumeUnit;
          coach_mode?: CoachMode;
          coach_enabled?: boolean;
          gemini_api_key?: string | null;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          display_name?: string | null;
          avatar_url?: string | null;
          weight_unit?: WeightUnit;
          volume_unit?: VolumeUnit;
          coach_mode?: CoachMode;
          coach_enabled?: boolean;
          gemini_api_key?: string | null;
          onboarded?: boolean;
          updated_at?: string;
        }
      >;

      goals: Table<
        {
          id: string;
          user_id: string;
          goal_type: GoalType | null;
          source: GoalSource;
          calorie_target: number | null;
          protein_target_g: number | null;
          carbs_target_g: number | null;
          fat_target_g: number | null;
          water_target_ml: number;
          calorie_target_rest: number | null;
          protein_target_rest_g: number | null;
          carbs_target_rest_g: number | null;
          fat_target_rest_g: number | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          goal_type?: GoalType | null;
          source?: GoalSource;
          calorie_target?: number | null;
          protein_target_g?: number | null;
          carbs_target_g?: number | null;
          fat_target_g?: number | null;
          water_target_ml?: number;
          calorie_target_rest?: number | null;
          protein_target_rest_g?: number | null;
          carbs_target_rest_g?: number | null;
          fat_target_rest_g?: number | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          goal_type?: GoalType | null;
          source?: GoalSource;
          calorie_target?: number | null;
          protein_target_g?: number | null;
          carbs_target_g?: number | null;
          fat_target_g?: number | null;
          water_target_ml?: number;
          calorie_target_rest?: number | null;
          protein_target_rest_g?: number | null;
          carbs_target_rest_g?: number | null;
          fat_target_rest_g?: number | null;
          updated_at?: string;
        }
      >;

      exercises: Table<
        {
          id: string;
          user_id: string | null;
          name: string;
          type: ExerciseType;
          muscle_group: string;
          secondary_muscles: string[];
          created_at: string;
        },
        {
          id?: string;
          user_id?: string | null;
          name: string;
          type: ExerciseType;
          muscle_group: string;
          secondary_muscles?: string[];
          created_at?: string;
        },
        {
          name?: string;
          type?: ExerciseType;
          muscle_group?: string;
          secondary_muscles?: string[];
        }
      >;

      programs: Table<
        {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          description?: string | null;
          is_active?: boolean;
          updated_at?: string;
        }
      >;

      program_days: Table<
        {
          id: string;
          program_id: string;
          user_id: string;
          name: string;
          day_order: number;
          created_at: string;
        },
        {
          id?: string;
          program_id: string;
          user_id: string;
          name: string;
          day_order?: number;
          created_at?: string;
        },
        {
          name?: string;
          day_order?: number;
        }
      >;

      program_exercises: Table<
        {
          id: string;
          program_day_id: string;
          user_id: string;
          exercise_id: string;
          target_sets: number;
          target_reps_low: number;
          target_reps_high: number;
          order_index: number;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          program_day_id: string;
          user_id: string;
          exercise_id: string;
          target_sets?: number;
          target_reps_low?: number;
          target_reps_high?: number;
          order_index?: number;
          notes?: string | null;
          created_at?: string;
        },
        {
          exercise_id?: string;
          target_sets?: number;
          target_reps_low?: number;
          target_reps_high?: number;
          order_index?: number;
          notes?: string | null;
        }
      >;

      workouts: Table<
        {
          id: string;
          user_id: string;
          program_day_id: string | null;
          name: string | null;
          coach_mode: CoachMode | null;
          started_at: string;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          program_day_id?: string | null;
          name?: string | null;
          coach_mode?: CoachMode | null;
          started_at?: string;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        },
        {
          program_day_id?: string | null;
          name?: string | null;
          coach_mode?: CoachMode | null;
          started_at?: string;
          completed_at?: string | null;
          notes?: string | null;
        }
      >;

      workout_sets: Table<
        {
          id: string;
          workout_id: string;
          user_id: string;
          exercise_id: string;
          set_number: number;
          weight_kg: number;
          reps: number;
          is_warmup: boolean;
          is_pr: boolean;
          logged_at: string;
        },
        {
          id?: string;
          workout_id: string;
          user_id: string;
          exercise_id: string;
          set_number?: number;
          weight_kg?: number;
          reps?: number;
          is_warmup?: boolean;
          is_pr?: boolean;
          logged_at?: string;
        },
        {
          set_number?: number;
          weight_kg?: number;
          reps?: number;
          is_warmup?: boolean;
          is_pr?: boolean;
        }
      >;

      personal_records: Table<
        {
          id: string;
          user_id: string;
          exercise_id: string;
          record_type: RecordType;
          value: number;
          weight_kg: number | null;
          reps: number | null;
          workout_set_id: string | null;
          achieved_at: string;
        },
        {
          id?: string;
          user_id: string;
          exercise_id: string;
          record_type: RecordType;
          value: number;
          weight_kg?: number | null;
          reps?: number | null;
          workout_set_id?: string | null;
          achieved_at?: string;
        },
        {
          value?: number;
          weight_kg?: number | null;
          reps?: number | null;
          workout_set_id?: string | null;
          achieved_at?: string;
        }
      >;

      foods: Table<
        {
          id: string;
          user_id: string;
          name: string;
          brand: string | null;
          barcode: string | null;
          source: FoodSource;
          off_id: string | null;
          serving_size_g: number | null;
          serving_label: string | null;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          name: string;
          brand?: string | null;
          barcode?: string | null;
          source?: FoodSource;
          off_id?: string | null;
          serving_size_g?: number | null;
          serving_label?: string | null;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          brand?: string | null;
          barcode?: string | null;
          source?: FoodSource;
          off_id?: string | null;
          serving_size_g?: number | null;
          serving_label?: string | null;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          updated_at?: string;
        }
      >;

      meals: Table<
        {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        },
        {
          name?: string;
        }
      >;

      meal_items: Table<
        {
          id: string;
          meal_id: string;
          user_id: string;
          food_id: string;
          servings: number;
        },
        {
          id?: string;
          meal_id: string;
          user_id: string;
          food_id: string;
          servings?: number;
        },
        {
          servings?: number;
        }
      >;

      food_logs: Table<
        {
          id: string;
          user_id: string;
          food_id: string | null;
          log_date: string;
          meal_type: MealType | null;
          servings: number;
          name: string;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          food_id?: string | null;
          log_date?: string;
          meal_type?: MealType | null;
          servings?: number;
          name: string;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          created_at?: string;
        },
        {
          food_id?: string | null;
          log_date?: string;
          meal_type?: MealType | null;
          servings?: number;
          name?: string;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
        }
      >;

      supplement_templates: Table<
        {
          id: string;
          name: string;
          serving_label: string | null;
          category: string;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          sort_order: number;
        },
        {
          id?: string;
          name: string;
          serving_label?: string | null;
          category?: string;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          sort_order?: number;
        },
        {
          name?: string;
          serving_label?: string | null;
          category?: string;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          sort_order?: number;
        }
      >;

      supplements: Table<
        {
          id: string;
          user_id: string;
          name: string;
          serving_label: string | null;
          category: string;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          name: string;
          serving_label?: string | null;
          category?: string;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        },
        {
          name?: string;
          serving_label?: string | null;
          category?: string;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          is_active?: boolean;
          sort_order?: number;
        }
      >;

      supplement_logs: Table<
        {
          id: string;
          user_id: string;
          supplement_id: string;
          log_date: string;
          taken: boolean;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          supplement_id: string;
          log_date?: string;
          taken?: boolean;
          created_at?: string;
        },
        {
          taken?: boolean;
          log_date?: string;
        }
      >;

      body_metrics: Table<
        {
          id: string;
          user_id: string;
          measured_at: string;
          weight_kg: number | null;
          body_fat_pct: number | null;
          muscle_pct: number | null;
          water_pct: number | null;
          note: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          measured_at?: string;
          weight_kg?: number | null;
          body_fat_pct?: number | null;
          muscle_pct?: number | null;
          water_pct?: number | null;
          note?: string | null;
          created_at?: string;
        },
        {
          measured_at?: string;
          weight_kg?: number | null;
          body_fat_pct?: number | null;
          muscle_pct?: number | null;
          water_pct?: number | null;
          note?: string | null;
        }
      >;

      coach_messages: Table<
        {
          id: string;
          user_id: string;
          workout_id: string | null;
          role: CoachRole;
          content: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          workout_id?: string | null;
          role: CoachRole;
          content: string;
          created_at?: string;
        },
        {
          content?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
