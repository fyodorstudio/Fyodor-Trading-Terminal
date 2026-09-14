export type AppActivityLevel = "info" | "success" | "warning" | "error";

export interface AppActivityEntry {
  id: number;
  time: number;
  level: AppActivityLevel;
  source: string;
  message: string;
  detail: string | null;
  repeat: number;
}

const MAX_ACTIVITY_ROWS = 160;
const listeners = new Set<() => void>();
let nextId = 1;
let snapshot: readonly AppActivityEntry[] = [{
  id: nextId++,
  time: Date.now(),
  level: "info",
  source: "App",
  message: "Application session started",
  detail: "Waiting for local bridge and saved chart state.",
  repeat: 1,
}];

function publish() {
  listeners.forEach((listener) => listener());
}

export function recordAppActivity({
  level = "info",
  source,
  message,
  detail = null,
}: {
  level?: AppActivityLevel;
  source: string;
  message: string;
  detail?: string | null;
}) {
  const time = Date.now();
  const newest = snapshot[0];
  if (newest && newest.level === level && newest.source === source && newest.message === message && newest.detail === detail && time - newest.time < 2_000) {
    snapshot = [{ ...newest, time, repeat: newest.repeat + 1 }, ...snapshot.slice(1)];
  } else {
    snapshot = [{ id: nextId++, time, level, source, message, detail, repeat: 1 }, ...snapshot].slice(0, MAX_ACTIVITY_ROWS);
  }
  publish();
}

export function clearAppActivity() {
  snapshot = [{
    id: nextId++,
    time: Date.now(),
    level: "info",
    source: "App",
    message: "Activity log cleared",
    detail: null,
    repeat: 1,
  }];
  publish();
}

export function getAppActivitySnapshot(): readonly AppActivityEntry[] {
  return snapshot;
}

export function subscribeAppActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
