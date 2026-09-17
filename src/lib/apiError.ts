// Fehler mit HTTP-Status – eigene Datei, damit Anmeldung und Sitzung sie ohne
// den Rest von api.ts laden können (sonst Import-Zyklus, #73).

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

// Meldungen dürfen Übersetzungsschlüssel sein ("projects.errors.notFound",
// siehe tk()); route() übersetzt sie in die Sprache der Anfrage.
export const notFound = (what = "errors.notFound") => new ApiError(404, what);
