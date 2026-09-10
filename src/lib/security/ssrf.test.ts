import { describe, expect, it } from "vitest";
import { isBlockedIp } from "./ssrf";

describe("isBlockedIp", () => {
  it("sperrt Loopback, Link-Local, Metadaten, CGNAT und Multicast", () => {
    for (const ip of ["127.0.0.1", "0.0.0.0", "169.254.169.254", "100.64.0.1", "224.0.0.1", "::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("erlaubt öffentliche Adressen und standardmäßig das private LAN", () => {
    for (const ip of ["140.82.121.4", "2606:4700::1111", "192.168.1.50", "10.0.0.5", "172.20.1.1"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("sperrt das private LAN auf Wunsch", () => {
    for (const ip of ["192.168.1.50", "10.0.0.5", "172.20.1.1", "fd00::1"]) {
      expect(isBlockedIp(ip, { blockPrivate: true }), ip).toBe(true);
    }
  });

  it("Loopback nur mit ausdrücklicher Erlaubnis", () => {
    expect(isBlockedIp("127.0.0.1", { allowLoopback: true })).toBe(false);
    expect(isBlockedIp("169.254.169.254", { allowLoopback: true })).toBe(true);
  });

  it("Unsinn ist gesperrt", () => {
    expect(isBlockedIp("keine-ip")).toBe(true);
  });
});
