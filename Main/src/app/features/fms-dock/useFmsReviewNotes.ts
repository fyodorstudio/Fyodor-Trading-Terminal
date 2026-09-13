import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteFmsReviewNote,
  fetchFmsReviewNotes,
  saveFmsReviewNote,
  type FmsReviewNote,
  type FmsReviewNoteInput,
} from "@/app/lib/bridge";

export function useFmsReviewNotes() {
  const [rows, setRows] = useState<FmsReviewNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFmsReviewNotes()
      .then((loaded) => { if (!cancelled) setRows(loaded); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Review notes could not be loaded");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const notesByKey = useMemo(() => new Map(rows.map((row) => [row.recordKey, row])), [rows]);

  const save = useCallback(async (input: FmsReviewNoteInput) => {
    setSavingKey(input.recordKey);
    setError(null);
    try {
      const saved = await saveFmsReviewNote(input);
      setRows((current) => [saved, ...current.filter((row) => row.recordKey !== saved.recordKey)]);
      return saved;
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Review note could not be saved");
      throw reason;
    } finally {
      setSavingKey(null);
    }
  }, []);

  const remove = useCallback(async (recordKey: string) => {
    setSavingKey(recordKey);
    setError(null);
    try {
      await deleteFmsReviewNote(recordKey);
      setRows((current) => current.filter((row) => row.recordKey !== recordKey));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Review note could not be removed");
      throw reason;
    } finally {
      setSavingKey(null);
    }
  }, []);

  return { notesByKey, loading, savingKey, error, save, remove };
}
