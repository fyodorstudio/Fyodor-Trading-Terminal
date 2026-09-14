import type { FormEvent } from "react";
import { formatJakartaDisplayDateTime } from "@/app/lib/format";
import type { FmsReviewNote, FmsReviewNoteInput } from "@/app/lib/bridge";

export function FmsReviewNoteRow({
  input,
  saved,
  editing,
  draft,
  loading = false,
  saving,
  error = null,
  showAddWhenEmpty = false,
  onDraftChange,
  onEdit,
  onCancel,
  onSave,
  onRemove,
}: {
  input: Omit<FmsReviewNoteInput, "note">;
  saved: FmsReviewNote | null;
  editing: boolean;
  draft: string;
  loading?: boolean;
  saving: boolean;
  error?: string | null;
  showAddWhenEmpty?: boolean;
  onDraftChange: (value: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (event: FormEvent<HTMLFormElement>, input: Omit<FmsReviewNoteInput, "note">) => void;
  onRemove: () => void;
}) {
  if (!saved && !editing && !showAddWhenEmpty) return null;
  return <tr className="fms-review-note-row" data-note-record-key={input.recordKey}>
    <th scope="row">Audit note</th>
    <td colSpan={2}>
      {editing ? <form onSubmit={(event) => onSave(event, input)}>
        <textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} maxLength={4000} rows={3} autoFocus aria-label="Personal audit note" placeholder="Record anything suspicious about the arrow, entry, TP, SL, or price reaction." />
        <span><button type="submit" disabled={saving || !draft.trim()}>{saving ? "Saving..." : "Save note"}</button><button type="button" disabled={saving} onClick={onCancel}>Cancel</button></span>
      </form> : saved ? <div>
        <p>{saved.note}</p>
        <span><time dateTime={new Date(saved.updatedAt * 1000).toISOString()}>Updated {formatJakartaDisplayDateTime(saved.updatedAt)}</time><button type="button" onClick={onEdit}>Edit</button><button type="button" disabled={saving} onClick={onRemove}>{saving ? "Removing..." : "Remove"}</button></span>
      </div> : <div>
        <p>{error ? `Audit notes unavailable: ${error}` : "Add a personal note about this frozen arrow without changing its recorded result."}</p>
        <span><button type="button" disabled={loading} onClick={onEdit}>Add audit note</button></span>
      </div>}
    </td>
  </tr>;
}
