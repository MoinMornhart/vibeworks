import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./Markdown";

const render = (md: string) => renderToStaticMarkup(<Markdown>{md}</Markdown>);

describe("Markdown", () => {
  it("interpretiert kein rohes HTML", () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });

  it("entfernt javascript:-Links", () => {
    expect(render("[klick](javascript:alert(1))")).not.toContain("javascript:");
  });

  it("macht aus - [ ] echte Checklisten", () => {
    const html = render("- [ ] offen\n- [x] erledigt");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("öffnet externe Links in neuem Tab über die Hinweisseite (#65)", () => {
    const html = render("[VibeWorks](https://github.com)");
    expect(html).toContain('href="/go?to=https%3A%2F%2Fgithub.com%2F"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener nofollow"');
  });

  it("interne Links direkt, Bild-Links ebenfalls über die Hinweisseite", () => {
    expect(render("[Aufgaben](/tasks)")).toContain('href="/tasks"');
    expect(render("![Bild](https://tracker.example/p.gif)")).toContain("/go?to=https%3A%2F%2Ftracker.example%2Fp.gif");
  });

  it("lädt keine fremden Bilder", () => {
    const html = render("![Zählpixel](https://tracker.example/p.gif)");
    expect(html).not.toContain("<img");
    expect(html).toContain("Zählpixel");
  });
});
