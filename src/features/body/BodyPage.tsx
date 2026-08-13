import { ComingSoon } from "@/components/ComingSoon";
import { HeartPulseIcon } from "@/components/icons";

export function BodyPage() {
  return (
    <ComingSoon
      title="Body"
      milestone="Milestone 6 · Body metrics"
      Icon={HeartPulseIcon}
      bullets={[
        "Manual weigh-in: weight, body-fat %, muscle, water (from your Xiaomi scale)",
        "Smoothed trend line — the trend matters, not daily noise",
        "Latest weight feeds the TDEE calculator",
        "Honest note on manual-now / future auto-sync (see PRD §9)",
      ]}
    />
  );
}
