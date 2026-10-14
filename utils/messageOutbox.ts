// Durable outbox for messages and acknowledgements sent with poor connectivity.
// Items stay until the server confirms them. Permanent rejections are kept (marked failed)
// so the user must explicitly retry or discard — nothing is dropped silently.
// Server calls are idempotent (client-generated message ids, unique hold acknowledgements).

export interface OutboxMessage {
  kind: 'message';
  id: string;
  appointmentId: string;
  body: string;
  category: string;
  visibility: 'shared' | 'team';
  onBehalfOfCustomer: boolean;
  createdAt: string;
  attempts: number;
  failed?: boolean;
  lastError?: string;
}
export interface OutboxAck {
  kind: 'ack';
  id: string; // hold id
  appointmentId: string;
  createdAt: string;
  attempts: number;
  failed?: boolean;
  lastError?: string;
}
export type OutboxItem = OutboxMessage | OutboxAck;

export interface OutboxDeps {
  load: () => Promise<OutboxItem[]>;
  save: (items: OutboxItem[]) => Promise<void>;
  send: (item: OutboxItem) => Promise<void>;
  isPermanentError?: (error: unknown) => boolean;
}

const key = (i: Pick<OutboxItem, 'kind' | 'id'>) => `${i.kind}:${i.id}`;

/** Server validation / permission errors will not succeed on retry; network errors might. */
export function isPermanentServerError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && /^(42|P0|22|23)/.test(code);
}

export function createOutbox(deps: OutboxDeps) {
  let items: OutboxItem[] | null = null;
  let flushing: Promise<void> | null = null;
  const listeners = new Set<(items: OutboxItem[]) => void>();
  const permanent = deps.isPermanentError ?? isPermanentServerError;

  const ready = async () => {
    if (!items) {
      try { items = await deps.load(); } catch { items = []; }
    }
    return items;
  };
  const commit = async (next: OutboxItem[]) => {
    items = next;
    listeners.forEach(l => l(next));
    await deps.save(next);
  };

  const runFlush = async () => {
    const queue = [...(await ready())].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const item of queue) {
      if (item.failed) continue;
      try {
        await deps.send(item);
        await commit((items ?? []).filter(i => key(i) !== key(item)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
        const isPermanent = permanent(error);
        await commit((items ?? []).map(i => key(i) === key(item)
          ? { ...i, attempts: i.attempts + 1, lastError: message, failed: isPermanent }
          : i));
        // Preserve ordering: if the network is down, later items wait too.
        if (!isPermanent) return;
      }
    }
  };

  const flush = () => {
    if (!flushing) flushing = runFlush().finally(() => { flushing = null; });
    return flushing;
  };

  return {
    async enqueue(item: OutboxItem) {
      const current = await ready();
      if (!current.some(i => key(i) === key(item))) await commit([...current, item]);
      return flush();
    },
    flush,
    async list() { return [...(await ready())]; },
    async retry(kind: OutboxItem['kind'], id: string) {
      await commit((await ready()).map(i => key(i) === key({ kind, id }) ? { ...i, failed: false } : i));
      return flush();
    },
    async discard(kind: OutboxItem['kind'], id: string) {
      await commit((await ready()).filter(i => key(i) !== key({ kind, id })));
    },
    subscribe(listener: (items: OutboxItem[]) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;
