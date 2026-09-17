import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { COMMANDS, installUrl, makeState, noticeEmbed, parseInteraction, readState, reportDue, reportEmbed, textChannels, verifyDiscordSignature } from "./discordLogic";

describe("Discord (#105)", () => {
  it("prüft Signaturen wie Discord sie schickt", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
    const body = JSON.stringify({ type: 1 });
    const ts = "1726570000";
    const sig = sign(null, Buffer.from(ts + body), privateKey).toString("hex");
    expect(verifyDiscordSignature(raw, sig, ts, body)).toBe(true);
    expect(verifyDiscordSignature(raw, sig, ts, body + " ")).toBe(false);
    expect(verifyDiscordSignature(raw, sig, "1726570001", body)).toBe(false);
    expect(verifyDiscordSignature(raw, null, ts, body)).toBe(false);
    expect(verifyDiscordSignature("zz", sig, ts, body)).toBe(false);
  });

  it("State ist signiert, an das Konto gebunden und läuft ab", () => {
    const now = 1_000_000;
    const state = makeState("geheim", "user1", now);
    expect(readState("geheim", state, now + 60_000)).toBe("user1");
    expect(readState("anders", state, now)).toBeNull();
    expect(readState("geheim", state, now + 16 * 60_000)).toBeNull();
    const [payload, mac] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "admin", e: now + 60_000 })).toString("base64url");
    expect(readState("geheim", `${forged}.${mac}`, now)).toBeNull();
    expect(readState("geheim", payload, now)).toBeNull();
    expect(readState("geheim", null, now)).toBeNull();
  });

  it("Einladungs-Link mit knappen Rechten", () => {
    const url = new URL(installUrl("123", "https://vw.example", "s"));
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("scope")).toBe("bot applications.commands identify");
    expect(url.searchParams.get("permissions")).toBe("19456");
    expect(url.searchParams.get("redirect_uri")).toBe("https://vw.example/api/discord/callback");
    expect(url.searchParams.get("state")).toBe("s");
  });

  it("liest Befehle aus Server und Direktnachricht", () => {
    expect(parseInteraction({ type: 2, data: { name: "vibeworks", options: [{ name: "hier" }] }, guild_id: "g", channel_id: "c", channel: { name: "dev" }, member: { user: { id: "u" } }, locale: "de" })).toEqual({
      type: 2,
      command: "vibeworks",
      sub: "hier",
      userId: "u",
      guildId: "g",
      channelId: "c",
      channelName: "dev",
      locale: "de",
    });
    expect(parseInteraction({ type: 2, data: { name: "vibeworks", options: [{ name: "rm" }] }, user: { id: "u" }, locale: "en-US" })).toMatchObject({ sub: null, guildId: null, userId: "u", locale: "en" });
    expect(parseInteraction({ type: 1 })).toMatchObject({ type: 1, command: null });
    expect(parseInteraction("kaputt")).toBeNull();
    expect(COMMANDS[0].options.map((o) => o.name)).toEqual(["status", "aufgaben", "probleme", "hier"]);
  });

  it("nur Text- und Ankündigungskanäle, sortiert", () => {
    expect(textChannels([{ id: "1", name: "voice", type: 2 }, { id: "2", name: "b", type: 0, position: 2 }, { id: "3", name: "a", type: 5, position: 1 }, null])).toEqual([
      { id: "3", name: "a" },
      { id: "2", name: "b" },
    ]);
    expect(textChannels("x")).toEqual([]);
  });

  it("Bericht fällig: täglich ab 8, wöchentlich montags, einmal am Tag", () => {
    expect(reportDue("daily", null, "2026-09-17", 8, 4)).toBe(true);
    expect(reportDue("daily", null, "2026-09-17", 7, 4)).toBe(false);
    expect(reportDue("daily", "2026-09-17", "2026-09-17", 9, 4)).toBe(false);
    expect(reportDue("weekly", null, "2026-09-21", 9, 1)).toBe(true);
    expect(reportDue("weekly", null, "2026-09-17", 9, 4)).toBe(false);
    expect(reportDue("off", null, "2026-09-17", 9, 1)).toBe(false);
  });

  it("Bericht und Meldung halten Discords Grenzen ein", () => {
    const t = { title: "Bericht", open: "Offen", done: "Erledigt", doing: "In Arbeit", problems: "Probleme", none: "nichts", workflows: "Workflows", footer: "VibeWorks" };
    const e = reportEmbed(
      { period: "day", open: { todo: 3, doing: 1, blocked: 0, overdue: 0 }, done: Array.from({ length: 20 }, (_, i) => ({ title: `A${i}`, project: "P" })), doing: [], problems: [], workflows: [], url: "u" },
      t,
      (n) => `… +${n}`,
    );
    expect(e.color).toBe(0x34d399);
    expect(e.fields[1].value.split("\n")).toHaveLength(9);
    expect(e.fields[1].value).toContain("… +12");
    expect(e.fields[2].value).toBe("nichts");
    expect(e.fields.every((f) => f.value.length <= 1024)).toBe(true);
    const bad = reportEmbed({ period: "week", open: { todo: 0, doing: 0, blocked: 0, overdue: 0 }, done: [], doing: [], problems: ["CI rot"], workflows: [], url: "u" }, t, String);
    expect(bad.color).toBe(0xf87171);
    expect(noticeEmbed({ title: "x".repeat(300), message: "m", url: null, priority: "urgent" })).toEqual({ title: "x".repeat(256), description: "m", color: 0xef4444 });
  });
});
