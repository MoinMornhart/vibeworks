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

  it("öffnet Links in neuem Tab ohne Referrer", () => {
    expect(render("[VibeWorks](https://github.com)")).toContain('rel="noopener noreferrer nofollow"');
  });

  it("lädt keine fremden Bilder", () => {
    const html = render("![Zählpixel](https://tracker.example/p.gif)");
    expect(html).not.toContain("<img");
    expect(html).toContain("Zählpixel");
  });
});
