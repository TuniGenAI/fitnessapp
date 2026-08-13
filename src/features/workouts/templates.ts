/**
 * Starter program templates. Exercise names match the seeded library so they
 * resolve to real `exercises` rows when a program is created from a template.
 */
export interface TemplateExercise {
  exercise: string; // must match a seeded exercise name
  sets: number;
  repLow: number;
  repHigh: number;
}
export interface TemplateDay {
  name: string;
  exercises: TemplateExercise[];
}
export interface ProgramTemplate {
  key: string;
  name: string;
  description: string;
  days: TemplateDay[];
}

const e = (
  exercise: string,
  sets: number,
  repLow: number,
  repHigh: number,
): TemplateExercise => ({ exercise, sets, repLow, repHigh });

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    key: "ppl",
    name: "Push / Pull / Legs",
    description: "6-day classic split — chest+shoulders+triceps, back+biceps, legs.",
    days: [
      {
        name: "Push",
        exercises: [
          e("Barbell Bench Press", 4, 5, 8),
          e("Overhead Press", 3, 6, 10),
          e("Incline Dumbbell Press", 3, 8, 12),
          e("Cable Lateral Raise", 3, 12, 20),
          e("Triceps Pushdown", 3, 10, 15),
        ],
      },
      {
        name: "Pull",
        exercises: [
          e("Deadlift", 3, 4, 6),
          e("Pull-Up", 3, 6, 12),
          e("Barbell Row", 3, 8, 12),
          e("Face Pull", 3, 12, 20),
          e("Dumbbell Curl", 3, 10, 15),
        ],
      },
      {
        name: "Legs",
        exercises: [
          e("Barbell Back Squat", 4, 5, 8),
          e("Romanian Deadlift", 3, 8, 12),
          e("Leg Press", 3, 10, 15),
          e("Leg Curl", 3, 10, 15),
          e("Standing Calf Raise", 4, 10, 15),
        ],
      },
    ],
  },
  {
    key: "upper-lower",
    name: "Upper / Lower",
    description: "4-day balanced split — great for steady strength + size.",
    days: [
      {
        name: "Upper",
        exercises: [
          e("Barbell Bench Press", 4, 5, 8),
          e("Barbell Row", 4, 6, 10),
          e("Overhead Press", 3, 8, 12),
          e("Lat Pulldown", 3, 8, 12),
          e("Dumbbell Curl", 3, 10, 15),
          e("Triceps Pushdown", 3, 10, 15),
        ],
      },
      {
        name: "Lower",
        exercises: [
          e("Barbell Back Squat", 4, 5, 8),
          e("Romanian Deadlift", 3, 8, 12),
          e("Leg Press", 3, 10, 15),
          e("Leg Curl", 3, 10, 15),
          e("Standing Calf Raise", 4, 10, 15),
          e("Hanging Leg Raise", 3, 10, 20),
        ],
      },
    ],
  },
  {
    key: "full-body",
    name: "Full Body",
    description: "3-day full-body — ideal minimum-effective-dose for busy weeks.",
    days: [
      {
        name: "Full Body A",
        exercises: [
          e("Barbell Back Squat", 3, 5, 8),
          e("Barbell Bench Press", 3, 5, 8),
          e("Barbell Row", 3, 8, 12),
          e("Overhead Press", 2, 8, 12),
          e("Plank", 3, 30, 60),
        ],
      },
      {
        name: "Full Body B",
        exercises: [
          e("Deadlift", 3, 4, 6),
          e("Incline Barbell Bench Press", 3, 6, 10),
          e("Lat Pulldown", 3, 8, 12),
          e("Leg Press", 3, 10, 15),
          e("Dumbbell Curl", 2, 10, 15),
        ],
      },
    ],
  },
];
