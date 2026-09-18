const fs = require('fs');

let content = fs.readFileSync('src/components/account/DeviceConnect.tsx', 'utf8');

const search = `  if (done) {
    return (
      <section className="glass p-6" role="status" data-testid="device-done" data-result={done}>
        <p className="flex items-start gap-2">
          {done === "allowed" ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={20} className="mt-0.5 shrink-0 text-muted" />}
          {t(\`device.\${done}\`)}
        </p>
        {done === "allowed" && (
          <Link href="/account#mcp" className="btn btn-sm mt-4">
            {t("section.title")}
          </Link>
        )}
      </section>
    );
  }`;

const replace = `  if (done) {
    if (typeof window !== "undefined") {
      setTimeout(() => {
        try {
          window.close();
          setTimeout(() => { window.location.href = "/account#mcp"; }, 500); // Fallback
        } catch (e) {
          window.location.href = "/account#mcp"; // Fallback if close is blocked
        }
      }, 5000);
    }
    return (
      <section className="glass p-6" role="status" data-testid="device-done" data-result={done}>
        <p className="flex items-start gap-2">
          {done === "allowed" ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={20} className="mt-0.5 shrink-0 text-muted" />}
          {t(\`device.\${done}\`)}
        </p>
        <p className="mt-2 text-sm text-muted">{done === "allowed" ? t("device.autoCloseHint", { defaultValue: "Fenster schließt sich in 5 Sekunden..." }) : ""}</p>
        {done === "allowed" && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/account#mcp" className="btn btn-sm">
              {t("section.title")}
            </Link>
            <button className="btn btn-sm" onClick={() => window.close()}>
              {t("device.closeWindow", { defaultValue: "Fenster schließen" })}
            </button>
          </div>
        )}
      </section>
    );
  }`;

content = content.replace(search, replace);
fs.writeFileSync('src/components/account/DeviceConnect.tsx', content);
console.log('patched');
