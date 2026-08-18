import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import type { Food, MealType } from "@/types";
import { Sheet, Button, Segmented, Stepper, Spinner } from "@/components/ui";
import { SearchIcon, CameraIcon, PlusIcon, TrashIcon, XIcon } from "@/components/icons";
import { searchFoods, lookupBarcode, type OffFood } from "./off";
import {
  listFoods,
  listRecentFoods,
  logFood,
  createFood,
  saveOffFood,
  deleteFood,
  scanFoodPhoto,
  describeMeal,
  type Macros,
  type RecentFood,
} from "./api";

type Tab = "recent" | "search" | "barcode" | "photo" | "describe" | "saved" | "custom";

interface Selectable {
  name: string;
  brand?: string | null;
  perServing: Macros;
  servingLabel?: string | null;
  off?: OffFood;
  foodId?: string | null;
  /** Let the user rename this in the confirm step (AI-described meals). */
  editableName?: boolean;
  /** Offer a "save to my foods" toggle for a not-yet-saved custom item. */
  savable?: boolean;
  /** Prefill the confirm step (used by recents so re-logging is near-instant). */
  initialServings?: number;
  initialMeal?: MealType | null;
}

function guessMeal(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export function AddFoodSheet({
  open,
  onClose,
  onLogged,
  logDate,
}: {
  open: boolean;
  onClose: () => void;
  onLogged: () => void;
  /** Which day the food is logged to (defaults to today inside `logFood`). */
  logDate?: string;
}) {
  const [tab, setTab] = useState<Tab>("recent");
  const [selected, setSelected] = useState<Selectable | null>(null);

  return (
    <Sheet
      open={open}
      onClose={() => {
        setSelected(null);
        onClose();
      }}
      title={selected ? "Log food" : "Add food"}
    >
      {selected ? (
        <ServingStep
          item={selected}
          logDate={logDate}
          onBack={() => setSelected(null)}
          onLogged={() => {
            setSelected(null);
            onLogged();
            onClose();
          }}
        />
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: "recent", label: "Recent" },
                { value: "search", label: "Search" },
                { value: "describe", label: "Describe" },
                { value: "barcode", label: "Barcode" },
                { value: "photo", label: "Photo" },
                { value: "saved", label: "Saved" },
                { value: "custom", label: "Custom" },
              ]}
            />
          </div>
          <div className="mt-4">
            {tab === "recent" && (
              <RecentTab
                onPick={setSelected}
                onQuickLog={async (r) => {
                  await logFood({
                    name: r.name,
                    perServing: r.perServing,
                    servings: r.servings,
                    meal_type: r.meal_type ?? guessMeal(),
                    food_id: r.food_id,
                    log_date: logDate,
                  });
                  onLogged();
                  onClose();
                }}
              />
            )}
            {tab === "search" && <SearchTab onPick={setSelected} />}
            {tab === "describe" && <DescribeTab onPick={setSelected} />}
            {tab === "barcode" && <BarcodeTab onPick={setSelected} />}
            {tab === "photo" && <PhotoTab onPick={setSelected} />}
            {tab === "saved" && <SavedTab onPick={setSelected} />}
            {tab === "custom" && <CustomTab onPick={setSelected} />}
          </div>
        </>
      )}
    </Sheet>
  );
}

function offToSelectable(o: OffFood): Selectable {
  return {
    name: o.name,
    brand: o.brand,
    perServing: {
      calories: o.calories,
      protein_g: o.protein_g,
      carbs_g: o.carbs_g,
      fat_g: o.fat_g,
      fiber_g: o.fiber_g ?? undefined,
    },
    servingLabel: o.serving_label,
    off: o,
  };
}

function foodToSelectable(f: Food): Selectable {
  return {
    name: f.name,
    brand: f.brand,
    perServing: {
      calories: f.calories,
      protein_g: f.protein_g,
      carbs_g: f.carbs_g,
      fat_g: f.fat_g,
      fiber_g: f.fiber_g ?? undefined,
    },
    servingLabel: f.serving_label,
    foodId: f.id,
  };
}

function ResultRow({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left"
      style={{ background: "var(--color-surface-2)" }}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      <PlusIcon className="h-4 w-4 shrink-0" style={{ color: "var(--color-brand)" }} />
    </button>
  );
}

function recentToSelectable(r: RecentFood): Selectable {
  return {
    name: r.name,
    perServing: r.perServing,
    servingLabel: "1 serving",
    foodId: r.food_id,
    initialServings: r.servings,
    initialMeal: r.meal_type,
  };
}

/**
 * Recently logged foods, newest first — the fast path for re-logging what you
 * eat often. Tap the row to adjust servings/meal, or the "＋" to log it again
 * instantly with the same servings.
 */
function RecentTab({
  onPick,
  onQuickLog,
}: {
  onPick: (s: Selectable) => void;
  onQuickLog: (r: RecentFood) => void;
}) {
  const [recents, setRecents] = useState<RecentFood[] | null>(null);

  useEffect(() => {
    listRecentFoods().then(setRecents);
  }, []);

  if (!recents) return <Spinner />;
  if (recents.length === 0)
    return (
      <p className="text-sm text-muted">
        Nothing logged yet. Add a food via Search or Custom — it'll show here for
        one-tap re-logging next time.
      </p>
    );

  return (
    <div className="space-y-1.5">
      {recents.map((r, i) => (
        <div
          key={`${r.name}-${i}`}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: "var(--color-surface-2)" }}
        >
          <button className="min-w-0 flex-1 text-left" onClick={() => onPick(recentToSelectable(r))}>
            <p className="truncate font-medium">
              {r.name}
              {r.servings !== 1 && <span className="text-muted"> ×{r.servings}</span>}
            </p>
            <p className="truncate text-xs text-muted">
              {Math.round(r.perServing.calories * r.servings)} kcal · P
              {Math.round(r.perServing.protein_g * r.servings)} C
              {Math.round(r.perServing.carbs_g * r.servings)} F
              {Math.round(r.perServing.fat_g * r.servings)}
            </p>
          </button>
          <button
            onClick={() => onQuickLog(r)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--color-accent)", color: "#0b0f1a" }}
            aria-label={`Log ${r.name} again`}
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function SearchTab({ onPick }: { onPick: (s: Selectable) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<OffFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    setAiMsg(null);
    setSearched(true);
    try {
      setResults(await searchFoods(q));
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  // Coverage aid: OFF is weak on whole/regional foods. When search finds nothing,
  // let the text-AI estimate this food's macros and save it as a reusable food.
  async function estimateWithAI() {
    if (!q.trim()) return;
    setAiLoading(true);
    setAiMsg(null);
    try {
      const food = await describeMeal(q.trim());
      if (!food) {
        setAiMsg(
          "AI estimate needs the food-text function deployed + a Gemini key (live app only). Meanwhile, add it under Custom.",
        );
        return;
      }
      onPick({
        name: food.name || q.trim(),
        perServing: {
          calories: food.calories,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
        },
        servingLabel: "1 serving",
        editableName: true,
        savable: true,
      });
    } catch (e) {
      setAiMsg(String((e as Error).message));
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: "var(--color-surface-2)" }}
      >
        <SearchIcon className="h-4 w-4 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search foods (Open Food Facts)…"
          className="w-full bg-transparent text-sm outline-none"
        />
        <button type="submit" className="text-xs font-bold" style={{ color: "var(--color-brand)" }}>
          Go
        </button>
      </form>

      {loading && <Spinner />}
      {err && <p className="text-sm" style={{ color: "var(--color-protein)" }}>{err}</p>}
      {!loading && searched && results.length === 0 && !err && (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            No matches in Open Food Facts — common for whole foods and local dishes.
          </p>
          <Button
            variant="subtle"
            block
            disabled={aiLoading}
            onClick={estimateWithAI}
            style={{ color: "var(--color-accent)" }}
          >
            {aiLoading ? "Estimating…" : `✨ Estimate "${q.trim()}" with AI`}
          </Button>
          {aiMsg && (
            <p className="text-xs" style={{ color: "var(--color-carbs)" }}>
              {aiMsg}
            </p>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        {results.map((r) => (
          <ResultRow
            key={r.off_id}
            title={r.name}
            subtitle={`${r.brand ? r.brand + " · " : ""}${r.calories} kcal / ${r.serving_label}`}
            onClick={() => onPick(offToSelectable(r))}
          />
        ))}
      </div>
    </div>
  );
}

function BarcodeTab({ onPick }: { onPick: (s: Selectable) => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  async function lookup(value: string) {
    setLoading(true);
    setNotFound(false);
    try {
      const food = await lookupBarcode(value);
      if (food) onPick(offToSelectable(food));
      else setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function stopScan() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  async function startScan() {
    setCamError(null);
    setScanning(true);
    try {
      // Load the scanner libs only when the camera is actually used.
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
        await Promise.all([import("@zxing/browser"), import("@zxing/library")]);

      // Restrict decoding to the retail 1D formats printed on food packaging
      // (EAN-13/8, UPC-A/E). Without this the reader tries *every* format —
      // including QR and other 2D codes — which makes it slow to lock onto a
      // product barcode and often never decodes it at all. TRY_HARDER trades a
      // little CPU for a much more reliable read off a shaky phone camera.
      const hints = new Map<number, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 100,
      });

      // The <video> mounts on the same render that set `scanning` true; wait a
      // tick so the ref is populated before we hand it to the reader.
      if (!videoRef.current) await new Promise((r) => setTimeout(r, 0));
      if (!videoRef.current) throw new Error("video element not ready");

      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, _err, controls) => {
          if (result) {
            controls.stop();
            controlsRef.current = null;
            setScanning(false);
            const value = result.getText();
            setCode(value);
            lookup(value);
          }
        },
      );
    } catch (e) {
      setCamError(
        "Couldn't start the camera. Grant camera permission (and open the app over HTTPS), or type the number below.",
      );
      setScanning(false);
      void e;
    }
  }

  useEffect(() => () => stopScan(), []);

  return (
    <div className="space-y-3">
      {scanning ? (
        <div className="relative overflow-hidden rounded-xl" style={{ background: "#000" }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="h-56 w-full object-cover" playsInline muted />
          <button
            onClick={stopScan}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-white"
            style={{ background: "rgba(0,0,0,0.5)" }}
            aria-label="Stop scanning"
          >
            <XIcon className="h-5 w-5" />
          </button>
          <div
            className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2"
            style={{ background: "var(--color-accent)" }}
          />
        </div>
      ) : (
        <Button variant="subtle" block onClick={startScan} style={{ color: "var(--color-brand)" }}>
          <CameraIcon className="h-4 w-4" /> Scan with camera
        </Button>
      )}
      {camError && (
        <p className="text-xs" style={{ color: "var(--color-carbs)" }}>
          {camError}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) lookup(code.trim());
        }}
        className="flex items-center gap-2"
      >
        <input
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="…or type a barcode number"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--color-surface-2)" }}
        />
        <Button type="submit" disabled={loading || !code.trim()}>
          Look up
        </Button>
      </form>
      {loading && <Spinner />}
      {notFound && (
        <p className="text-sm" style={{ color: "var(--color-protein)" }}>
          No product for that barcode. Try search or a custom food.
        </p>
      )}
    </div>
  );
}

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // data:<mime>;base64,<data>
      const comma = result.indexOf(",");
      resolve({ base64: result.slice(comma + 1), mime: file.type || "image/jpeg" });
    };
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}

function PhotoTab({ onPick }: { onPick: (s: Selectable) => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Optional hint the camera can't infer (e.g. "grilled chicken, not turkey",
  // "cooked in 1 tbsp olive oil"). Typed BEFORE picking the photo so it's sent
  // with the scan. Kept in a ref too so the file-input onChange always reads the
  // latest value even though it fires outside React's render.
  const [note, setNote] = useState("");
  const noteRef = useRef("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setMsg(null);
    try {
      const { base64, mime } = await fileToBase64(file);
      const food = await scanFoodPhoto(base64, mime, noteRef.current.trim() || undefined);
      if (!food) {
        setMsg(
          "Photo scan needs the food-photo function deployed + a Gemini key in Settings (live app only). Meanwhile, use Search or Custom.",
        );
        return;
      }
      onPick({
        name: food.name,
        perServing: {
          calories: food.calories,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
        },
        servingLabel: "1 photo portion",
        editableName: true,
      });
    } catch (e) {
      setMsg(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">
          Description <span className="font-normal">(optional — helps the AI)</span>
        </p>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            noteRef.current = e.target.value;
          }}
          rows={2}
          placeholder="e.g. “grilled chicken breast, not turkey — cooked in olive oil”"
          className="w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--color-surface-2)" }}
        />
      </div>
      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center"
        style={{ borderColor: "var(--color-line)" }}
      >
        <CameraIcon className="h-8 w-8" style={{ color: "var(--color-brand)" }} />
        <span className="text-sm font-semibold">Snap or choose a food photo</span>
        <span className="text-xs text-muted">
          Add a note above first if the photo is ambiguous, then Gemini estimates the
          macros — you confirm before logging.
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      {loading && <Spinner />}
      {msg && (
        <p className="text-xs" style={{ color: "var(--color-carbs)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}

function DescribeTab({ onPick }: { onPick: (s: Selectable) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (!text.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const food = await describeMeal(text.trim());
      if (!food) {
        setMsg(
          "Describe needs the food-text function deployed + a Gemini key in Settings (live app only). Meanwhile, use Search or Custom.",
        );
        return;
      }
      onPick({
        name: food.name,
        perServing: {
          calories: food.calories,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
        },
        servingLabel: "1 serving",
        editableName: true,
        savable: true,
      });
    } catch (e) {
      setMsg(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="space-y-2"
      >
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Describe your meal — e.g. “2 scrambled eggs, 2 toast with butter, a banana, black coffee”"
          className="w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--color-surface-2)" }}
        />
        <Button block type="submit" disabled={loading || !text.trim()}>
          {loading ? "Estimating…" : "Estimate macros"}
        </Button>
      </form>
      <p className="text-xs text-muted">
        Gemini estimates the total macros; you can rename it, save it, and confirm before logging.
      </p>
      {loading && <Spinner />}
      {msg && (
        <p className="text-xs" style={{ color: "var(--color-carbs)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}

function SavedTab({ onPick }: { onPick: (s: Selectable) => void }) {
  const [foods, setFoods] = useState<Food[] | null>(null);

  async function load() {
    setFoods(await listFoods());
  }
  useEffect(() => {
    load();
  }, []);

  if (!foods) return <Spinner />;
  if (foods.length === 0)
    return <p className="text-sm text-muted">No saved foods yet. Add one under “Custom”.</p>;

  return (
    <div className="space-y-1.5">
      {foods.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: "var(--color-surface-2)" }}
        >
          <button className="min-w-0 flex-1 text-left" onClick={() => onPick(foodToSelectable(f))}>
            <p className="truncate font-medium">{f.name}</p>
            <p className="truncate text-xs text-muted">
              {f.calories} kcal · P{f.protein_g} C{f.carbs_g} F{f.fat_g}
              {f.serving_label ? ` / ${f.serving_label}` : ""}
            </p>
          </button>
          <button
            onClick={async () => {
              await deleteFood(f.id);
              load();
            }}
            className="text-muted"
            aria-label="Delete saved food"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function CustomTab({ onPick }: { onPick: (s: Selectable) => void }) {
  const [name, setName] = useState("");
  const [servingLabel, setServingLabel] = useState("");
  const [m, setM] = useState<Macros>({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
  const [saving, setSaving] = useState(false);
  const patch = (p: Partial<Macros>) => setM((s) => ({ ...s, ...p }));

  return (
    <div className="space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Food name"
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{ background: "var(--color-surface-2)" }}
      />
      <input
        value={servingLabel}
        onChange={(e) => setServingLabel(e.target.value)}
        placeholder="Serving (e.g. 1 cup, 100 g)"
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{ background: "var(--color-surface-2)" }}
      />
      <div className="grid grid-cols-2 gap-2">
        <MacroField label="Calories" value={m.calories} step={10} onChange={(v) => patch({ calories: v })} />
        <MacroField label="Protein g" value={m.protein_g} step={1} onChange={(v) => patch({ protein_g: v })} />
        <MacroField label="Carbs g" value={m.carbs_g} step={1} onChange={(v) => patch({ carbs_g: v })} />
        <MacroField label="Fat g" value={m.fat_g} step={1} onChange={(v) => patch({ fat_g: v })} />
        <MacroField label="Fiber g (optional)" value={m.fiber_g ?? 0} step={1} onChange={(v) => patch({ fiber_g: v })} />
      </div>
      <Button
        block
        disabled={!name.trim() || saving}
        onClick={async () => {
          setSaving(true);
          try {
            const food = await createFood({
              name,
              serving_label: servingLabel || null,
              calories: m.calories,
              protein_g: m.protein_g,
              carbs_g: m.carbs_g,
              fat_g: m.fat_g,
              fiber_g: m.fiber_g ? m.fiber_g : null,
            });
            onPick(foodToSelectable(food));
          } finally {
            setSaving(false);
          }
        }}
      >
        <PlusIcon className="h-4 w-4" /> Save & log
      </Button>
    </div>
  );
}

function MacroField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-muted">{label}</p>
      <Stepper value={value} onChange={onChange} step={step} min={0} />
    </div>
  );
}

const MEALS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

function ServingStep({
  item,
  logDate,
  onBack,
  onLogged,
}: {
  item: Selectable;
  logDate?: string;
  onBack: () => void;
  onLogged: () => void;
}) {
  const [servings, setServings] = useState(item.initialServings ?? 1);
  const [meal, setMeal] = useState<MealType>(item.initialMeal ?? guessMeal());
  const [saveIt, setSaveIt] = useState(false);
  const [name, setName] = useState(item.name);
  const [busy, setBusy] = useState(false);

  const canSave = Boolean(item.off || item.savable);

  const total = {
    calories: Math.round(item.perServing.calories * servings),
    protein_g: Math.round(item.perServing.protein_g * servings * 10) / 10,
    carbs_g: Math.round(item.perServing.carbs_g * servings * 10) / 10,
    fat_g: Math.round(item.perServing.fat_g * servings * 10) / 10,
  };

  return (
    <div className="space-y-4">
      {item.editableName ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Name</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meal name"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--color-surface-2)" }}
          />
          <p className="mt-1.5 text-xs text-muted">
            {item.servingLabel ?? "1 serving"} · {item.perServing.calories} kcal each
          </p>
        </div>
      ) : (
        <div className="card-2 p-3">
          <p className="font-semibold">{item.name}</p>
          <p className="text-xs text-muted">
            {item.brand ? item.brand + " · " : ""}
            {item.servingLabel ?? "1 serving"} · {item.perServing.calories} kcal each
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Servings</span>
        <div className="w-40">
          <Stepper value={servings} onChange={setServings} step={0.5} min={0.25} decimals={2} />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Meal</p>
        <Segmented value={meal} onChange={setMeal} options={MEALS} />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <Tot label="Cals" v={total.calories} />
        <Tot label="P" v={total.protein_g} />
        <Tot label="C" v={total.carbs_g} />
        <Tot label="F" v={total.fat_g} />
      </div>

      {canSave && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={saveIt} onChange={(e) => setSaveIt(e.target.checked)} />
          Save to my foods for quick re-logging
        </label>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          block
          variant="accent"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              let foodId = item.foodId ?? null;
              if (saveIt && item.off) {
                const saved = await saveOffFood(item.off);
                foodId = saved.id;
              } else if (saveIt && item.savable) {
                const saved = await createFood({
                  name: name.trim(),
                  serving_label: item.servingLabel ?? null,
                  calories: item.perServing.calories,
                  protein_g: item.perServing.protein_g,
                  carbs_g: item.perServing.carbs_g,
                  fat_g: item.perServing.fat_g,
                });
                foodId = saved.id;
              }
              await logFood({
                name: name.trim(),
                perServing: item.perServing,
                servings,
                meal_type: meal,
                food_id: foodId,
                log_date: logDate,
              });
              onLogged();
            } finally {
              setBusy(false);
            }
          }}
        >
          Log {total.calories} kcal
        </Button>
      </div>
    </div>
  );
}

function Tot({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-xl py-2" style={{ background: "var(--color-surface-2)" }}>
      <p className="text-sm font-bold">{v}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
