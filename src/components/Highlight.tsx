import { splitHighlights } from "@/lib/search";

/** Treffertext mit hervorgehobenen Fundstellen – alles als Text, nie als HTML. */
export function Highlight({ text }: { text: string }) {
  return (
    <>
      {splitHighlights(text).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded bg-accent/25 px-0.5 text-fg">{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
