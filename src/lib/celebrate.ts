import confetti from "canvas-confetti";

/**
 * A restrained celebratory sparkle for PRs / goal hits — one small, soft
 * burst in the FitBody palette (lime + violet), not the old three-cannon
 * blast. Toned down deliberately; keep it subtle.
 */
export function celebrate(): void {
  const colors = ["#e2f163", "#896cfe", "#b3a0ff"];
  confetti({
    particleCount: 36,
    spread: 52,
    startVelocity: 32,
    gravity: 1.1,
    scalar: 0.85,
    ticks: 120,
    origin: { y: 0.7 },
    colors,
  });
}
