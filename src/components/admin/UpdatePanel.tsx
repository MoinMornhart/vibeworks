"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, CloudDownload, GitCommitHorizontal, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import type { PublicBuildInfo } from "@/lib/buildInfo";
import type { UpdateStatus } from "@/lib/selfUpdate";
import { api, errorMessage } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils";

interface UpdateResponse {
  available: boolean;
  installed: PublicBuildInfo;
  status: UpdateStatus | null;
  log: string[];
}

export function UpdatePanel({ initial }: { initial: UpdateResponse }) {
  const [data, setData] = useState(initial);
  // Seit wann (Serverzeit) auf eine Antwort gewartet wird
  const [waiting, setWaiting] = useState<{ action: "check" | "update"; since: string; at: number } | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const { status, installed, log } = data;
  const running = status?.state === "running";
  const fresh = (s: UpdateStatus | null, since: string) => Boolean(s && Date.parse(s.startedAt) >= Date.parse(since) - 5000);

  // Solange etwas läuft oder eine Anfrage offen ist: alle 1,5 s nachsehen.
  useEffect(() => {
    if (!waiting && !running) return;
    const timer = setInterval(async () => {
      try {
        const next = await api<UpdateResponse>("/api/admin/update");
        setRestarting(false);
        setData(next);
        if (waiting && fresh(next.status, waiting.since) && next.status!.state !== "running") {
          setWaiting(null);
          // Neue Version läuft → Seite neu laden, damit alles zur Version passt.
          if (next.status!.action === "update" && next.status!.state === "done" && next.installed.version !== installed.version) {
            setTimeout(() => window.location.reload(), 2500);
          }
        } else if (waiting && !fresh(next.status, waiting.since) && Date.now() - waiting.at > 30_000) {
          setWaiting(null);
          setError("Der Update-Dienst reagiert nicht. Läuft vibeworks-control.path? Alternativ im Container „update“ ausführen.");
        }
      } catch {
        // Während des Neustarts ist die App kurz nicht erreichbar.
        setRestarting(true);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [waiting, running, installed.version]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  async function send(action: "check" | "update") {
    if (action === "update" && !window.confirm("Das neueste Update jetzt installieren? VibeWorks startet dabei kurz neu.")) return;
    setError(null);
    try {
      const res = await api<{ requestedAt: string }>("/api/admin/update", { body: { action } });
      setWaiting({ action, since: res.requestedAt, at: Date.now() });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const latest = status?.action === "check" && status.state === "done" ? status.latest : null;
  const behind = latest?.behind ?? 0;
  const busy = Boolean(waiting) || running;

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span>Installiert: <strong className="font-mono">Version {installed.version}</strong></span>
        {installed.count !== null && <span className="text-muted">Update Nr. {installed.count}</span>}
        {installed.shortCommit && (
          <span className="inline-flex items-center gap-1 text-muted"><GitCommitHorizontal size={14} /><span className="font-mono">{installed.shortCommit}</span></span>
        )}
      </p>

      {!data.available ? (
        <p className="rounded-lg border bg-bg/30 px-3 py-2 text-sm text-muted">
          Update per Knopfdruck gibt es bei Installation über den Proxmox-Installer. Er wird beim nächsten automatischen Update eingerichtet – bis dahin im Container <code className="rounded bg-fg/10 px-1.5 font-mono text-xs">update</code> ausführen.
        </p>
      ) : (
        <>
          {latest && !busy && (
            behind > 0 ? (
              <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
                <p className="flex items-center gap-2 font-medium">
                  <CloudDownload size={18} className="text-accent-ink" />
                  Update verfügbar: Version {latest.version}
                  <span className="text-sm font-normal text-muted">({behind} {behind === 1 ? "neues Update" : "neue Updates"})</span>
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {latest.commits.map((c) => (
                    <li key={c.sha} className="flex gap-2"><span className="font-mono text-xs text-muted">{c.sha}</span><span>{c.subject}</span></li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-emerald-400">
                <CircleCheck size={16} /> VibeWorks ist aktuell <span className="text-muted">(geprüft {status?.finishedAt ? formatDateTime(status.finishedAt) : ""})</span>
              </p>
            )
          )}

          {busy && (
            <p className="flex items-center gap-2 text-sm">
              <Loader2 size={16} className="animate-spin text-accent-ink" />
              {restarting ? "VibeWorks startet neu …" : running ? status?.message : waiting?.action === "check" ? "Suche nach Updates …" : "Update wird gestartet …"}
            </p>
          )}

          {!busy && status && (status.state === "failed" || status.state === "busy") && (
            <p className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {status.message}
            </p>
          )}
          {!busy && status?.action === "update" && status.state === "done" && (
            <p className="flex items-center gap-2 text-sm text-emerald-400"><CircleCheck size={16} /> {status.message}</p>
          )}

          {status?.action === "update" && log.length > 0 && (running || status.state === "failed" || restarting) && (
            <pre ref={logRef} className="max-h-64 overflow-auto rounded-xl border bg-bg/60 p-3 font-mono text-[11px] leading-relaxed text-muted">{log.join("\n")}</pre>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => void send("check")} disabled={busy}>
              <RefreshCw size={14} /> Nach Updates suchen
            </button>
            <button className={behind > 0 ? "btn btn-primary btn-sm" : "btn btn-sm"} onClick={() => void send("update")} disabled={busy}>
              <CloudDownload size={14} /> Neuestes Update installieren
            </button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-muted">Unabhängig davon prüft der Server alle 15 Minuten selbst. Vor jeder Migration wird die Datenbank gesichert; antwortet die neue Version nicht, wird automatisch zurückgerollt.</p>
    </div>
  );
}
