import type { ComponentType, SVGProps } from "react";

interface ComingSoonProps {
  title: string;
  milestone: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  bullets: string[];
}

/** Honest placeholder for a screen whose feature lands in a later milestone. */
export function ComingSoon({ title, milestone, Icon, bullets }: ComingSoonProps) {
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}
        >
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      </header>

      <div
        className="card p-5"
        style={{ borderStyle: "dashed", borderColor: "var(--color-brand)" }}
      >
        <span
          className="inline-block rounded-full px-2.5 py-1 text-xs font-bold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
        >
          {milestone}
        </span>
        <p className="mt-3 text-sm text-muted">Coming to this screen:</p>
        <ul className="mt-2 space-y-1.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <span style={{ color: "var(--color-brand)" }}>●</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
