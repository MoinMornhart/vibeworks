import { requireApiUser } from "@/lib/auth/guard";
import { findOwnDoc } from "@/lib/docs";
import { subscribeDoc } from "@/lib/docs/liveBus";

// Live-Kanal einer Leinwand (#211): Server-Sent Events. Der Besitzer hört hier
// mit, Änderungen aus einem anderen Tab/Gerät kommen sofort an – ohne Neuladen,
// ohne Zusatzdienst. Nur das eigene Dokument; fremde IDs gibt es nicht.

export const dynamic = "force-dynamic";

/** Alle 25 s ein Kommentar, damit Proxy und Browser die Verbindung offen halten. */
const HEARTBEAT_MS = 25_000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await requireApiUser();
  const doc = await findOwnDoc(user.id, (await params).id);
  if (!doc) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          /* Strom bereits zu */
        }
      };
      send(": ok\n\n");
      unsubscribe = subscribeDoc(doc.id, (event) => send(`data: ${JSON.stringify(event)}\n\n`));
      heartbeat = setInterval(() => send(": hb\n\n"), HEARTBEAT_MS);
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Verhindert, dass ein Proxy (nginx) die Ereignisse puffert
      "X-Accel-Buffering": "no",
    },
  });
}
