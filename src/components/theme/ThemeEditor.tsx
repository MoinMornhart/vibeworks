"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ClipboardCopy,
  Dices,
  Download,
  ImagePlus,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { ColorField, Section, Segmented, Slider, Toggle } from "./controls";
import { BackgroundView, gradientCss } from "@/components/background/Background";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import {
  ACCENT_SWATCHES,
  BACKGROUND_PRESETS,
  COLOR_SCHEMES,
  DEFAULT_STATUS_COLORS,
  DEFAULT_THEME,
  PALETTE_KEYS,
  resolveTheme,
  STATUS_KEYS,
  type Theme,
} from "@/lib/theme";
import { GRADIENT_PRESETS } from "@/lib/theme/presets";
import { contrast, hslToRgb, rgbToHex, shiftHue } from "@/lib/theme/color";
import { PROJECT_STATUSES } from "@/lib/status";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export interface UploadInfo {
  id: string;
  size: number;
  createdAt: string;
}

const clone = <T,>(v: T): T => structuredClone(v);

/** Design ohne Bezug auf private Bilder – zum Weitergeben. */
function exportable(theme: Theme): Theme {
  const t = clone(theme);
  t.background.image.uploadId = null;
  if (t.background.type === "image") t.background.type = "preset";
  return t;
}

const GLASS_PRESETS = [
  { id: "clear", opacity: 25, blur: 6 },
  { id: "milk", opacity: 62, blur: 18 },
  { id: "frost", opacity: 45, blur: 32 },
  { id: "opaque", opacity: 100, blur: 0 },
] as const;

export function ThemeEditor({ initialUploads }: { initialUploads: UploadInfo[] }) {
  const t = useT("theme");
  const tc = useT("common");
  const ts = useT("status");
  const { saved, preview, commit } = useTheme();
  const [draft, setDraft] = useState<Theme>(() => clone(saved));
  const [uploads, setUploads] = useState(initialUploads);
  const [paletteMode, setPaletteMode] = useState<"dark" | "light">(saved.mode === "light" ? "light" : "dark");
  const [hoverPreset, setHoverPreset] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  // Live-Vorschau: jede Änderung sofort auf der ganzen Seite zeigen.
  useEffect(() => {
    preview(dirty ? draft : null);
  }, [draft, dirty, preview]);
  // Seite verlassen ohne Speichern → zurück zum gespeicherten Design.
  useEffect(() => () => preview(null), [preview]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = useCallback((fn: (t: Theme) => void) => {
    setDraft((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });
    setNotice(null);
    setError(null);
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ theme: Theme }>("/api/account/theme", { method: "PUT", body: { theme: draft } });
      commit(res.theme);
      setDraft(clone(res.theme));
      setNotice(t("page.saved"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    setError(null);
    if (file.size > 8 * 1024 * 1024) {
      setError(t("errors.imageTooLarge"));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("page.errorStatus", { status: res.status }));
      setUploads((u) => [{ id: data.upload.id, size: data.upload.size, createdAt: data.upload.createdAt }, ...u]);
      edit((th) => {
        th.background.type = "image";
        th.background.image.uploadId = data.upload.id;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("page.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteUpload(id: string) {
    if (!window.confirm(t("page.confirmDeleteImage"))) return;
    try {
      const res = await api<{ theme: Theme | null }>(`/api/uploads/${id}`, { method: "DELETE" });
      setUploads((u) => u.filter((x) => x.id !== id));
      if (res.theme) commit(res.theme);
      edit((th) => {
        if (th.background.image.uploadId === id) {
          th.background.image.uploadId = null;
          if (th.background.type === "image") th.background.type = "preset";
        }
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function openShare() {
    setShareText(JSON.stringify(exportable(draft), null, 2));
    setShareError(null);
    setShareOpen(true);
  }

  function importShare() {
    try {
      const parsed = JSON.parse(shareText);
      const theme = exportable(resolveTheme(parsed));
      setDraft(theme);
      setShareOpen(false);
      setNotice(t("page.imported"));
    } catch {
      setShareError(t("page.invalidJson"));
    }
  }

  const bg = draft.background;
  const palette = draft[paletteMode];
  const checks = [
    { id: "text", ratio: contrast(palette.text, palette.surface), min: 4.5 },
    { id: "muted", ratio: contrast(palette.muted, palette.surface), min: 4.5 },
    { id: "textOnBg", ratio: contrast(palette.text, palette.bg), min: 4.5 },
  ] as const;

  return (
    <div className="fade-in">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="mt-1 text-muted">{t("page.intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm" onClick={openShare}><Share2 size={15} /> {t("page.share")}</button>
          <button className="btn btn-sm" onClick={() => edit((th) => Object.assign(th, clone(DEFAULT_THEME)))}>
            <RotateCcw size={15} /> {t("page.reset")}
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {/* ── Darstellung ─────────────────────────────── */}
          <Section title={t("mode.title")} description={t("mode.description")}>
            <Segmented
              label={t("mode.label")}
              value={draft.mode}
              onChange={(mode) => {
                edit((th) => { th.mode = mode; });
                if (mode !== "system") setPaletteMode(mode);
              }}
              options={[
                { value: "dark", label: t("mode.dark"), icon: <Moon size={15} /> },
                { value: "light", label: t("mode.light"), icon: <Sun size={15} /> },
                { value: "system", label: t("mode.system"), icon: <Monitor size={15} /> },
              ]}
            />
          </Section>

          {/* ── Farbschema ──────────────────────────────── */}
          <Section title={t("scheme.title")} description={t("scheme.description")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {COLOR_SCHEMES.map((s) => {
                const active = draft.scheme === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      edit((th) => {
                        th.scheme = s.id;
                        th.accent = s.accent;
                        th.dark = clone(s.dark);
                        th.light = clone(s.light);
                      })
                    }
                    className={cn("rounded-xl border p-2 text-left transition", active ? "border-accent ring-2 ring-accent/40" : "hover:border-accent/50")}
                  >
                    <div className="flex h-14 overflow-hidden rounded-lg border">
                      {[s.dark, s.light].map((p, i) => (
                        <div key={i} className="flex-1 p-1.5" style={{ background: p.bg }}>
                          <div className="h-full rounded-md p-1.5" style={{ background: p.surface }}>
                            <div className="h-1.5 w-8 rounded-full" style={{ background: s.accent }} />
                            <div className="mt-1.5 h-1 w-10 rounded-full" style={{ background: p.muted, opacity: 0.6 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <span className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
                      {active && <Check size={14} className="text-accent-ink" />} {t(`schemes.${s.id}`)}
                    </span>
                  </button>
                );
              })}
            </div>
            {draft.scheme === "custom" && <p className="mt-3 text-xs text-muted">{t("scheme.custom")}</p>}
          </Section>

          {/* ── Akzentfarbe ─────────────────────────────── */}
          <Section title={t("accent.title")} description={t("accent.description")}>
            <div className="flex flex-wrap gap-2">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => edit((th) => { th.accent = c; th.scheme = "custom"; })}
                  className={cn("h-9 w-9 rounded-full border-2 transition hover:scale-110", draft.accent === c ? "border-fg" : "border-transparent")}
                  style={{ background: c }}
                  aria-label={t("accent.swatch", { color: c })}
                  aria-pressed={draft.accent === c}
                />
              ))}
              <button
                type="button"
                className="btn btn-icon rounded-full"
                title={t("accent.random")}
                aria-label={t("accent.randomLabel")}
                onClick={() => edit((th) => { th.accent = rgbToHex(hslToRgb(Math.random() * 360, 0.75, 0.62)); th.scheme = "custom"; })}
              >
                <Dices size={16} />
              </button>
            </div>
            <div className="mt-4 max-w-xs">
              <ColorField label={t("accent.custom")} value={draft.accent} onChange={(c) => edit((th) => { th.accent = c; th.scheme = "custom"; })} />
            </div>
          </Section>

          {/* ── Palette ─────────────────────────────────── */}
          <Section
            title={t("palette.title")}
            description={t("palette.description")}
            actions={
              <Segmented
                label={t("palette.editLabel")}
                value={paletteMode}
                onChange={setPaletteMode}
                options={[
                  { value: "dark", label: t("mode.dark"), icon: <Moon size={14} /> },
                  { value: "light", label: t("mode.light"), icon: <Sun size={14} /> },
                ]}
              />
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {PALETTE_KEYS.map((key) => (
                <ColorField
                  key={key}
                  label={t(`palette.keys.${key}`)}
                  value={palette[key]}
                  onChange={(c) => edit((th) => { th[paletteMode][key] = c; th.scheme = "custom"; })}
                />
              ))}
            </div>
            <ul className="mt-5 space-y-1.5 text-sm">
              {checks.map((c) => {
                const good = c.ratio >= c.min;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <span className="text-muted">{t(`palette.checks.${c.id}`)}</span>
                    <span className={cn("font-mono text-xs", good ? "text-emerald-400" : "text-amber-400")}>
                      {c.ratio.toFixed(1)} : 1 {good ? "✓" : t("palette.hardToRead")}
                    </span>
                  </li>
                );
              })}
            </ul>
            {paletteMode !== (draft.mode === "system" ? paletteMode : draft.mode) && (
              <p className="mt-3 text-xs text-muted">{paletteMode === "dark" ? t("palette.editingDark") : t("palette.editingLight")}</p>
            )}
          </Section>

          {/* ── Statusfarben ────────────────────────────── */}
          <Section
            title={t("statusColors.title")}
            description={t("statusColors.description")}
            actions={
              <button className="btn btn-sm" onClick={() => edit((th) => { th.status = clone(DEFAULT_STATUS_COLORS); })}>
                <RotateCcw size={14} /> {t("statusColors.reset")}
              </button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {STATUS_KEYS.map((key) => (
                <ColorField key={key} label={ts(`project.${key}`)} value={draft.status[key]} onChange={(c) => edit((th) => { th.status[key] = c; })} />
              ))}
            </div>
          </Section>

          {/* ── Glas ────────────────────────────────────── */}
          <Section title={t("glass.title")} description={t("glass.description")}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Slider label={t("glass.opacity")} value={draft.glass.opacity} min={0} max={100} unit=" %" onChange={(v) => edit((th) => { th.glass.opacity = v; })} />
              <Slider label={t("glass.blur")} value={draft.glass.blur} min={0} max={40} unit=" px" onChange={(v) => edit((th) => { th.glass.blur = v; })} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {GLASS_PRESETS.map((p) => (
                <button key={p.id} className="btn btn-sm" onClick={() => edit((th) => { th.glass = { opacity: p.opacity, blur: p.blur }; })}>
                  {t(`glass.presets.${p.id}`)}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Hintergrund ─────────────────────────────── */}
          <Section title={t("background.title")} description={t("background.description")}>
            <Segmented
              label={t("background.typeLabel")}
              value={bg.type}
              onChange={(type) => edit((th) => { th.background.type = type; })}
              options={[
                { value: "preset", label: t("background.types.preset") },
                { value: "gradient", label: t("background.types.gradient") },
                { value: "image", label: t("background.types.image") },
              ]}
            />

            {bg.type === "preset" && (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {BACKGROUND_PRESETS.map((id) => {
                    const selected = bg.preset.id === id;
                    const thumb = clone(draft);
                    thumb.background.type = "preset";
                    thumb.background.preset.id = id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => edit((th) => { th.background.preset.id = id; })}
                        onMouseEnter={() => setHoverPreset(id)}
                        onMouseLeave={() => setHoverPreset(null)}
                        onFocus={() => setHoverPreset(id)}
                        onBlur={() => setHoverPreset(null)}
                        className={cn("overflow-hidden rounded-xl border text-left transition", selected ? "border-accent ring-2 ring-accent/40" : "hover:border-accent/50")}
                      >
                        <div className="relative isolate aspect-video overflow-hidden" style={{ background: "var(--vw-bg)" }}>
                          <BackgroundView theme={thumb} contained still={hoverPreset !== id} />
                        </div>
                        <div className="px-2.5 py-2">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {selected && <Check size={14} className="text-accent-ink" />} {t(`backgrounds.${id}.name`)}
                          </span>
                          <span className="line-clamp-1 text-xs text-muted">{t(`backgrounds.${id}.hint`)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Slider label={t("background.speed")} value={bg.preset.speed} min={0} max={200} step={5} unit=" %" onChange={(v) => edit((th) => { th.background.preset.speed = v; })} />
                  <Slider label={t("background.intensity")} value={bg.preset.intensity} min={10} max={100} unit=" %" onChange={(v) => edit((th) => { th.background.preset.intensity = v; })} />
                </div>

                <Toggle
                  label={t("background.deriveColors")}
                  hint={t("background.deriveHint")}
                  checked={bg.preset.colors === null}
                  onChange={(auto) =>
                    edit((th) => {
                      th.background.preset.colors = auto ? null : [th.accent, shiftHue(th.accent, 48), shiftHue(th.accent, -70)];
                    })
                  }
                />
                {bg.preset.colors && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {bg.preset.colors.map((c, i) => (
                      <ColorField key={i} label={t("background.color", { n: i + 1 })} value={c} onChange={(v) => edit((th) => { th.background.preset.colors![i] = v; })} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {bg.type === "gradient" && (
              <div className="mt-5 space-y-5">
                <div className="h-24 rounded-xl border" style={{ backgroundImage: gradientCss(bg.gradient) }} />
                <div>
                  <p className="label">{t("background.presetsLabel")}</p>
                  <div className="flex flex-wrap gap-2">
                    {GRADIENT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        title={t(`gradients.${p.id}`)}
                        aria-label={t("background.gradientLabel", { name: t(`gradients.${p.id}`) })}
                        onClick={() =>
                          edit((th) => {
                            th.background.gradient.kind = p.kind;
                            th.background.gradient.angle = p.angle;
                            th.background.gradient.stops = clone(p.stops);
                          })
                        }
                        className="h-10 w-16 rounded-lg border transition hover:scale-105"
                        style={{ backgroundImage: gradientCss({ ...bg.gradient, kind: p.kind, angle: p.angle, stops: p.stops }) }}
                      />
                    ))}
                  </div>
                </div>
                <Segmented
                  label={t("background.kindLabel")}
                  value={bg.gradient.kind}
                  onChange={(kind) => edit((th) => { th.background.gradient.kind = kind; })}
                  options={[
                    { value: "linear", label: t("background.kinds.linear") },
                    { value: "radial", label: t("background.kinds.radial") },
                    { value: "conic", label: t("background.kinds.conic") },
                  ]}
                />
                {bg.gradient.kind !== "radial" && (
                  <Slider label={t("background.angle")} value={bg.gradient.angle} min={0} max={360} unit="°" onChange={(v) => edit((th) => { th.background.gradient.angle = v; })} />
                )}
                <div className="space-y-4">
                  {bg.gradient.stops.map((s, i) => (
                    <div key={i} className="flex items-end gap-3">
                      <div className="grid flex-1 gap-3 sm:grid-cols-2">
                        <ColorField label={t("background.color", { n: i + 1 })} value={s.color} onChange={(v) => edit((th) => { th.background.gradient.stops[i].color = v; })} />
                        <Slider label={t("background.position")} value={s.pos} min={0} max={100} unit=" %" onChange={(v) => edit((th) => { th.background.gradient.stops[i].pos = v; })} />
                      </div>
                      <button
                        className="btn btn-ghost btn-icon"
                        aria-label={t("background.removeColor", { n: i + 1 })}
                        disabled={bg.gradient.stops.length <= 2}
                        onClick={() => edit((th) => { th.background.gradient.stops.splice(i, 1); })}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn btn-sm"
                    disabled={bg.gradient.stops.length >= 6}
                    onClick={() =>
                      edit((th) => {
                        const stops = th.background.gradient.stops;
                        stops.push({ color: shiftHue(stops[stops.length - 1].color, 40), pos: 100 });
                      })
                    }
                  >
                    <Plus size={14} /> {t("background.addColor")}
                  </button>
                </div>
                <Toggle label={t("background.animate")} checked={bg.gradient.animate} onChange={(v) => edit((th) => { th.background.gradient.animate = v; })} />
                {bg.gradient.animate && (
                  <Slider label={t("background.speed")} value={bg.gradient.speed} min={10} max={200} step={5} unit=" %" onChange={(v) => edit((th) => { th.background.gradient.speed = v; })} />
                )}
              </div>
            )}

            {bg.type === "image" && (
              <div className="mt-5 space-y-5">
                <div
                  className={cn("rounded-xl border-2 border-dashed p-6 text-center transition", uploading && "opacity-60")}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) void uploadFile(file);
                  }}
                >
                  <ImagePlus className="mx-auto text-muted" size={28} />
                  <p className="mt-2 text-sm">{t("background.dropHere")}</p>
                  <button className="btn btn-sm mt-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? t("background.uploading") : t("background.chooseFile")}
                  </button>
                  <p className="mt-2 text-xs text-muted">{t("background.fileHint")}</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadFile(file);
                    }}
                  />
                </div>

                {uploads.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {uploads.map((u) => {
                      const selected = bg.image.uploadId === u.id;
                      return (
                        <div key={u.id} className={cn("group relative aspect-video overflow-hidden rounded-lg border", selected && "border-accent ring-2 ring-accent/50")}>
                          <button className="absolute inset-0" onClick={() => edit((th) => { th.background.image.uploadId = u.id; })} aria-label={t("background.useImage")} aria-pressed={selected}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/uploads/${u.id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </button>
                          <button
                            className="absolute right-1 top-1 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                            onClick={() => void deleteUpload(u.id)}
                            aria-label={t("background.deleteImage")}
                          >
                            <Trash2 size={14} />
                          </button>
                          {selected && <Check size={16} className="absolute bottom-1 left-1 rounded-full bg-accent p-0.5 text-on-accent" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {bg.image.uploadId ? (
                  <div className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Slider label={t("background.blur")} value={bg.image.blur} min={0} max={30} unit=" px" onChange={(v) => edit((th) => { th.background.image.blur = v; })} />
                      <Slider label={t("background.dim")} value={bg.image.dim} min={0} max={90} unit=" %" onChange={(v) => edit((th) => { th.background.image.dim = v; })} />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Segmented
                        label={t("background.fitLabel")}
                        value={bg.image.fit}
                        onChange={(fit) => edit((th) => { th.background.image.fit = fit; })}
                        options={[
                          { value: "cover", label: t("background.fits.cover") },
                          { value: "contain", label: t("background.fits.contain") },
                          { value: "tile", label: t("background.fits.tile") },
                        ]}
                      />
                      <Segmented
                        label={t("background.positionLabel")}
                        value={bg.image.position}
                        onChange={(position) => edit((th) => { th.background.image.position = position; })}
                        options={[
                          { value: "center", label: t("background.positions.center") },
                          { value: "top", label: t("background.positions.top") },
                          { value: "bottom", label: t("background.positions.bottom") },
                          { value: "left", label: t("background.positions.left") },
                          { value: "right", label: t("background.positions.right") },
                        ]}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t("background.noImage")}</p>
                )}
              </div>
            )}

            <div className="mt-6 border-t pt-5">
              <Toggle label={t("background.grain")} hint={t("background.grainHint")} checked={bg.grain} onChange={(v) => edit((th) => { th.background.grain = v; })} />
            </div>
          </Section>
        </div>

        {/* ── Vorschau ──────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="glass space-y-4 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{t("preview.title")}</p>
            <div className="glass lift overflow-hidden p-4">
              <div className="-mx-4 -mt-4 mb-3 h-1.5" style={{ background: "linear-gradient(90deg, var(--vw-accent), var(--vw-bg-2))" }} />
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{t("preview.project")}</h3>
                <StatusBadge status="IN_PROGRESS" />
              </div>
              <p className="mt-1 text-sm text-muted">{t("preview.description")}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg/60">
                <div className="h-full rounded-full" style={{ width: "64%", background: "linear-gradient(90deg, var(--vw-accent), var(--vw-bg-2))" }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="chip">nextjs</span>
                <span className="chip chip-active">{t("preview.tag")}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_STATUSES.map((s) => (
                <StatusBadge key={s.value} status={s.value} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm" type="button">{t("preview.primary")}</button>
              <button className="btn btn-sm" type="button">{t("preview.secondary")}</button>
            </div>
            <input className="field" placeholder={t("preview.input")} aria-label={t("preview.inputLabel")} />
            <p className="text-sm">
              {t("preview.normal")} · <span className="text-muted">{t("preview.muted")}</span> · <span className="text-accent-ink underline">{t("preview.link")}</span>
            </p>
          </div>
        </aside>
      </div>

      {/* ── Speicherleiste ───────────────────────────────── */}
      <div className={cn("sticky bottom-3 z-30 mt-6 transition-opacity", dirty || notice || error ? "opacity-100" : "pointer-events-none opacity-0")}>
        <div className="glass-strong flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm">
            {error ? <span className="text-red-400">{error}</span> : dirty ? t("saveBar.unsaved") : notice}
          </span>
          {dirty && (
            <div className="flex gap-2">
              <button className="btn btn-sm" onClick={() => setDraft(clone(saved))}>
                <RotateCcw size={14} /> {t("saveBar.discard")}
              </button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
                <Save size={14} /> {busy ? tc("saving") : tc("save")}
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={t("shareModal.title")}
        size="lg"
        footer={
          <>
            <button className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(shareText)}>
              <ClipboardCopy size={14} /> {tc("copy")}
            </button>
            <button className="btn btn-primary btn-sm" onClick={importShare}>
              <Download size={14} /> {t("shareModal.apply")}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">{t("shareModal.hint")}</p>
        <textarea className="field min-h-72 font-mono text-xs" value={shareText} onChange={(e) => setShareText(e.target.value)} spellCheck={false} aria-label={t("shareModal.jsonLabel")} />
        <div className="mt-3">
          <FormError message={shareError} />
        </div>
      </Modal>
    </div>
  );
}
