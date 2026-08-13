/**
 * Rule-based coach (no AI required). Produces motivational briefings and recaps
 * deterministically, so the coaching experience works with zero Gemini key —
 * the graceful fallback promised in CLAUDE.md §7.
 */
export interface BriefingExercise {
  name: string;
  target?: string;
  lastTime?: string;
  suggestion?: string;
  suggestionReason?: string;
}

export interface BriefingContext {
  dayName: string;
  firstName?: string;
  exercises: BriefingExercise[];
}

/** Pick a deterministic element so the copy is stable within a day but varies. */
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function daySeed(): number {
  const d = new Date();
  return d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate();
}

const OPENERS = [
  "Let's make it count",
  "Time to put in work",
  "Today's the day to push",
  "Lock in",
  "Show up for yourself today",
];

export function buildBriefing(ctx: BriefingContext): string {
  const seed = daySeed() + ctx.dayName.length;
  const opener = pick(OPENERS, seed);
  const name = ctx.firstName ? `, ${ctx.firstName}` : "";

  // Find the most concrete progression to highlight.
  const withSuggestion = ctx.exercises.find((e) => e.suggestion);
  let focus = "";
  if (withSuggestion?.suggestion) {
    focus = ` Chase ${withSuggestion.suggestion} on ${withSuggestion.name} — that's your progression target.`;
  } else if (ctx.exercises[0]) {
    focus = ` Bring solid form to ${ctx.exercises[0].name} and log every set.`;
  }

  const count = ctx.exercises.length;
  return `${opener}${name}. ${ctx.dayName} today — ${count} ${
    count === 1 ? "exercise" : "exercises"
  } on the plan.${focus}`;
}

export interface RecapContext {
  dayName: string;
  workingSets: number;
  totalVolumeKg: number;
  prCount: number;
  topExercise?: { name: string; best: string };
}

const RECAP_WINS = [
  "Strong session",
  "That's how it's done",
  "Solid work banked",
  "Another one in the log",
];

export function buildRecap(ctx: RecapContext): string {
  const seed = daySeed() + ctx.workingSets;
  const win = pick(RECAP_WINS, seed);
  const pr =
    ctx.prCount > 0
      ? ` You set ${ctx.prCount} new ${ctx.prCount === 1 ? "PR" : "PRs"} — momentum is real.`
      : "";
  const top = ctx.topExercise
    ? ` Top effort: ${ctx.topExercise.name} at ${ctx.topExercise.best}.`
    : "";
  const next =
    ctx.prCount > 0
      ? " Next time, try to add a rep or a little load and keep the streak alive."
      : " Next time, aim to beat one number from today — one more rep or 2.5 kg.";
  return `${win}: ${ctx.workingSets} working sets, ${Math.round(
    ctx.totalVolumeKg,
  ).toLocaleString()} kg moved.${pr}${top}${next}`;
}

/** One-line rule-based reaction to a just-logged set. */
export function reactionForSet(opts: {
  isPr: boolean;
  beatLastTime: boolean;
  reps: number;
  targetHigh?: number;
}): string {
  if (opts.isPr) return pick(["New PR! 🔥", "Record broken! 🏆", "That's a lifetime best!"], opts.reps);
  if (opts.targetHigh && opts.reps >= opts.targetHigh)
    return pick(["Top of the range — add load next set.", "Rep target smashed."], opts.reps);
  if (opts.beatLastTime) return "Up from last time — keep building.";
  return pick(["Clean set.", "Logged — keep the pace.", "Nice, on to the next."], opts.reps);
}
