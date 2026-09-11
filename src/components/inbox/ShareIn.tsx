"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Send } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

/** „Teilen“ vom Handy: Text und Link prüfen, dann in den Eingang legen. */
export function ShareIn({ initialText, initialUrl }: { initialText: string; initialUrl: string | null }) {
  const t = useT("inbox");
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/inbox", { body: { text, url: initialUrl, source: "share" } });
      router.push("/inbox");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass fade-in mx-auto max-w-lg space-y-4 p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><Inbox size={20} className="text-accent-ink" /> {t("share.title")}</h1>
      <textarea className="field min-h-32" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} aria-label={t("placeholder")} autoFocus />
      {initialUrl && <p className="truncate text-xs text-accent-ink">{initialUrl}</p>}
      <FormError message={error} />
      <button className="btn btn-primary w-full" disabled={busy || !text.trim()}><Send size={15} /> {t("share.submit")}</button>
    </form>
  );
}
