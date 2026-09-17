"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ShieldAlert, ShieldX } from "lucide-react";
import type { LoginCheckView } from "@/lib/auth/loginAlert";
import { api, errorMessage } from "@/lib/client/api";
import { confirmDialog } from "@/lib/client/dialogs";
import { FormError } from "@/components/ui/FormError";
import { useFormat, useT } from "@/lib/i18n/client";

/** Nachfrage nach einer Notfall-Anmeldung (#109): bestätigen oder alle Sitzungen beenden. */
export function LoginCheck({ token }: { token: string }) {
  const t = useT("auth");
  const f = useFormat();
  const [check, setCheck] = useState<LoginCheckView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"ok" | "revoked" | null>(null);

  useEffect(() => {
    api<{ check: LoginCheckView | null }>(`/api/auth/login-check?token=${encodeURIComponent(token)}`)
      .then((r) => setCheck(r.check))
      .catch(() => setCheck(null));
  }, [token]);

  async function answer(action: "ok" | "revoked") {
    if (action === "revoked" && !(await confirmDialog(t("mfa.check.confirmRevoke"), { danger: true }))) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login-check", { body: { token, action } });
      setDone(action);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (check === undefined) return <p className="text-sm text-muted">…</p>;
  if (done || check?.answer) {
    const state = done ?? (check!.answer === "revoked" ? "revoked" : "ok");
    return (
      <div className="space-y-4 text-sm">
        <p className={state === "revoked" ? "text-amber-400" : "text-emerald-400"} data-testid="login-check-result">
          {done ? t(`mfa.check.answered${state === "ok" ? "Ok" : "Revoked"}`) : t(`mfa.check.already${state === "ok" ? "Ok" : "Revoked"}`)}
        </p>
        <Link href="/login" className="btn btn-primary w-full">
          {t("mfa.check.toLogin")}
        </Link>
      </div>
    );
  }
  if (!check) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-muted" data-testid="login-check-gone">
          {t("mfa.check.gone")}
        </p>
        <Link href="/login" className="btn w-full">
          {t("mfa.check.toLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="login-check">
      <dl className="space-y-1 rounded-xl border px-3 py-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted">{t("mfa.check.when")}</dt>
          <dd suppressHydrationWarning>{f.dateTime(check.at)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted">{t("mfa.check.from")}</dt>
          <dd>{check.ip || "–"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted">{t("mfa.check.device")}</dt>
          <dd className="min-w-0 break-words">{check.userAgent || "–"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted">{t("mfa.check.methodLabel")}</dt>
          <dd className="flex items-center gap-1.5">
            <ShieldAlert size={15} className="shrink-0 text-amber-400" /> {t(`mfa.check.method.${check.method}`)}
          </dd>
        </div>
      </dl>
      <FormError message={error} />
      <div className="flex flex-col gap-2">
        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void answer("ok")} data-testid="login-check-ok">
          <Check size={16} /> {t("mfa.check.ok")}
        </button>
        <button type="button" className="btn w-full hover:!text-red-400" disabled={busy} onClick={() => void answer("revoked")} data-testid="login-check-revoke">
          <ShieldX size={16} /> {t("mfa.check.revoke")}
        </button>
      </div>
    </div>
  );
}
