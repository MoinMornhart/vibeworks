#!/bin/bash
cat << 'INNER_EOF' > /tmp/ProjectHeader.patch
<<<<<<< SEARCH
  const tsl = useT("slides");
  const [mdOpen, setMdOpen] = useState(false);

  async function resurrect() {
=======
  const tsl = useT("slides");
  const [mdOpen, setMdOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  async function resurrect() {
>>>>>>> REPLACE
<<<<<<< SEARCH
      <section className="glass p-6 sm:p-8">
        <h2 className="mb-3 text-lg font-semibold">{t("header.description")}</h2>
        {p.description ? (
          <Markdown>{p.description}</Markdown>
        ) : (
          <p className="text-muted">
            {t("header.noDescription")}
            {canEdit && (
              <>
                {" "}
                <button className="text-accent-ink hover:underline" onClick={() => setEditOpen(true)}>{t("header.addNow")}</button>
              </>
            )}
          </p>
        )}
      </section>
=======
      <section className="glass p-6 sm:p-8">
        <button
          className="flex w-full items-center justify-between text-left group"
          onClick={() => setDescOpen(!descOpen)}
          aria-expanded={descOpen}
        >
          <h2 className="text-lg font-semibold">{t("header.description")}</h2>
          <svg
            className={`h-5 w-5 text-muted transition-transform group-hover:text-fg ${descOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {descOpen && (
          <div className="mt-4 border-t border-fg/10 pt-4">
            {p.description ? (
              <Markdown>{p.description}</Markdown>
            ) : (
              <p className="text-muted">
                {t("header.noDescription")}
                {canEdit && (
                  <>
                    {" "}
                    <button className="text-accent-ink hover:underline" onClick={() => setEditOpen(true)}>{t("header.addNow")}</button>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </section>
>>>>>>> REPLACE
INNER_EOF
