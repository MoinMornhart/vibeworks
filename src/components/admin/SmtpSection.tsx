"use client";

import { useEffect, useState } from "react";
import { Mail, Save, Send } from "lucide-react";
import { FormError } from "@/components/ui/FormError";
import { Toggle } from "@/components/theme/controls";
import { api, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { AccountSection } from "@/components/account/AccountManager";

interface Smtp {
  host: string;
  port: number | null;
  secure: boolean;
  user: string;
  from: string;
  hasPassword: boolean;
}

/** SMTP für Benachrichtigungen per E-Mail – lädt sich selbst. */
export function SmtpSection() {
  const t = useT("notify");
  const [smtp, setSmtp] = useState<Smtp | null>(null);
  const [form, setForm] = useState({ host: "", port: "", secure: false, user: "", from: "" });
  const [password, setPassword] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = (s: Smtp) => {
    setSmtp(s);
    setForm({ host: s.host, port: s.port ? String(s.port) : "", secure: s.secure, user: s.user, from: s.from });
  };

  useEffect(() => {
    api<{ smtp: Smtp }>("/api/admin/smtp")
      .then((r) => apply(r.smtp))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const save = (passwordValue?: string | null) =>
    run(async () => {
      const res = await api<{ smtp: Smtp }>("/api/admin/smtp", {
        method: "PUT",
        body: {
          host: form.host,
          port: form.port ? Number(form.port) : null,
          secure: form.secure,
          user: form.user,
          from: form.from,
          password: passwordValue !== undefined ? passwordValue : password ? password : undefined,
        },
      });
      apply(res.smtp);
      setPassword("");
      setNotice(t("smtp.saved"));
    });

  const sendTest = () =>
    run(async () => {
      await api("/api/admin/smtp", { method: "POST", body: { to: testTo } });
      setNotice(t("smtp.testSent", { to: testTo }));
    });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <AccountSection icon={<Mail size={18} />} title={t("smtp.title")} description={t("smtp.description")}>
      {smtp && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div>
              <label className="label" htmlFor="smtp-host">{t("smtp.host")}</label>
              <input id="smtp-host" className="field" value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.example.de" maxLength={253} />
            </div>
            <div>
              <label className="label" htmlFor="smtp-port">{t("smtp.port")}</label>
              <input id="smtp-port" className="field" inputMode="numeric" value={form.port} onChange={(e) => set("port", e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder={form.secure ? "465" : "587"} />
            </div>
          </div>
          <Toggle label={t("smtp.secure")} checked={form.secure} onChange={(v) => set("secure", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="smtp-user">{t("smtp.user")}</label>
              <input id="smtp-user" className="field" autoComplete="off" value={form.user} onChange={(e) => set("user", e.target.value)} maxLength={254} />
            </div>
            <div>
              <label className="label" htmlFor="smtp-pass">{t("smtp.password")}</label>
              <input
                id="smtp-pass"
                type="password"
                autoComplete="new-password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={smtp.hasPassword ? t("smtp.passwordSaved") : ""}
                maxLength={500}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="smtp-from">{t("smtp.from")}</label>
            <input id="smtp-from" className="field" value={form.from} onChange={(e) => set("from", e.target.value)} placeholder={t("smtp.fromPlaceholder")} maxLength={254} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              <Save size={14} /> {t("smtp.save")}
            </button>
            {smtp.hasPassword && (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void save(null)}>{t("smtp.removePassword")}</button>
            )}
          </div>
          {smtp.host && smtp.from && (
            <div className="flex flex-wrap items-end gap-2 border-t pt-4">
              <div className="min-w-0 flex-1">
                <label className="label" htmlFor="smtp-test">{t("smtp.testTo")}</label>
                <input id="smtp-test" type="email" className="field" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="du@example.de" maxLength={254} />
              </div>
              <button type="button" className="btn btn-sm" disabled={busy || !testTo.trim()} onClick={() => void sendTest()}>
                <Send size={14} /> {t("smtp.testSend")}
              </button>
            </div>
          )}
        </form>
      )}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-400">{notice}</p>}
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </AccountSection>
  );
}
