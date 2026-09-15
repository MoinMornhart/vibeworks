import { z } from "zod";

// Zod 4 prüft sonst per new Function(), ob eval erlaubt ist – unsere CSP
// verbietet eval, der Browser meldet den Versuch als Fehler in der Konsole
// (#24). Ohne JIT ist Zod minimal langsamer, dafür still. Wird von den
// Modulen geladen, die Zod im Browser nutzen.
z.config({ jitless: true });
