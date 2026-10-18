// Live-Kanal für Leinwände (#211): ein kleiner Ereignisbus im Serverprozess.
// VibeWorks läuft als ein Node-Prozess (ein Server pro Instanz), deshalb reicht
// ein Bus im Speicher – kein zusätzlicher Dienst, keine Kosten. Gespeichert wird
// weiter ganz normal über PATCH; der Bus trägt die Änderung nur sofort an die
// anderen offenen Tabs/Geräte desselben Kontos.

export interface BoardLiveEvent {
  /** Der gespeicherte JSON-Inhalt der Leinwand. */
  content: string;
  /** Kennung des sendenden Tabs – der Empfänger überspringt sein eigenes Echo. */
  by: string;
}

type Listener = (event: BoardLiveEvent) => void;

const listeners = new Map<string, Set<Listener>>();

/** Auf Änderungen eines Dokuments hören; gibt die Abmeldung zurück. */
export function subscribeDoc(docId: string, listener: Listener): () => void {
  let set = listeners.get(docId);
  if (!set) {
    set = new Set();
    listeners.set(docId, set);
  }
  set.add(listener);
  return () => {
    const current = listeners.get(docId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(docId);
  };
}

/** Eine Änderung an alle Hörer dieses Dokuments geben. Wirft nie. */
export function publishDoc(docId: string, event: BoardLiveEvent): void {
  const set = listeners.get(docId);
  if (!set) return;
  set.forEach((listener) => {
    try {
      listener(event);
    } catch {
      /* ein kaputter Hörer darf die anderen nicht aufhalten */
    }
  });
}
