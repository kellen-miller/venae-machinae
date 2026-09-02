export type BrowserDeliveryConnection = 'connected' | 'disconnected';

type DeliveryListener = (connection: BrowserDeliveryConnection) => void;

let connection: BrowserDeliveryConnection = 'connected';
let monitorCount = 0;
let interval: ReturnType<typeof setInterval> | null = null;
let stopBrowserMonitor: (() => void) | null = null;
const listeners = new Set<DeliveryListener>();
const reconnectListeners = new Set<() => void>();

function publish(next: BrowserDeliveryConnection): void {
  if (connection === next) return;
  const previous = connection;
  connection = next;
  for (const listener of listeners) listener(connection);
  if (previous === 'disconnected' && next === 'connected') {
    for (const listener of reconnectListeners) listener();
  }
}

async function check(): Promise<BrowserDeliveryConnection> {
  try {
    const response = await fetch('/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(1_500)
    });
    publish(response.ok ? 'connected' : 'disconnected');
  } catch {
    publish('disconnected');
  }
  return connection;
}

function start(): () => void {
  monitorCount += 1;
  if (monitorCount === 1) {
    const online = () => void check();
    const offline = () => void check();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    interval = setInterval(() => void check(), 2_000);
    void check();
    stopBrowserMonitor = () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      if (interval !== null) clearInterval(interval);
      interval = null;
      stopBrowserMonitor = null;
    };
  }

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    monitorCount -= 1;
    if (monitorCount > 0) return;
    stopBrowserMonitor?.();
  };
}

export const browserDeliveryState = {
  get current(): BrowserDeliveryConnection {
    return connection;
  },
  check,
  start,
  subscribe(listener: DeliveryListener): () => void {
    listeners.add(listener);
    listener(connection);
    return () => listeners.delete(listener);
  },
  onReconnect(listener: () => void): () => void {
    reconnectListeners.add(listener);
    return () => reconnectListeners.delete(listener);
  }
};
