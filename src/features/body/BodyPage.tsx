import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BodyMetric, ProgressPhoto } from "@/types";
import { useProfile } from "@/features/profile/ProfileProvider";
import {
  PageHeader,
  Button,
  Sheet,
  Stepper,
  Spinner,
  EmptyState,
} from "@/components/ui";
import { HeartPulseIcon, PlusIcon, TrashIcon, CameraIcon } from "@/components/icons";
import {
  toDisplayWeight,
  fromDisplayWeight,
  formatWeight,
  shortDate,
  relativeDay,
  trim,
} from "@/lib/format";
import {
  listMetrics,
  addMetric,
  deleteMetric,
  smoothWeights,
  listPhotos,
  addPhoto,
  deletePhoto,
} from "./api";

const BodyTrendChart = lazy(() => import("./BodyTrendChart"));

export function BodyPage() {
  const { profile } = useProfile();
  const unit = profile?.weight_unit ?? "kg";
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setMetrics(await listMetrics());
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const latest = metrics.length ? metrics[metrics.length - 1] : null;

  const chart = useMemo(() => {
    const pts = metrics
      .filter((m) => m.weight_kg != null)
      .map((m) => ({
        date: shortDate(m.measured_at),
        weight: Math.round(toDisplayWeight(m.weight_kg as number, unit) * 10) / 10,
      }));
    return smoothWeights(pts);
  }, [metrics, unit]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Body"
        Icon={HeartPulseIcon}
        action={
          <Button onClick={() => setAdding(true)}>
            <PlusIcon className="h-4 w-4" /> Weigh in
          </Button>
        }
      />

      {loading ? (
        <Spinner />
      ) : metrics.length === 0 ? (
        <EmptyState
          Icon={HeartPulseIcon}
          title="No weigh-ins yet"
          hint="Log weight, body-fat %, muscle and water from your scale to see your trend."
          action={<Button onClick={() => setAdding(true)}>Add first weigh-in</Button>}
        />
      ) : (
        <>
          {/* Latest snapshot */}
          {latest && (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Weight"
                value={latest.weight_kg != null ? formatWeight(latest.weight_kg, unit) : "—"}
                color="var(--color-brand)"
              />
              <StatCard label="Body fat" value={pct(latest.body_fat_pct)} color="var(--color-protein)" />
              <StatCard label="Muscle" value={pct(latest.muscle_pct)} color="var(--color-fat)" />
              <StatCard label="Water" value={pct(latest.water_pct)} color="var(--color-water)" />
            </section>
          )}

          {/* Latest tape measurements (only when any were recorded) */}
          {latest && hasMeasurements(latest) && (
            <section className="card p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Measurements (cm)
              </p>
              <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
                <TapeStat label="Waist" v={latest.waist_cm} />
                <TapeStat label="Chest" v={latest.chest_cm} />
                <TapeStat label="Arms" v={latest.arms_cm} />
                <TapeStat label="Thighs" v={latest.thighs_cm} />
                <TapeStat label="Hips" v={latest.hips_cm} />
              </div>
            </section>
          )}

          {/* Trend */}
          {chart.length >= 2 && (
            <Suspense fallback={<Spinner />}>
              <BodyTrendChart data={chart} unit={unit} />
            </Suspense>
          )}

          {/* History */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">History</h2>
            {[...metrics].reverse().map((m) => (
              <div key={m.id} className="card flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-semibold">
                    {m.weight_kg != null ? formatWeight(m.weight_kg, unit) : "—"}
                    {m.body_fat_pct != null && (
                      <span className="text-muted"> · {trim(m.body_fat_pct)}% bf</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {relativeDay(m.measured_at)}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await deleteMetric(m.id);
                    await load();
                  }}
                  className="text-muted"
                  aria-label="Delete weigh-in"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </section>
        </>
      )}

      {!loading && <ProgressPhotos />}

      {adding && (
        <WeighInSheet
          unit={unit}
          startWeightKg={latest?.weight_kg ?? null}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function hasMeasurements(m: BodyMetric): boolean {
  return (
    m.waist_cm != null ||
    m.chest_cm != null ||
    m.arms_cm != null ||
    m.thighs_cm != null ||
    m.hips_cm != null
  );
}

function TapeStat({ label, v }: { label: string; v: number | null }) {
  return (
    <div>
      <p className="text-sm font-bold">{v != null ? trim(v) : "—"}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

/** Downscale an image file to a small JPEG data URL (keeps rows light). */
async function downscaleImage(file: File, maxPx = 720, quality = 0.7): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Could not read the image"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not decode the image"));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Progress-photo gallery: add (downscaled), view full-size, delete. */
function ProgressPhotos() {
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    try {
      setPhotos(await listPhotos());
    } catch {
      setPhotos([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const dataUrl = await downscaleImage(file);
      await addPhoto(dataUrl);
      await load();
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Progress photos</h2>
        <label className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}>
          <span className="inline-flex items-center gap-1">
            <CameraIcon className="h-4 w-4" /> {busy ? "Adding…" : "Add"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {err && <p className="text-xs" style={{ color: "var(--color-protein)" }}>{err}</p>}
      {photos == null ? (
        <Spinner />
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted">
          Add a photo to track visual progress over time. Stored privately to your account.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setViewing(p)}
              className="relative aspect-square overflow-hidden rounded-xl"
              style={{ background: "var(--color-surface-2)" }}
            >
              <img src={p.data_url} alt={`Progress ${shortDate(p.taken_at)}`} className="h-full w-full object-cover" />
              <span
                className="absolute bottom-0 inset-x-0 px-1 py-0.5 text-[10px] font-semibold text-white"
                style={{ background: "rgba(0,0,0,0.45)" }}
              >
                {shortDate(p.taken_at)}
              </span>
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <Sheet open onClose={() => setViewing(null)} title={`Photo · ${relativeDay(viewing.taken_at)}`}>
          <img src={viewing.data_url} alt="Progress" className="w-full rounded-xl" />
          <Button
            block
            variant="danger"
            className="mt-4"
            onClick={async () => {
              await deletePhoto(viewing.id);
              setViewing(null);
              await load();
            }}
          >
            <TrashIcon className="h-4 w-4" /> Delete photo
          </Button>
        </Sheet>
      )}
    </section>
  );
}

function pct(v: number | null): string {
  return v == null ? "—" : `${trim(v)}%`;
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-lg font-extrabold" style={{ color }}>
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function WeighInSheet({
  unit,
  startWeightKg,
  onClose,
  onSaved,
}: {
  unit: "kg" | "lb";
  startWeightKg: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState(
    startWeightKg != null ? Number(toDisplayWeight(startWeightKg, unit).toFixed(1)) : unit === "lb" ? 175 : 80,
  );
  const [bf, setBf] = useState(0);
  const [muscle, setMuscle] = useState(0);
  const [water, setWater] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  // Optional tape measurements (cm) — collapsed by default to protect the fast path.
  const [showTape, setShowTape] = useState(false);
  const [waist, setWaist] = useState(0);
  const [chest, setChest] = useState(0);
  const [arms, setArms] = useState(0);
  const [thighs, setThighs] = useState(0);
  const [hips, setHips] = useState(0);

  return (
    <Sheet open onClose={onClose} title="New weigh-in">
      <div className="space-y-4">
        <Row label={`Weight (${unit})`}>
          <Stepper value={weight} onChange={setWeight} step={unit === "lb" ? 0.2 : 0.1} decimals={1} min={0} max={500} />
        </Row>
        <Row label="Body fat %">
          <Stepper value={bf} onChange={setBf} step={0.1} decimals={1} min={0} max={70} />
        </Row>
        <Row label="Muscle %">
          <Stepper value={muscle} onChange={setMuscle} step={0.1} decimals={1} min={0} max={80} />
        </Row>
        <Row label="Water %">
          <Stepper value={water} onChange={setWater} step={0.1} decimals={1} min={0} max={80} />
        </Row>

        <button
          onClick={() => setShowTape((v) => !v)}
          className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}
        >
          {showTape ? "− Tape measurements" : "+ Tape measurements (optional)"}
        </button>
        {showTape && (
          <div className="space-y-3">
            <Row label="Waist (cm)">
              <Stepper value={waist} onChange={setWaist} step={0.5} decimals={1} min={0} max={250} />
            </Row>
            <Row label="Chest (cm)">
              <Stepper value={chest} onChange={setChest} step={0.5} decimals={1} min={0} max={250} />
            </Row>
            <Row label="Arms (cm)">
              <Stepper value={arms} onChange={setArms} step={0.5} decimals={1} min={0} max={100} />
            </Row>
            <Row label="Thighs (cm)">
              <Stepper value={thighs} onChange={setThighs} step={0.5} decimals={1} min={0} max={120} />
            </Row>
            <Row label="Hips (cm)">
              <Stepper value={hips} onChange={setHips} step={0.5} decimals={1} min={0} max={200} />
            </Row>
          </div>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--color-surface-2)" }}
        />
        <Button
          block
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await addMetric({
                weight_kg: weight > 0 ? fromDisplayWeight(weight, unit) : null,
                body_fat_pct: bf > 0 ? bf : null,
                muscle_pct: muscle > 0 ? muscle : null,
                water_pct: water > 0 ? water : null,
                waist_cm: waist > 0 ? waist : null,
                chest_cm: chest > 0 ? chest : null,
                arms_cm: arms > 0 ? arms : null,
                thighs_cm: thighs > 0 ? thighs : null,
                hips_cm: hips > 0 ? hips : null,
                note: note.trim() || null,
              });
              onSaved();
            } finally {
              setSaving(false);
            }
          }}
        >
          Save weigh-in
        </Button>
      </div>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <div className="w-40">{children}</div>
    </div>
  );
}
