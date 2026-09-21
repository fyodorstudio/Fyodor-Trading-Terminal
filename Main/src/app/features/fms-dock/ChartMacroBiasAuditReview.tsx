import { useState, type FormEvent } from "react";
import { ChartMacroBiasAudit, type ChartMacroBiasAuditData } from "@/app/components/ChartMacroBiasAudit";
import { FmsReviewNoteRow } from "@/app/features/fms-dock/FmsReviewNoteRow";
import { useFmsReviewNotes } from "@/app/features/fms-dock/useFmsReviewNotes";
import { FMS_BASELINE_DISPLAY_VERSION, fmsReviewRecordKey } from "@/app/lib/fmsDisplayVersion";
import type { FmsReviewNoteInput, FmsReviewNoteLabel } from "@/app/lib/bridge";

export function ChartMacroBiasAuditReview({ data }: { data: ChartMacroBiasAuditData }) {
  const { notesByKey, loading, savingKey, error, save, remove } = useFmsReviewNotes();
  const [editingRecordKey, setEditingRecordKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [label, setLabel] = useState<FmsReviewNoteLabel>("unlabeled");
  const market = data.pattern.market || data.symbol || "";
  const recordKey = fmsReviewRecordKey(market, data.signal.patternId, data.signal.eventTime, data.signal.registeredVersion ?? FMS_BASELINE_DISPLAY_VERSION);
  const saved = notesByKey.get(recordKey) ?? null;
  const editing = editingRecordKey === recordKey;
  const input = {
    recordKey,
    context: "activity" as const,
    market,
    patternId: data.signal.patternId,
    eventTime: data.signal.eventTime,
    signalId: data.signal.id,
  };
  const beginNote = () => {
    setDraft(saved?.note ?? "");
    setLabel(saved?.label ?? "unlabeled");
    setEditingRecordKey(recordKey);
  };
  const cancelNote = () => {
    setEditingRecordKey(null);
    setDraft("");
    setLabel("unlabeled");
  };
  const submitNote = (event: FormEvent<HTMLFormElement>, noteInput: Omit<FmsReviewNoteInput, "note">) => {
    event.preventDefault();
    const note = draft.trim();
    if (!note) return;
    void save({ ...noteInput, note }).then(cancelNote).catch(() => undefined);
  };
  const deleteNote = () => {
    if (!window.confirm("Remove this personal audit note?")) return;
    void remove(recordKey).catch(() => undefined);
  };

  return <ChartMacroBiasAudit data={data} noteRow={
    <FmsReviewNoteRow input={input} saved={saved} editing={editing} draft={draft} label={label} loading={loading} saving={savingKey === recordKey} error={error} showAddWhenEmpty displayTimeMode={data.displayTimeMode} sourceTimeOffsetSeconds={data.sourceTimeOffsetSeconds} onDraftChange={setDraft} onLabelChange={setLabel} onEdit={beginNote} onCancel={cancelNote} onSave={submitNote} onRemove={deleteNote} />
  } />;
}
