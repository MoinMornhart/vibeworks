"use client";

import { useState } from "react";
import type { Recurrence, TaskStatus } from "@/generated/prisma/client";
import { Info, Save, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import type { TaskItem } from "@/lib/tasks";
import { RECURRENCES } from "@/lib/taskDates";
import { PRIORITIES, TASK_STATUSES } from "@/lib/status";
import { Segmented } from "@/components/theme/controls";
import { ApiClientError, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { usePathname } from "next/navigation";
import { useDraft, useLeaveGuard } from "@/lib/client/draft";
import { DraftNote } from "@/components/ui/DraftNote";
import type { ExtraColumn } from "@/lib/boardConfig";
import { confirmDialog } from "@/lib/client/dialogs";

export interface TaskForm {
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string;
  labels: string;
  recurrence: Recurrence | "";
  assignee: string;
  priority: number;
  /** Für KI gesperrt (#76) */
  aiLocked: boolean;
  /** Zusatz-Spalte (#76) */
  column: string | null;
}

function toForm(t: TaskItem | null, status: TaskStatus, initial?: Partial<TaskForm>): TaskForm {
  return {
    ...EMPTY,
    ...(t ? {} : initial),
    ...(t ? fromTask(t) : {}),
    status: t?.status ?? initial?.status ?? status,
  };
}

const EMPTY: TaskForm = { title: "", description: "", status: "TODO", dueDate: "", labels: "", recurrence: "", assignee: "", priority: 2, aiLocked: false, column: null };

function fromTask(t: TaskItem): TaskForm {
  return {
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    dueDate: t.dueDate ?? "",
    labels: t.labels.join(", "),
    recurrence: t.recurrence ?? "",
    assignee: t.assignee ?? "",
    priority: t.priority,
    aiLocked: t.aiLocked,
    column: t.column,
  };
}

export function TaskDialog({
  open,
  task,
  defaultStatus = "TODO",
  onClose,
  onSave,
  onDelete,
  people = [],
  onInfo,
  initial,
  statusLabels,
  extraColumns = [],
}: {
  open: boolean;
  task: TaskItem | null;
  defaultStatus?: TaskStatus;
  onClose: () => void;
  onSave: (form: TaskForm) => Promise<void>;
  onDelete?: (task: TaskItem) => Promise<void>;
  /** Vorschläge für „Bearbeiter“: die Leute im Projekt */
  people?: Array<{ username: string; name: string }>;
  /** Info-Fenster öffnen (Verlauf, KI-Schritte, Commits) */
  onInfo?: (task: TaskItem) => void;
  /** Vorausgefüllte neue Aufgabe (z. B. aus dem Repo-Check) */
  initial?: Partial<TaskForm>;
  /** Eigene Spaltennamen des Projekts (#72) */
  statusLabels?: Partial<Record<TaskStatus, string>>;
  /** Zusatz-Spalten des Bretts (#76) */
  extraColumns?: ExtraColumn[];
}) {
  const t = useT("tasks");
  const tc = useT("common");
  const ts = useT("status");
  const [form, setForm] = useState<TaskForm>(() => toForm(task, defaultStatus, initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Beim Öffnen (oder anderer Aufgabe) sofort im selben Durchlauf zurücksetzen –
  // sonst blitzt kurz der alte Stand auf und gilt als ungespeicherte Eingabe (#109)
  const [shownFor, setShownFor] = useState<{ open: boolean; task: TaskItem | null; status: TaskStatus | undefined }>({ open, task, status: defaultStatus });
  if (shownFor.open !== open || shownFor.task !== task || shownFor.status !== defaultStatus) {
    setShownFor({ open, task, status: defaultStatus });
    if (open) {
      setForm(toForm(task, defaultStatus, initial));
      setError(null);
      setFieldErrors({});
    }
  }

  const set = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Neue Aufgabe: Entwurf je Seite merken – die Spalte kommt weiter vom Klick
  const pathname = usePathname();
  const draft = useDraft(
    open && !task && !initial ? `task-new:${pathname}` : null,
    form,
    (d) => setForm((f) => ({ ...f, title: d.title, description: d.description, dueDate: d.dueDate, labels: d.labels, recurrence: d.recurrence, assignee: d.assignee, priority: d.priority ?? 2 })),
    (f) => !f.title.trim() && !f.description.trim(),
  );

  // Ungespeichertes: beim Schließen nachfragen (#109)
  const draftKey = open && !task && !initial;
  const dirty = open && (draftKey ? Boolean(form.title.trim() || form.description.trim()) : JSON.stringify(form) !== JSON.stringify(toForm(task, defaultStatus, initial)));
  const guard = useLeaveGuard({ dirty: dirty && !busy, draftable: Boolean(draftKey), onDiscard: () => draft.discard() });
  const requestClose = () => void guard(onClose);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(form);
      draft.discard();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!task || !onDelete || !(await confirmDialog(t("dialog.confirmDelete", { title: task.title }), { danger: true }))) return;
    setBusy(true);
    try {
      await onDelete(task);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={task ? t("dialog.editTitle") : t("dialog.newTitle")}
      footer={
        <>
          {task && onDelete && (
            <button type="button" className="btn btn-danger btn-sm mr-auto" onClick={remove} disabled={busy}>
              <Trash2 size={14} /> {tc("delete")}
            </button>
          )}
          {task && onInfo && (
            <button type="button" className="btn btn-sm" onClick={() => onInfo(task)} data-testid="task-dialog-info">
              <Info size={14} /> {t("info.button")}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={requestClose}>{tc("cancel")}</button>
          <button type="submit" form="task-form" className="btn btn-primary btn-sm" disabled={busy}>
            <Save size={14} /> {busy ? tc("saving") : task ? tc("save") : tc("create")}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="t-title">{t("dialog.title")}</label>
          <input id="t-title" className="field" value={form.title} onChange={(e) => set("title", e.target.value)} required maxLength={200} autoFocus />
          {fieldErrors.title && <p className="mt-1 text-xs text-red-400">{fieldErrors.title}</p>}
          {task?.createdByName && (
            <p className="mt-1 text-xs text-muted" data-testid="task-created-by">
              {t(task.createdVia === "mcp" ? "dialog.createdByAi" : "dialog.createdBy", { name: task.createdByName })}
            </p>
          )}
          {task?.createdVia === "auto" && <p className="mt-1 text-xs text-muted">{t("dialog.createdAuto")}</p>}
        </div>
        {task?.aiNote && (
          <div className="rounded-lg border border-sky-400/30 bg-sky-400/5 px-3 py-2 text-sm" data-testid="task-dialog-ai-note">
            <p className="text-xs font-medium text-sky-300">{t("info.noteInDialog")}</p>
            <p className="whitespace-pre-wrap break-words">{task.aiNote}</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="t-desc">{t("dialog.description")}</label>
          <textarea id="t-desc" className="field min-h-28" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("dialog.descriptionPlaceholder")} maxLength={20000} />
        </div>
        <div data-testid="task-priority">
          <span className="label">{t("dialog.priority")}</span>
          <Segmented
            label={t("dialog.priority")}
            value={String(form.priority)}
            onChange={(v) => set("priority", Number(v))}
            options={PRIORITIES.map((p) => ({ value: String(p.value), label: ts(`priority.${String(p.value) as "1" | "2" | "3" | "4"}`) }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="t-status">{t("dialog.column")}</label>
            <select
              id="t-status"
              className="field"
              value={extraColumns.some((x) => x.key === form.column && x.base === form.status) ? form.column! : form.status}
              onChange={(e) => {
                const extra = extraColumns.find((x) => x.key === e.target.value);
                setForm((f) => (extra ? { ...f, status: extra.base, column: extra.key } : { ...f, status: e.target.value as TaskStatus, column: null }));
              }}
            >
              {TASK_STATUSES.flatMap((s) => [
                <option key={s.value} value={s.value}>{statusLabels?.[s.value] || ts(`task.${s.value}`)}</option>,
                ...extraColumns
                  .filter((x) => x.base === s.value)
                  .map((x) => (
                    <option key={x.key} value={x.key}>
                      ↳ {x.label}
                    </option>
                  )),
              ])}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-due">{t("dialog.dueDate")}</label>
            <input id="t-due" type="date" className="field" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            {fieldErrors.dueDate && <p className="mt-1 text-xs text-red-400">{fieldErrors.dueDate}</p>}
          </div>
          <div>
            <label className="label" htmlFor="t-rec">{t("dialog.recurrence")}</label>
            <select id="t-rec" className="field" value={form.recurrence} onChange={(e) => set("recurrence", e.target.value as Recurrence | "")}>
              <option value="">{t("dialog.noRecurrence")}</option>
              {RECURRENCES.map((r) => (
                <option key={r.value} value={r.value}>{ts(`recurrence.${r.value}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-labels">{t("dialog.labels")}</label>
            <input id="t-labels" className="field" value={form.labels} onChange={(e) => set("labels", e.target.value)} placeholder={t("dialog.labelsPlaceholder")} />
          </div>
          <div>
            <label className="label" htmlFor="t-assignee">{t("dialog.assignee")}</label>
            <input
              id="t-assignee"
              className="field"
              value={form.assignee}
              onChange={(e) => set("assignee", e.target.value)}
              placeholder={t("dialog.assigneePlaceholder")}
              maxLength={60}
              list="t-assignee-list"
              autoComplete="off"
            />
            <datalist id="t-assignee-list">
              {people.map((p) => (
                <option key={p.username} value={p.name} label={`@${p.username}`} />
              ))}
              <option value="Claude" />
            </datalist>
            {task && task.issueAssignees.length > 0 && <p className="mt-1 text-xs text-muted">{t("dialog.issueAssignees", { list: task.issueAssignees.join(", ") })}</p>}
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm" data-testid="task-dialog-ai-lock">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--vw-accent)]" checked={form.aiLocked} onChange={(e) => setForm((f) => ({ ...f, aiLocked: e.target.checked }))} />
          <span>
            <span className="font-medium">🔒 {t("aiLock.task")}</span>
            <span className="block text-xs text-muted">{t("aiLock.taskHint")}</span>
          </span>
        </label>
        {form.recurrence && (
          <p className="text-xs text-muted">
            {t("dialog.recurrenceHint")}
          </p>
        )}
        <DraftNote
          show={draft.restored}
          onDiscard={() => {
            draft.discard();
            setForm(toForm(null, defaultStatus));
          }}
        />
        <FormError message={error} />
      </form>
    </Modal>
  );
}
