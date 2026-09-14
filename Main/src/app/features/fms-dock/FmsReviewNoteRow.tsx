import type { FormEvent } from "react";
import { formatJakartaDisplayDateTime } from "@/app/lib/format";
import { FMS_REVIEW_NOTE_LABELS, type FmsReviewNote, type FmsReviewNoteInput, type FmsReviewNoteLabel } from "@/app/lib/bridge";

const NOTE_LABEL_NAMES: Record<FmsReviewNoteLabel, string> = {
  unlabeled: "Unlabeled",
  bug: "Bug",
  tp: "Take profit",
  sl: "Stop loss",
  entry: "Entry",
  reaction: "Reaction",
  ok: "Verified OK",
  question: "Question",
};

export function FmsReviewNoteRow({
  input,
  saved,
  editing,
  draft,
  label,
  loading = false,
  saving,
  error = null,
  showAddWhenEmpty = false,
  valueColSpan = 2,
  onDraftChange,
  onLabelChange,
  onEdit,
  onCancel,
  onSave,
  onRemove,
}: {
  input: Omit<FmsReviewNoteInput, "note" | "label">;
  saved: FmsReviewNote | null;
  editing: boolean;
  draft: string;
  label: FmsReviewNoteLabel;
  loading?: boolean;
  saving: boolean;
  error?: string | null;
  showAddWhenEmpty?: boolean;
  valueColSpan?: number;
  onDraftChange: (value: string) => void;
  onLabelChange: (value: FmsReviewNoteLabel) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (event: FormEvent<HTMLFormElement>, input: Omit<FmsReviewNoteInput, "note">) => void;
  onRemove: () => void;
}) {
  if (!saved && !editing && !showAddWhenEmpty) return null;
  return <tr className="fms-review-note-row" data-note-record-key={input.recordKey}>
    <th scope="row">Audit note</th>
    <td colSpan={valueColSpan}>
      {editing ? <form onSubmit={(event) => onSave(event, { ...input, label })}>
        <label className="fms-review-note-label"><span>Label</span><select aria-label="Audit note label" value={label} onChange={(event) => onLabelChange(event.target.value as FmsReviewNoteLabel)}>{FMS_REVIEW_NOTE_LABELS.map((value) => <option key={value} value={value}>{NOTE_LABEL_NAMES[value]}</option>)}</select></label>
        <textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} maxLength={4000} rows={3} autoFocus aria-label="Personal audit note" placeholder="Record anything suspicious about the arrow, entry, TP, SL, or price reaction." />
        <span><button type="submit" disabled={saving || !draft.trim()}>{saving ? "Saving..." : "Save note"}</button><button type="button" disabled={saving} onClick={onCancel}>Cancel</button></span>
      </form> : saved ? <div>
        <p><strong className={`fms-review-note-badge is-${saved.label}`}>{NOTE_LABEL_NAMES[saved.label]}</strong>{saved.note}</p>
        <span><time dateTime={new Date(saved.updatedAt * 1000).toISOString()}>Updated {formatJakartaDisplayDateTime(saved.updatedAt)}</time><button type="button" onClick={onEdit}>Edit</button><button type="button" disabled={saving} onClick={onRemove}>{saving ? "Removing..." : "Remove"}</button></span>
      </div> : <div>
        <p>{error ? `Audit notes unavailable: ${error}` : "Add a personal note about this frozen arrow without changing its recorded result."}</p>
        <span><button type="button" disabled={loading} onClick={onEdit}>Add audit note</button></span>
      </div>}
    </td>
  </tr>;
}
