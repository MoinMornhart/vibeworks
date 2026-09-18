#!/bin/bash
cat << 'INNER_EOF' > /tmp/DeviceConnect.patch
<<<<<<< SEARCH
  if (done) {
    return (
      <section className="glass p-6" role="status" data-testid="device-done" data-result={done}>
        <p className="flex items-start gap-2">
          {done === "allowed" ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={20} className="mt-0.5 shrink-0 text-muted" />}
          {t(`device.${done}`)}
        </p>
        {done === "allowed" && (
          <Link href="/account#mcp" className="btn btn-sm mt-4">
            {t("section.title")}
          </Link>
        )}
      </section>
    );
  }
=======
  if (done) {
    if (typeof window !== "undefined") {
      setTimeout(() => {
        if (!document.hidden) {
          window.close();
        }
      }, 5000);
    }
    return (
      <section className="glass p-6" role="status" data-testid="device-done" data-result={done}>
        <p className="flex items-start gap-2">
          {done === "allowed" ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={20} className="mt-0.5 shrink-0 text-muted" />}
          {t(`device.${done}`)}
        </p>
        <p className="mt-2 text-sm text-muted">{t("device.autoClose")}</p>
        {done === "allowed" && (
          <div className="flex gap-2 mt-4">
            <Link href="/account#mcp" className="btn btn-sm">
              {t("section.title")}
            </Link>
            <button className="btn btn-sm" onClick={() => window.close()}>Fenster schließen</button>
          </div>
        )}
      </section>
    );
  }
>>>>>>> REPLACE
INNER_EOF
