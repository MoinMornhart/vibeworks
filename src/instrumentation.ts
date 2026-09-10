// Läuft einmal beim Start des Servers (Next.js-Instrumentation). Der Import
// steht bewusst direkt im NEXT_RUNTIME-Zweig: Next.js ersetzt die Variable beim
// Bauen, sodass der Node-Teil (Datenbank, node:crypto …) nicht in die
// Edge-Laufzeit der Middleware gerät.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
