"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { guardedHref } from "@/lib/linkCheckLogic";

// Feste Basis: Server und Browser rendern gleich; ob ein absoluter Link wirklich
// intern ist, entscheidet die Hinweisseite mit der echten Adresse.
const LINK_BASE = "https://vibeworks.invalid";

// Markdown aus Benutzereingaben. Rohes HTML wird nicht interpretiert und
// alles Übrige läuft durch rehype-sanitize – sonst wäre jede Notiz ein
// XSS-Loch. Fremde Bilder werden nicht geladen (die CSP erlaubt ohnehin nur
// eigene), sondern als Link mit ihrem Alternativtext angezeigt.

export function Markdown({ children, className }: { children: string; className?: string }) {
  const t = useT("shell");
  return (
    <div className={cn("md", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          // Links laufen über die Hinweisseite (#65); gesperrte Ziele werden zu Text
          a: ({ node: _node, href, ...props }) => {
            const target = typeof href === "string" ? guardedHref(href, LINK_BASE) : null;
            // Ohne noreferrer: die Hinweisseite erkennt so, dass der Klick aus VibeWorks kam – sie selbst gibt nichts weiter
            return target ? <a {...props} href={target} target="_blank" rel="noopener nofollow" /> : <span {...props} />;
          },
          img: ({ src, alt }) =>
            typeof src === "string" && src && guardedHref(src, LINK_BASE) ? (
              <a href={guardedHref(src, LINK_BASE)!} target="_blank" rel="noopener nofollow" className="md-img">
                🖼 {alt || t("markdown.image")}
              </a>
            ) : null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
