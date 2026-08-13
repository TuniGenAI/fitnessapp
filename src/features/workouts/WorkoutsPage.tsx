import { ComingSoon } from "@/components/ComingSoon";
import { DumbbellIcon } from "@/components/icons";

export function WorkoutsPage() {
  return (
    <ComingSoon
      title="Train"
      milestone="Milestone 2 · Workouts"
      Icon={DumbbellIcon}
      bullets={[
        "Program builder — Push/Pull/Legs and custom splits from templates",
        "One-handed set logger (weight × reps) with last-time numbers inline",
        "Rule-based next-target suggestions (+2.5kg or +1 rep)",
        "Workout history and per-exercise progress",
        "PR detection with confetti celebrations",
      ]}
    />
  );
}
