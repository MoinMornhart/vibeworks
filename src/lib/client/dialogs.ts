// Eigene Rückfragen statt Browser-Popups (#109): confirmDialog und promptDialog
// schicken ein Ereignis an den DialogHost im Layout und warten auf die Antwort.
// Ist kein Host da (Seiten außerhalb des App-Rahmens), bleibt es beim Browser.

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  /** Rot hervorheben – fürs Löschen, Entfernen, Sperren */
  danger?: boolean;
}

export interface PromptOptions {
  title?: string;
  confirmLabel?: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}

export interface ChoiceOptions {
  title?: string;
  choices: Array<{ key: string; label: string; tone?: "primary" | "danger" | "plain" }>;
}

export type DialogRequest =
  | { kind: "confirm"; message: string; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: "choice"; message: string; options: ChoiceOptions; resolve: (key: string | null) => void }
  | { kind: "prompt"; message: string; options: PromptOptions; resolve: (value: string | null) => void };

export const DIALOG_EVENT = "vw-dialog";
const HOST_FLAG = "__vwDialogHost";

type HostWindow = Window & { [HOST_FLAG]?: boolean };

export function markDialogHost(on: boolean) {
  (window as HostWindow)[HOST_FLAG] = on;
}

const hasHost = () => typeof window !== "undefined" && Boolean((window as HostWindow)[HOST_FLAG]);

/** Rückfrage mit Ja/Abbrechen. */
export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!hasHost()) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent<DialogRequest>(DIALOG_EVENT, { detail: { kind: "confirm", message, options, resolve } })));
}

/** Eine von mehreren Möglichkeiten – null bei Esc oder Klick daneben. */
export function choiceDialog(message: string, options: ChoiceOptions): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!hasHost()) return Promise.resolve(window.confirm(message) ? (options.choices[0]?.key ?? null) : null);
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent<DialogRequest>(DIALOG_EVENT, { detail: { kind: "choice", message, options, resolve } })));
}

/** Eingabe abfragen – null bei Abbrechen. */
export function promptDialog(message: string, options: PromptOptions = {}): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!hasHost()) return Promise.resolve(window.prompt(message, options.defaultValue ?? ""));
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent<DialogRequest>(DIALOG_EVENT, { detail: { kind: "prompt", message, options, resolve } })));
}
