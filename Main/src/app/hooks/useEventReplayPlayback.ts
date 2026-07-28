import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHistoryRange } from "@/app/lib/bridge";
import {
  getReplayFetchRange,
  getReplayWindowCandles,
} from "@/app/lib/eventReaction";
import type { BridgeCandle, FxPairDefinition, ReactionReplaySample, ReplayChartTimeframe } from "@/app/types";

const PLAYBACK_INTERVAL_MS = 550;

interface UseEventReplayPlaybackArgs {
  selectedPair: FxPairDefinition;
  selectedSample: ReactionReplaySample | null;
  replayTimeframe: ReplayChartTimeframe;
  beforeCount: number;
  afterCount: number;
}

export function useEventReplayPlayback({
  selectedPair,
  selectedSample,
  replayTimeframe,
  beforeCount,
  afterCount,
}: UseEventReplayPlaybackArgs) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayWindow, setReplayWindow] = useState<{ candles: BridgeCandle[]; eventIndex: number } | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, Promise<BridgeCandle[]>>>(new Map());

  useEffect(() => {
    if (!selectedSample) {
      setReplayWindow(null);
      setReplayLoading(false);
      setReplayError(null);
      setVisibleCount(0);
      setIsPlaying(false);
      return;
    }

    let cancelled = false;

    const loadReplay = async () => {
      setReplayLoading(true);
      setReplayError(null);
      setIsPlaying(false);

      try {
        const range = getReplayFetchRange({
          eventTime: selectedSample.eventTime,
          timeframe: replayTimeframe,
          beforeCount,
          afterCount,
        });
        const cacheKey = `${selectedPair.name}|${replayTimeframe}|${range.from}|${range.to}`;
        const cached = cacheRef.current.get(cacheKey);
        const request =
          cached ??
          fetchHistoryRange({
            symbol: selectedPair.name,
            tf: replayTimeframe,
            from: range.from,
            to: range.to,
          }).catch((error) => {
            cacheRef.current.delete(cacheKey);
            throw error;
          });

        if (!cached) cacheRef.current.set(cacheKey, request);
        const candles = await request;
        if (cancelled) return;

        const window = getReplayWindowCandles({
          candles,
          eventTime: selectedSample.eventTime,
          beforeCount,
          afterCount,
        });

        if (!window) {
          setReplayWindow(null);
          setVisibleCount(0);
          setReplayError("No replayable candle window was resolved for this release, pair, and timeframe.");
          return;
        }

        setReplayWindow(window);
        setVisibleCount(window.eventIndex + 1);
      } catch (error) {
        if (cancelled) return;
        setReplayWindow(null);
        setVisibleCount(0);
        setReplayError(error instanceof Error ? error.message : "Failed to load replay candles.");
      } finally {
        if (!cancelled) setReplayLoading(false);
      }
    };

    void loadReplay();
    return () => {
      cancelled = true;
    };
  }, [afterCount, beforeCount, replayTimeframe, selectedPair.name, selectedSample]);

  useEffect(() => {
    if (!isPlaying || !replayWindow) return;
    const id = window.setInterval(() => {
      setVisibleCount((current) => {
        if (current >= replayWindow.candles.length) {
          window.clearInterval(id);
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, PLAYBACK_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [isPlaying, replayWindow]);

  const stopPlayback = useCallback(() => setIsPlaying(false), []);

  const togglePlayback = useCallback(() => {
    if (!replayWindow) return;
    if (visibleCount >= replayWindow.candles.length) {
      setVisibleCount(replayWindow.eventIndex + 1);
    }
    setIsPlaying((value) => !value);
  }, [replayWindow, visibleCount]);

  return {
    visibleCount,
    isPlaying,
    replayWindow,
    replayLoading,
    replayError,
    stopPlayback,
    togglePlayback,
  };
}
