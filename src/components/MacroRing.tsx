interface MacroRingProps {
  label: string;
  value: number;
  goal: number;
  unit?: string;
  /** CSS color (e.g. var(--color-protein)). */
  color: string;
  size?: number;
}

/** A single progress ring used for calories / protein / carbs / fat / water. */
export function MacroRing({
  label,
  value,
  goal,
  unit = "g",
  color,
  size = 88,
}: MacroRingProps) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const dash = c * pct;
  const remaining = Math.max(goal - value, 0);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{
              transition: "stroke-dasharray 600ms cubic-bezier(0.22, 1, 0.36, 1)",
              filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 55%, transparent))`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold leading-none">
            {Math.round(value)}
          </span>
          <span className="text-[10px] text-muted">/ {goal}{unit}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-muted">{Math.round(remaining)}{unit} left</div>
      </div>
    </div>
  );
}
