/**
 * Small shared UI kit — buttons, bottom sheet, steppers, segmented control,
 * headers and empty states. Themed via the CSS tokens in `index.css`.
 * Reused across workouts / nutrition / body / supplements.
 */
import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import { PlusIcon, BackIcon, ChevronRightIcon } from "./icons";
import { friendlyDate, shiftISODate, todayISO } from "@/lib/format";

type Variant = "primary" | "subtle" | "ghost" | "danger" | "accent";

const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-strong))",
    color: "#fff",
  },
  accent: { background: "var(--color-accent)", color: "#0b0f1a" },
  subtle: { background: "var(--color-surface-2)", color: "inherit" },
  ghost: { background: "transparent", color: "var(--color-muted)" },
  danger: { background: "var(--color-surface-2)", color: "var(--color-protein)" },
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export function Button({
  variant = "primary",
  block,
  className = "",
  style,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${
        block ? "w-full" : ""
      } ${className}`}
      style={{ ...VARIANT_STYLE[variant], ...style }}
    >
      {children}
    </button>
  );
}

/** Header with an optional icon chip and right-aligned action slot. */
export function PageHeader({
  title,
  Icon,
  action,
}: {
  title: string;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}
          >
            <Icon className="h-6 w-6" />
          </div>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

/** iOS-style bottom sheet modal. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      <div
        className="relative mx-auto max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-card)] p-4"
        style={{
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-line)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
        }}
      >
        <div
          className="mx-auto mb-3 h-1.5 w-10 rounded-full"
          style={{ background: "var(--color-line)" }}
        />
        {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/**
 * Day navigator — step back to a past day (‹) and forward toward today (›).
 * Forward is capped at `max` (today by default) so you can log for earlier days
 * but never the future.
 */
export function DateNav({
  date,
  onChange,
  max = todayISO(),
}: {
  date: string;
  onChange: (d: string) => void;
  max?: string;
}) {
  const atMax = date >= max;
  return (
    <div className="card flex items-center justify-between gap-2 p-1.5">
      <DateNavBtn
        label="Previous day"
        onClick={() => onChange(shiftISODate(date, -1))}
      >
        <BackIcon className="h-5 w-5" />
      </DateNavBtn>
      <span className="font-display text-sm font-bold">{friendlyDate(date)}</span>
      <DateNavBtn
        label="Next day"
        disabled={atMax}
        onClick={() => onChange(shiftISODate(date, 1))}
      >
        <ChevronRightIcon className="h-5 w-5" />
      </DateNavBtn>
    </div>
  );
}

function DateNavBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg transition active:scale-95 disabled:opacity-30"
      style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}
    >
      {children}
    </button>
  );
}

/** Two-or-more option segmented toggle. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex gap-1 rounded-xl p-1"
      style={{ background: "var(--color-surface-2)" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex-1 rounded-lg py-2 text-sm font-semibold transition"
            style={
              active
                ? { background: "var(--color-brand)", color: "#fff" }
                : { color: "var(--color-muted)" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Numeric stepper with tappable − / + and a typeable middle field. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  suffix,
  decimals = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  decimals?: number;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  // While the field is focused we show the raw keystrokes (`draft`) so partial
  // decimals like "0" → "0." → "0.6" survive; a controlled number would coerce
  // "0." back to 0 and eat the point. On blur we commit + normalize.
  const [draft, setDraft] = useState<string | null>(null);
  const shown =
    draft ?? (Number.isFinite(value) ? String(Number(value.toFixed(decimals))) : "0");
  const bump = (delta: number) => {
    setDraft(null);
    set(Number((value + delta).toFixed(4)));
  };
  return (
    <div
      className="flex items-center justify-between gap-1 rounded-xl px-1 py-1"
      style={{ background: "var(--color-surface-2)" }}
    >
      <StepBtn label="−" onClick={() => bump(-step)} />
      <div className="flex items-baseline gap-1">
        <input
          inputMode="decimal"
          value={shown}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            if (raw === "" || raw === "." || raw === "-") return; // partial entry
            const n = Number(raw);
            if (!Number.isNaN(n)) set(n);
          }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => {
            const n = Number(draft);
            if (draft !== null && draft !== "" && !Number.isNaN(n)) set(n);
            setDraft(null); // fall back to the normalized display
          }}
          className="w-16 bg-transparent text-center text-lg font-bold outline-none"
        />
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </div>
      <StepBtn label="+" onClick={() => bump(step)} />
    </div>
  );
}

function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold"
      style={{ background: "var(--color-surface)", color: "var(--color-brand)" }}
    >
      {label}
    </button>
  );
}

export function EmptyState({
  Icon,
  title,
  hint,
  action,
}: {
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      {Icon && <Icon className="h-10 w-10" style={{ color: "var(--color-muted)" }} />}
      <div>
        <p className="font-semibold">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** Floating-ish add button row. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="subtle" block onClick={onClick} style={{ color: "var(--color-brand)" }}>
      <PlusIcon className="h-4 w-4" />
      {label}
    </Button>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
        style={{ borderColor: "var(--color-line)", borderTopColor: "transparent" }}
      />
    </div>
  );
}
