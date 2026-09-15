// Passwortregeln ohne Server-Abhängigkeiten – der Server prüft damit, die
// Oberfläche zeigt sie beim Tippen als Häkchen.

export const PASSWORD_MIN = 12;

/** Mindestens ein Zeichen, das weder Buchstabe noch Ziffer ist – ein Leerzeichen zählt, Passphrasen bleiben also erlaubt. */
export const hasSpecial = (password: string) => /[^\p{L}\p{N}]/u.test(password);
