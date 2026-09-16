import type { Shape } from "../types";

// Namensraum „links“: Hinweisseite für Links (#65).

const de = {
  title: "Link öffnen?",
  external: "Dieser Link führt aus VibeWorks hinaus zu:",
  internal: "Dieser Link führt zu einer Seite in VibeWorks.",
  blocked: "Dieser Link wurde gesperrt – er nutzt kein http(s) und könnte Code ausführen.",
  safe: "Nichts Auffälliges gefunden. Trotzdem: Gib auf fremden Seiten keine Zugangsdaten ein.",
  checked: "Geprüft wird nur die Adresse selbst – kein fremder Dienst erfährt, was du öffnest.",
  warningsTitle: "Das fällt auf:",
  warnings: {
    http: "Unverschlüsselt (http) – Mitlesen ist möglich.",
    ip: "Eine IP-Adresse statt eines Namens – typisch für Test- oder Schadseiten.",
    punycode: "Internationalisierte Domain (xn--) – kann bekannte Namen täuschend nachahmen.",
    unicode: "Sonderzeichen im Domainnamen – Buchstaben können wie andere aussehen.",
    shortener: "Kurz-Link – das eigentliche Ziel ist nicht sichtbar.",
    credentials: "Die Adresse enthält ein „@“ vor dem Host – der Teil davor ist nicht das Ziel.",
    port: "Ungewöhnlicher Port.",
    lookalike: "Der Name erinnert an eine bekannte Marke, gehört aber nicht zu ihr.",
    tld: "Endung, die oft für Täuschung genutzt wird.",
    subdomains: "Auffällig viele Unterdomains.",
  },
  open: "Link öffnen",
  back: "Zurück",
  redirect: "Weiter in {s} s …",
  stay: "Hier bleiben",
  skip: "Unauffällige Links künftig ohne Nachfrage öffnen",
  skipHint: "Gilt für diesen Browser und nur für Links, die du in VibeWorks anklickst. Auffällige Links fragen immer.",
  skipOn: "Unauffällige Links öffnen jetzt ohne Nachfrage.",
  skipOff: "Links werden wieder vorher geprüft.",
  opening: "Öffne …",
};

const en: Shape<typeof de> = {
  title: "Open link?",
  external: "This link leads out of VibeWorks to:",
  internal: "This link leads to a page in VibeWorks.",
  blocked: "This link was blocked – it doesn't use http(s) and could run code.",
  safe: "Nothing suspicious found. Still: don't enter credentials on unknown sites.",
  checked: "Only the address itself is checked – no third-party service learns what you open.",
  warningsTitle: "What stands out:",
  warnings: {
    http: "Unencrypted (http) – traffic can be read.",
    ip: "An IP address instead of a name – typical for test or malicious sites.",
    punycode: "Internationalized domain (xn--) – can deceptively imitate well-known names.",
    unicode: "Special characters in the domain – letters can look like others.",
    shortener: "Short link – the real destination isn't visible.",
    credentials: "The address contains an “@” before the host – the part before it is not the destination.",
    port: "Unusual port.",
    lookalike: "The name resembles a well-known brand but doesn't belong to it.",
    tld: "An ending often used for deception.",
    subdomains: "Unusually many subdomains.",
  },
  open: "Open link",
  back: "Back",
  redirect: "Continuing in {s} s …",
  stay: "Stay here",
  skip: "Open unsuspicious links without asking from now on",
  skipHint: "Applies to this browser and only to links you click inside VibeWorks. Suspicious links always ask.",
  skipOn: "Unsuspicious links now open without asking.",
  skipOff: "Links are checked first again.",
  opening: "Opening …",
};

export default { de, en };
