import { z } from "zod";

// Läuft im Browser vor jedem anderen Code der App. Zod 4 entscheidet schon
// beim Anlegen eines Schemas, ob es per new Function() prüft, ob eval erlaubt
// ist – unsere CSP verbietet eval, und Firefox meldet den abgefangenen
// Versuch trotzdem als Fehler (#24, #55). Hier gesetzt, gilt „jitless“ auch
// für Schemas aus Modulen, die zodSetup nicht selbst laden.
z.config({ jitless: true });
