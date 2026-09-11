export type Vars = Record<string, string | number>;

/** Ein Text – oder eine Funktion für Einzahl/Mehrzahl (siehe plural()). */
export type Msg = string | ((vars: Vars) => string);
export interface MsgTree {
  [key: string]: Msg | MsgTree;
}

/**
 * Jede weitere Sprache muss exakt dieselbe Form haben wie die deutsche
 * Fassung – fehlt ein Schlüssel oder ist einer zu viel, meldet TypeScript das.
 */
export type Shape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends (vars: Vars) => string ? (vars: Vars) => string : Shape<T[K]>;
};

/** Alle Blatt-Schlüssel eines Baums als "a.b.c". */
export type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | ((vars: Vars) => string) ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
