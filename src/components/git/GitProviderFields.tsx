"use client";

import { ExternalLink } from "lucide-react";
import { DEFAULT_SERVER, newTokenUrl, normalizeServer, PROVIDER_LABEL, type GitProvider } from "@/lib/git/parse";
import { cn } from "@/lib/utils";

export interface GitConnectionForm {
  provider: GitProvider;
  server: string;
  token: string;
}

export const EMPTY_GIT_CONNECTION: GitConnectionForm = { provider: "github", server: "", token: "" };

const PROVIDERS: Array<{ value: GitProvider; label: string }> = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "gitea", label: "Gitea / Forgejo" },
];

const TOKEN_PREFIX: Record<GitProvider, string> = { github: "ghp_…", gitlab: "glpat-…", gitea: "Token" };

function Steps({ provider, link }: { provider: GitProvider; link: string | null }) {
  const open = link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
      {provider === "gitea" ? "Einstellungen → Anwendungen öffnen" : `Token-Seite von ${PROVIDER_LABEL[provider]} öffnen`} <ExternalLink size={11} />
    </a>
  ) : (
    <span className="text-muted">Erst oben die Serveradresse eintragen – dann erscheint hier der Link</span>
  );
  const steps =
    provider === "github"
      ? [<>{open} – Name und Recht „repo“ sind schon vorausgefüllt.</>, <>Bei „Expiration“ eine Laufzeit wählen, ganz unten auf <b>Generate token</b> klicken.</>, <>Den Token (beginnt mit <code>ghp_</code>) kopieren und hier einfügen.</>]
      : provider === "gitlab"
        ? [<>{open} – Name und Recht „api“ sind schon vorausgefüllt.</>, <>Ablaufdatum wählen und auf <b>Create personal access token</b> klicken.</>, <>Den Token (beginnt mit <code>glpat-</code>) kopieren und hier einfügen.</>]
        : [
            <>{open}.</>,
            <>Unter „Token generieren“ einen Namen eingeben (z. B. VibeWorks) und die Berechtigungen <b>repository: Lesen</b> und <b>issue: Lesen und Schreiben</b> wählen.</>,
            <>Auf <b>Token generieren</b> klicken, den Token kopieren und hier einfügen.</>,
          ];
  return (
    <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
      {steps.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  );
}

/**
 * Anbieter wählen, Server angeben (außer bei GitHub), Anleitung lesen, Token
 * einfügen – gemeinsam für „Mein Konto“, Registrierung und Einrichtung.
 */
export function GitProviderFields({
  value,
  onChange,
  error,
  idPrefix = "git",
}: {
  value: GitConnectionForm;
  onChange: (v: GitConnectionForm) => void;
  error?: string;
  idPrefix?: string;
}) {
  const set = (patch: Partial<GitConnectionForm>) => onChange({ ...value, ...patch });
  const server = value.server || DEFAULT_SERVER[value.provider];
  const norm = normalizeServer(server);
  const link = norm ? newTokenUrl(value.provider, norm.baseUrl) : null;

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Git-Anbieter" className="flex flex-wrap gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={value.provider === p.value}
            onClick={() => set({ provider: p.value, server: "" })}
            className={cn("chip", value.provider === p.value && "chip-active")}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.provider !== "github" && (
        <div>
          <label className="label" htmlFor={`${idPrefix}-server`}>Server</label>
          <input
            id={`${idPrefix}-server`}
            className="field"
            value={value.server}
            onChange={(e) => set({ server: e.target.value })}
            placeholder={value.provider === "gitlab" ? "gitlab.com oder eigener Server" : "git.example.de, codeberg.org oder http://192.168.1.5:3000"}
            maxLength={300}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-xs text-muted">
            {value.provider === "gitlab" ? "Leer lassen für gitlab.com." : "Adresse deiner Gitea- oder Forgejo-Instanz – auch selbst gehostet im Heimnetz."}
          </p>
        </div>
      )}

      <Steps provider={value.provider} link={link} />

      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        className={cn("field font-mono", error && "!border-red-500/60")}
        placeholder={TOKEN_PREFIX[value.provider]}
        value={value.token}
        onChange={(e) => set({ token: e.target.value })}
        maxLength={500}
        aria-label={`Token für ${PROVIDER_LABEL[value.provider]}`}
        aria-invalid={Boolean(error)}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
