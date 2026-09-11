"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

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
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
          img: ({ src, alt }) =>
            typeof src === "string" && src ? (
              <a href={src} target="_blank" rel="noopener noreferrer nofollow" className="md-img">
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
