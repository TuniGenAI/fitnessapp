/**
 * Shared domain types.
 *
 * Convenient `Row` / `Insert` / `Update` aliases pulled from the generated
 * `Database` type, so feature code can write `Workout`, `WorkoutSetInsert`, etc.
 * instead of the verbose `Database["public"]["Tables"][...]` form.
 */
import type { Database } from "./database";

export type { Database } from "./database";
export type {
  WeightUnit,
  VolumeUnit,
  CoachMode,
  GoalType,
  GoalSource,
  ExerciseType,
  FoodSource,
  MealType,
  RecordType,
  CoachRole,
} from "./database";

type Tables = Database["public"]["Tables"];

type Row<T extends keyof Tables> = Tables[T]["Row"];
type Insert<T extends keyof Tables> = Tables[T]["Insert"];
type Update<T extends keyof Tables> = Tables[T]["Update"];

// ---- Row types (what you read) ---------------------------------------------
export type Profile = Row<"profiles">;
export type Goals = Row<"goals">;
export type Exercise = Row<"exercises">;
export type Program = Row<"programs">;
export type ProgramDay = Row<"program_days">;
export type ProgramExercise = Row<"program_exercises">;
export type Workout = Row<"workouts">;
export type WorkoutSet = Row<"workout_sets">;
export type PersonalRecord = Row<"personal_records">;
export type Food = Row<"foods">;
export type Meal = Row<"meals">;
export type MealItem = Row<"meal_items">;
export type FoodLog = Row<"food_logs">;
export type SupplementTemplate = Row<"supplement_templates">;
export type Supplement = Row<"supplements">;
export type SupplementLog = Row<"supplement_logs">;
export type BodyMetric = Row<"body_metrics">;
export type CoachMessage = Row<"coach_messages">;
export type WaterLog = Row<"water_logs">;

// ---- Insert types (what you write; optionals have DB defaults) --------------
export type ProfileInsert = Insert<"profiles">;
export type GoalsInsert = Insert<"goals">;
export type ExerciseInsert = Insert<"exercises">;
export type ProgramInsert = Insert<"programs">;
export type ProgramDayInsert = Insert<"program_days">;
export type ProgramExerciseInsert = Insert<"program_exercises">;
export type WorkoutInsert = Insert<"workouts">;
export type WorkoutSetInsert = Insert<"workout_sets">;
export type PersonalRecordInsert = Insert<"personal_records">;
export type FoodInsert = Insert<"foods">;
export type MealInsert = Insert<"meals">;
export type MealItemInsert = Insert<"meal_items">;
export type FoodLogInsert = Insert<"food_logs">;
export type SupplementInsert = Insert<"supplements">;
export type SupplementLogInsert = Insert<"supplement_logs">;
export type BodyMetricInsert = Insert<"body_metrics">;
export type CoachMessageInsert = Insert<"coach_messages">;
export type WaterLogInsert = Insert<"water_logs">;

// ---- Update types (partial patches) ----------------------------------------
export type ProfileUpdate = Update<"profiles">;
export type GoalsUpdate = Update<"goals">;
export type ExerciseUpdate = Update<"exercises">;
export type ProgramUpdate = Update<"programs">;
export type ProgramDayUpdate = Update<"program_days">;
export type ProgramExerciseUpdate = Update<"program_exercises">;
export type WorkoutUpdate = Update<"workouts">;
export type WorkoutSetUpdate = Update<"workout_sets">;
export type FoodUpdate = Update<"foods">;
export type FoodLogUpdate = Update<"food_logs">;
export type SupplementUpdate = Update<"supplements">;
export type SupplementLogUpdate = Update<"supplement_logs">;
export type BodyMetricUpdate = Update<"body_metrics">;
