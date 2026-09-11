"use client";

import { useEffect, useState } from "react";
import type { Recurrence, TaskStatus } from "@prisma/client";
import { Save, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";
import type { TaskItem } from "@/lib/tasks";
import { RECURRENCES } from "@/lib/taskDates";
import { TASK_STATUSES } from "@/lib/status";
import { ApiClientError, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

export interface TaskForm {
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string;
  labels: string;
  recurrence: Recurrence | "";
}

function toForm(t: TaskItem | null, status: TaskStatus): TaskForm {
  return {
    title: t?.title ?? "",
    description: t?.description ?? "",
    status: t?.status ?? status,
    dueDate: t?.dueDate ?? "",
    labels: t?.labels.join(", ") ?? "",
    recurrence: t?.recurrence ?? "",
  };
}

export function TaskDialog({
  open,
  task,
  defaultStatus = "TODO",
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  task: TaskItem | null;
  defaultStatus?: TaskStatus;
  onClose: () => void;
  onSave: (form: TaskForm) => Promise<void>;
  onDelete?: (task: TaskItem) => Promise<void>;
}) {
  const t = useT("tasks");
  const tc = useT("common");
  const ts = useT("status");
  const [form, setForm] = useState<TaskForm>(() => toForm(task, defaultStatus));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(toForm(task, defaultStatus));
      setError(null);
      setFieldErrors({});
    }
  }, [open, task, defaultStatus]);

  const set = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!task || !onDelete || !window.confirm(t("dialog.confirmDelete", { title: task.title }))) return;
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
      onClose={onClose}
      title={task ? t("dialog.editTitle") : t("dialog.newTitle")}
      footer={
        <>
          {task && onDelete && (
            <button type="button" className="btn btn-danger btn-sm mr-auto" onClick={remove} disabled={busy}>
              <Trash2 size={14} /> {tc("delete")}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose}>{tc("cancel")}</button>
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
        </div>
        <div>
          <label className="label" htmlFor="t-desc">{t("dialog.description")}</label>
          <textarea id="t-desc" className="field min-h-28" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("dialog.descriptionPlaceholder")} maxLength={20000} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="t-status">{t("dialog.column")}</label>
            <select id="t-status" className="field" value={form.status} onChange={(e) => set("status", e.target.value as TaskStatus)}>
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{ts(`task.${s.value}`)}</option>
              ))}
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
        </div>
        {form.recurrence && (
          <p className="text-xs text-muted">
            {t("dialog.recurrenceHint")}
          </p>
        )}
        <FormError message={error} />
      </form>
    </Modal>
  );
}
