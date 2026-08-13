import { ComingSoon } from "@/components/ComingSoon";
import { AppleIcon } from "@/components/icons";

export function NutritionPage() {
  return (
    <ComingSoon
      title="Fuel"
      milestone="Milestone 4 · Nutrition"
      Icon={AppleIcon}
      bullets={[
        "Log food four ways: photo (AI), search, barcode, saved meals",
        "TDEE calculator + manual override for calorie & macro goals",
        "Open Food Facts search and barcode lookup",
        "Water quick-add and daily macro rings",
      ]}
    />
  );
}
