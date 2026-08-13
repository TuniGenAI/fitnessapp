import confetti from "canvas-confetti";

/** A quick, joyful confetti burst — used for PRs and goal hits. */
export function celebrate(): void {
  const colors = ["#b6ff3c", "#7c5cff", "#ff5d8f", "#37b6ff", "#ffb020"];
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors });
  setTimeout(
    () => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors }),
    120,
  );
  setTimeout(
    () => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors }),
    240,
  );
}
