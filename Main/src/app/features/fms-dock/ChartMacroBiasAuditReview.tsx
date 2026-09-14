import { useState, type FormEvent } from "react";
import { ChartMacroBiasAudit, type ChartMacroBiasAuditData } from "@/app/components/ChartMacroBiasAudit";
import { FmsReviewNoteRow } from "@/app/features/fms-dock/FmsReviewNoteRow";
import { useFmsReviewNotes } from "@/app/features/fms-dock/useFmsReviewNotes";
import type { FmsReviewNoteInput } from "@/app/lib/bridge";

export function ChartMacroBiasAuditReview({ data }: { data: ChartMacroBiasAuditData }) {
  const { notesByKey, loading, savingKey, error, save, remove } = useFmsReviewNotes();
  const [editingRecordKey, setEditingRecordKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const market = data.pattern.market || data.symbol || "";
  const recordKey = `${market}:${data.signal.patternId}:${data.signal.eventTime}`;
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
    setEditingRecordKey(recordKey);
  };
  const cancelNote = () => {
    setEditingRecordKey(null);
    setDraft("");
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
    <FmsReviewNoteRow input={input} saved={saved} editing={editing} draft={draft} loading={loading} saving={savingKey === recordKey} error={error} showAddWhenEmpty onDraftChange={setDraft} onEdit={beginNote} onCancel={cancelNote} onSave={submitNote} onRemove={deleteNote} />
  } />;
}
