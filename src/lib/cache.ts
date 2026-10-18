// A small Redis-style cache in the browser: values expire after a TTL,
// identical requests in flight share one network call, and selected keys
// survive reloads via localStorage. It keeps repeat reads off the database.

type Entry = { value: unknown; expires: number };

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 100;

function readPersisted(key: string): Entry | null {
  try {
    const raw = localStorage.getItem(`pv:cache:${key}`);
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry;
    return e.expires > Date.now() ? e : null;
  } catch {
    return null;
  }
}

function writePersisted(key: string, e: Entry) {
  try {
    localStorage.setItem(`pv:cache:${key}`, JSON.stringify(e));
  } catch {
    /* storage full or blocked: memory cache still works */
  }
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  opts: { persist?: boolean } = {},
): Promise<T> {
  const hit = memory.get(key) ?? (opts.persist ? readPersisted(key) : null);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = load()
    .then((value) => {
      const e = { value, expires: Date.now() + ttlMs };
      memory.set(key, e);
      // Bounded: drop the oldest entries so memory can't grow without limit.
      while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value as string);
      if (opts.persist) writePersisted(key, e);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Forget cached values whose key starts with the prefix (or everything). */
export function invalidate(prefix = '') {
  for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(`pv:cache:${prefix}`)) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
