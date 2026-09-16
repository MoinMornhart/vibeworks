import { describe, expect, it } from "vitest";
import { installCommands, installPs1, installSh } from "./installer";

describe("MCP-Installer (#89)", () => {
  it("Einzeiler holen das Skript und geben den Schlüssel nur als Umgebungsvariable mit", () => {
    const c = installCommands("https://vw.example", "vw_abc");
    expect(c.sh).toBe("curl -fsSL https://vw.example/api/mcp/install/sh | VIBEWORKS_KEY=vw_abc sh");
    expect(c.ps1).toBe("$env:VIBEWORKS_KEY='vw_abc'; irm https://vw.example/api/mcp/install/ps1 | iex");
  });

  it("Skripte enthalten die Adresse, aber keinen Schlüssel", () => {
    for (const s of [installSh("https://vw.example"), installPs1("https://vw.example")]) {
      expect(s).toContain("https://vw.example");
      expect(s).toContain("/api/mcp/rules");
      expect(s).toContain("claude mcp add --scope user --transport http vibeworks");
      expect(s).not.toMatch(/vw_[A-Za-z0-9]{6,}/);
    }
  });

  it("Adresse kann nicht aus dem Anführungszeichen ausbrechen", () => {
    expect(installSh("https://x'; rm -rf ~; '")).toContain(`URL='https://x'\\''; rm -rf ~; '\\'''`);
    expect(installPs1("https://x'; Remove-Item ~; '")).toContain(`$Url = 'https://x''; Remove-Item ~; '''`);
  });
});

describe("PowerShell-Skript", () => {
  it("besteht nur aus ASCII (Windows PowerShell 5.1)", () => {
    expect(/^[\x00-\x7F]*$/.test(installPs1("https://vw.example"))).toBe(true);
  });
});
