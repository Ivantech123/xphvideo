import { Video } from '../types';

type CacheValue = { v: 1; ts: number; videos: Video[] };

const VERSION = 1 as const;
const PREFIX = `velvet_feed_cache_v${VERSION}:`;
const INDEX_KEY = `velvet_feed_cache_index_v${VERSION}`;
const TTL_MS = 10 * 60 * 1000;
const MAX_KEYS = 10;

const safeStorage = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {}
  return null;
})();

const readIndex = (): string[] => {
  if (!safeStorage) return [];
  try {
    const raw = safeStorage.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
};

const writeIndex = (keys: string[]) => {
  if (!safeStorage) return;
  try {
    safeStorage.setItem(INDEX_KEY, JSON.stringify(keys.slice(0, MAX_KEYS)));
  } catch {}
};

const touchKey = (key: string) => {
  const keys = readIndex().filter((k) => k !== key);
  keys.unshift(key);
  // evict
  while (keys.length > MAX_KEYS) {
    const removed = keys.pop();
    if (!removed) break;
    try {
      safeStorage?.removeItem(removed);
    } catch {}
  }
  writeIndex(keys);
};

export const FeedCache = {
  makeKey(params: Record<string, unknown>) {
    const stable = Object.entries(params)
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return PREFIX + JSON.stringify(stable);
  },

  get(key: string): Video[] | null {
    if (!safeStorage) return null;
    try {
      const raw = safeStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheValue;
      if (!parsed || parsed.v !== 1 || typeof parsed.ts !== 'number' || !Array.isArray(parsed.videos)) return null;
      if (Date.now() - parsed.ts > TTL_MS) return null;
      const vids = parsed.videos.filter((v) => v && typeof v.id === 'string' && v.id.length > 0);
      return vids.length ? vids : null;
    } catch {
      return null;
    }
  },

  set(key: string, videos: Video[]) {
    if (!safeStorage) return;
    try {
      const value: CacheValue = { v: 1, ts: Date.now(), videos };
      safeStorage.setItem(key, JSON.stringify(value));
      touchKey(key);
    } catch {}
  },
};

