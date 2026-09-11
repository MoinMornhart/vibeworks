"use client";

import { Fragment, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { DEFAULT_SERVER, newTokenUrl, normalizeServer, PROVIDER_LABEL, type GitProvider } from "@/lib/git/parse";
import { useT } from "@/lib/i18n/client";
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

/**
 * Übersetzten Text mit Platzhaltern wie {link} oder {button} ausgeben und
 * die Platzhalter durch React-Elemente ersetzen (Links, fette Knopfnamen …).
 */
export function richText(text: string, nodes: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/g).map((part, i) => {
    const name = part.match(/^\{(\w+)\}$/)?.[1];
    return <Fragment key={i}>{name && name in nodes ? nodes[name] : part}</Fragment>;
  });
}

function Steps({ provider, link }: { provider: GitProvider; link: string | null }) {
  const t = useT("git");
  const open = link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
      {provider === "gitea" ? t("fields.openGiteaSettings") : t("fields.openTokenPage", { provider: PROVIDER_LABEL[provider] })} <ExternalLink size={11} />
    </a>
  ) : (
    <span className="text-muted">{t("fields.needServer")}</span>
  );
  const steps =
    provider === "github"
      ? [
          richText(t("fields.steps.github1"), { link: open }),
          richText(t("fields.steps.github2"), { button: <b>Generate token</b> }),
          richText(t("fields.steps.copy"), { prefix: <code>ghp_</code> }),
        ]
      : provider === "gitlab"
        ? [
            richText(t("fields.steps.gitlab1"), { link: open }),
            richText(t("fields.steps.gitlab2"), { button: <b>Create personal access token</b> }),
            richText(t("fields.steps.copy"), { prefix: <code>glpat-</code> }),
          ]
        : [
            richText(t("fields.steps.gitea1"), { link: open }),
            richText(t("fields.steps.gitea2"), { read: <b>{t("fields.steps.giteaRead")}</b>, write: <b>{t("fields.steps.giteaWrite")}</b> }),
            richText(t("fields.steps.gitea3"), { button: <b>{t("fields.steps.giteaButton")}</b> }),
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
  const t = useT("git");
  const set = (patch: Partial<GitConnectionForm>) => onChange({ ...value, ...patch });
  const server = value.server || DEFAULT_SERVER[value.provider];
  const norm = normalizeServer(server);
  const link = norm ? newTokenUrl(value.provider, norm.baseUrl) : null;

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t("fields.providerGroup")} className="flex flex-wrap gap-2">
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
          <label className="label" htmlFor={`${idPrefix}-server`}>{t("fields.server")}</label>
          <input
            id={`${idPrefix}-server`}
            className="field"
            value={value.server}
            onChange={(e) => set({ server: e.target.value })}
            placeholder={value.provider === "gitlab" ? t("fields.serverPlaceholderGitlab") : t("fields.serverPlaceholderGitea")}
            maxLength={300}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-xs text-muted">
            {value.provider === "gitlab" ? t("fields.serverHintGitlab") : t("fields.serverHintGitea")}
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
        aria-label={t("fields.tokenLabel", { provider: PROVIDER_LABEL[value.provider] })}
        aria-invalid={Boolean(error)}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
