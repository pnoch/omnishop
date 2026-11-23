export type WebAlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type WebAlert = {
  id: number;
  title: string;
  message?: string;
  buttons: WebAlertButton[];
};

type Snapshot = { current: WebAlert | null; pending: number };

const EMPTY: Snapshot = { current: null, pending: 0 };
const SERVER_SNAPSHOT: Snapshot = { current: null, pending: 0 };

let nextId = 1;
let current: WebAlert | null = null;
const queue: WebAlert[] = [];
const listeners = new Set<() => void>();
let snapshot: Snapshot = EMPTY;

function publish() {
  snapshot = { current, pending: queue.length };
  for (const listener of listeners) listener();
}

/**
 * Queues a dialog for the web alert host. The host renders one dialog at a
 * time so a handler that fires several alerts (e.g. a bulk action) does not
 * stack overlapping prompts.
 */
export function enqueueWebAlert(
  title: string,
  message?: string,
  buttons: WebAlertButton[] = [],
): void {
  const alert: WebAlert = {
    id: nextId++,
    title,
    message,
    buttons: buttons.length > 0 ? buttons : [{ text: "OK" }],
  };
  if (current) queue.push(alert);
  else current = alert;
  publish();
}

/**
 * Resolves the visible dialog. The next queued alert is shown first, then the
 * chosen button's handler runs, so a handler that opens another dialog cannot
 * be hidden behind a stale one.
 */
export function resolveWebAlert(button?: WebAlertButton): void {
  if (!current) return;
  current = queue.shift() ?? null;
  publish();
  button?.onPress?.();
}

export function dismissWebAlert(): void {
  if (!current) return;
  resolveWebAlert(current.buttons.find((b) => b.style === "cancel"));
}

export function subscribeWebAlerts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWebAlertSnapshot(): Snapshot {
  return snapshot;
}

export function getWebAlertServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

export function resetWebAlertsForTests(): void {
  current = null;
  queue.length = 0;
  snapshot = EMPTY;
  listeners.clear();
}
