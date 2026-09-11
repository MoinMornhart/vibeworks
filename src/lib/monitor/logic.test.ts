import { describe, expect, it } from "vitest";
import { extractImage, nextLiveState, sslStep } from "./logic";

describe("Zustandswechsel", () => {
  it("offline erst nach zwei Fehlschlägen, dann genau eine Meldung", () => {
    const one = nextLiveState({ state: "up", fails: 0 }, false);
    expect(one).toEqual({ state: "up", fails: 1, event: null });
    const two = nextLiveState(one, false);
    expect(two).toEqual({ state: "down", fails: 2, event: "down" });
    expect(nextLiveState(two, false).event).toBeNull();
  });

  it("wieder da meldet sich einmal, ein einzelner Aussetzer gar nicht", () => {
    expect(nextLiveState({ state: "down", fails: 3 }, true)).toEqual({ state: "up", fails: 0, event: "up" });
    expect(nextLiveState({ state: "up", fails: 1 }, true).event).toBeNull();
    expect(nextLiveState({ state: null, fails: 0 }, true)).toEqual({ state: "up", fails: 0, event: null });
  });
});

describe("SSL-Warnstufen", () => {
  it("14 Tage, dann 3 Tage, nach Verlängerung von vorn", () => {
    expect(sslStep(40, null)).toEqual({ notify: false, notified: null });
    expect(sslStep(12, null)).toEqual({ notify: true, notified: "14" });
    expect(sslStep(10, "14")).toEqual({ notify: false, notified: "14" });
    expect(sslStep(2, "14")).toEqual({ notify: true, notified: "3" });
    expect(sslStep(1, "3")).toEqual({ notify: false, notified: "3" });
    expect(sslStep(89, "3")).toEqual({ notify: false, notified: null });
  });
});

describe("Vorschaubild", () => {
  it("og:image vor twitter:image vor Icon, relativ aufgelöst", () => {
    const html = `<head><link rel="icon" href="/favicon.png"><meta name="twitter:image" content="/tw.png"><meta property="og:image" content="/og.png?a=1&amp;b=2"></head>`;
    expect(extractImage(html, "https://app.example.de/start")).toBe("https://app.example.de/og.png?a=1&b=2");
    expect(extractImage(`<meta content='https://cdn.example.de/t.jpg' name='twitter:image'>`, "https://x.de")).toBe("https://cdn.example.de/t.jpg");
    expect(extractImage(`<link rel="shortcut icon" href="img/i.png">`, "https://x.de/a/")).toBe("https://x.de/a/img/i.png");
    expect(extractImage(`<link rel="apple-touch-icon" href="/t.png"><link rel="icon" href="/i.png">`, "https://x.de")).toBe("https://x.de/t.png");
  });

  it("nichts Brauchbares → null", () => {
    expect(extractImage("<html><body>Hallo</body></html>", "https://x.de")).toBeNull();
    expect(extractImage(`<meta property="og:image" content="javascript:alert(1)">`, "https://x.de")).toBeNull();
  });
});
