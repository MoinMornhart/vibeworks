import { describe, expect, it } from "vitest";
import { pickClientIp } from "./clientIpLogic";

describe("pickClientIp (#214 Sicherheitsrunde)", () => {
  it("nimmt bei einem Proxy die vom Proxy angehängte Adresse, nicht die vom Client gefälschte", () => {
    // Client schickt "1.2.3.4" als XFF, der Proxy hängt die echte Peer-Adresse an
    expect(pickClientIp("1.2.3.4, 203.0.113.7", null, 1)).toBe("203.0.113.7");
  });

  it("nimmt bei zwei Proxys den vorletzten Eintrag", () => {
    expect(pickClientIp("9.9.9.9, 203.0.113.7, 10.0.0.1", null, 2)).toBe("203.0.113.7");
  });

  it("vertraut X-Forwarded-For gar nicht bei 0 Hops", () => {
    expect(pickClientIp("1.2.3.4", "198.51.100.9", 0)).toBe("198.51.100.9");
  });

  it("fällt bei zu kurzer Liste auf den linkesten Eintrag zurück statt zu raten", () => {
    expect(pickClientIp("203.0.113.7", null, 2)).toBe("203.0.113.7");
  });

  it("nutzt X-Real-IP, wenn kein X-Forwarded-For da ist", () => {
    expect(pickClientIp(null, "198.51.100.9", 1)).toBe("198.51.100.9");
    expect(pickClientIp(null, null, 1)).toBe("unbekannt");
  });

  it("macht IPv4-im-IPv6-Gewand wieder lesbar", () => {
    expect(pickClientIp("::ffff:192.168.1.5", null, 1)).toBe("192.168.1.5");
  });
})
