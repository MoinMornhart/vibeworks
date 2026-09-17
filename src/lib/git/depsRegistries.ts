import { safeFetch } from "@/lib/security/ssrf";
import { stableLatest, type Advisory, type Severity } from "./depsLogic";
import { goProxyPath, type Ecosystem } from "./depsManifestLogic";

// Neueste Versionen und Sicherheitslücken je Ökosystem (#105) – nur freie,
// öffentliche Quellen ohne Schlüssel: die Paket-Registries und OSV.dev.

const UA = { "User-Agent": "VibeWorks (https://github.com/MoinMornhart/vibeworks)" };
const NPM = "https://registry.npmjs.org";

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const res = await safeFetch(url, { ...init, headers: { Accept: "application/json", ...UA, ...(init.headers as Record<string, string> | undefined) }, timeoutMs: 10_000 });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function getText(url: string): Promise<string | null> {
  try {
    const res = await safeFetch(url, { headers: UA, timeoutMs: 10_000 });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

const noV =(v: string | null | undefined) => (v ? v.replace(/^v/, "") : null);

/** Neueste stabile Version – null, wenn die Registry nichts weiß. */
export async function latestVersion(ecosystem: Ecosystem, name: string): Promise<string | null> {
  switch (ecosystem) {
    case "npm": {
      const data = await getJson<{ "dist-tags"?: { latest?: string }; versions?: Record<string, unknown> }>(`${NPM}/${name.replace("/", "%2F")}`, {
        headers: { Accept: "application/vnd.npm.install-v1+json" },
      });
      // Manche Pakete markieren einen Release Candidate als „latest“ – dann zählt die höchste stabile Version
      return data ? stableLatest(data["dist-tags"]?.latest ?? null, Object.keys(data.versions ?? {})) : null;
    }
    case "PyPI": {
      const data = await getJson<{ info?: { version?: string } }>(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
      return data?.info?.version ?? null;
    }
    case "crates.io": {
      const data = await getJson<{ crate?: { max_stable_version?: string; newest_version?: string } }>(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`);
      return data?.crate?.max_stable_version ?? data?.crate?.newest_version ?? null;
    }
    case "Go": {
      const data = await getJson<{ Version?: string }>(`https://proxy.golang.org/${goProxyPath(name)}/@latest`);
      return noV(data?.Version);
    }
    case "Packagist": {
      const data = await getJson<{ packages?: Record<string, Array<{ version?: string }>> }>(`https://repo.packagist.org/p2/${name}.json`);
      const versions = (data?.packages?.[name] ?? []).map((p) => noV(p.version)).filter((v): v is string => Boolean(v));
      return stableLatest(null, versions);
    }
    case "Maven": {
      const [g, a] = name.split(":");
      if (!g || !a || !/^[\w.-]+$/.test(g) || !/^[\w.-]+$/.test(a)) return null;
      // Maven Central direkt – die Suche dort antwortet oft langsam oder gar nicht
      const meta = await getText(`https://repo1.maven.org/maven2/${g.replace(/\./g, "/")}/${a}/maven-metadata.xml`);
      if (meta) {
        const versions = [...meta.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
        // Höchste stabile Version; nur Vorab- oder Sonderversionen (33.0-jre)? Dann die als „release“ markierte
        const best = stableLatest(null, versions) ?? meta.match(/<release>([^<]+)<\/release>/)?.[1] ?? null;
        if (best) return best;
      }
      const q = encodeURIComponent(`g:"${g}" AND a:"${a}"`);
      const data = await getJson<{ response?: { docs?: Array<{ latestVersion?: string }> } }>(`https://search.maven.org/solrsearch/select?q=${q}&rows=1&wt=json`);
      return data?.response?.docs?.[0]?.latestVersion ?? null;
    }
  }
}

const toSeverity = (s: string | undefined): Severity => {
  const v = (s ?? "").toLowerCase();
  if (v === "critical" || v === "high" || v === "moderate" || v === "low") return v;
  if (v === "medium") return "moderate";
  return "info";
};

/** npm: dieselbe Quelle wie „npm audit“. */
export async function npmAdvisories(versions: Record<string, string[]>): Promise<Record<string, Advisory[]>> {
  if (!Object.keys(versions).length) return {};
  try {
    const res = await safeFetch(`${NPM}/-/npm/v1/security/advisories/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...UA },
      body: JSON.stringify(versions),
      timeoutMs: 20_000,
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, Array<{ title?: string; severity?: string; url?: string }>>;
    const out: Record<string, Advisory[]> = {};
    for (const [name, list] of Object.entries(data)) {
      out[name] = (list ?? []).map((a) => ({ title: a.title ?? "", severity: toSeverity(a.severity), url: a.url ?? null }));
    }
    return out;
  } catch {
    return {};
  }
}

/** So viele Lücken werden je Prüfung im Detail nachgeschlagen (Titel, Schwere). */
const MAX_VULN_DETAILS = 80;
const DETAIL_PARALLEL = 10;
const osvLink = (id: string) => `https://osv.dev/vulnerability/${encodeURIComponent(id)}`;

/** Alle anderen Ökosysteme: OSV.dev – frei, ohne Schlüssel. Schlüssel des Ergebnisses: „Ökosystem:Name“. */
export async function osvAdvisories(items: Array<{ ecosystem: Ecosystem; name: string; version: string }>): Promise<Record<string, Advisory[]>> {
  if (!items.length) return {};
  const batch = await getJson<{ results?: Array<{ vulns?: Array<{ id: string }> }> }>("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries: items.map((i) => ({ package: { name: i.name, ecosystem: i.ecosystem }, version: i.version })) }),
  });
  const hits = new Map<string, string[]>();
  (batch?.results ?? []).forEach((r, idx) => {
    const ids = (r.vulns ?? []).map((v) => v.id);
    if (ids.length && items[idx]) hits.set(`${items[idx].ecosystem}:${items[idx].name}`, ids);
  });
  const details = new Map<string, Advisory>();
  const ids = [...new Set([...hits.values()].flat())].slice(0, MAX_VULN_DETAILS);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(DETAIL_PARALLEL, ids.length) }, async () => {
      while (next < ids.length) {
        const id = ids[next++];
        const v = await getJson<{ summary?: string; details?: string; database_specific?: { severity?: string } }>(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`);
        details.set(id, {
          title: v?.summary || v?.details?.split("\n")[0]?.slice(0, 200) || id,
          // Ohne Angabe zur Schwere: lieber „mittel“ als übersehen
          severity: v?.database_specific?.severity ? toSeverity(v.database_specific.severity) : "moderate",
          url: osvLink(id),
        });
      }
    }),
  );
  const out: Record<string, Advisory[]> = {};
  for (const [key, list] of hits) out[key] = list.map((id) => details.get(id) ?? { title: id, severity: "moderate", url: osvLink(id) });
  return out;
}
