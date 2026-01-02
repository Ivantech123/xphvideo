import { Video } from '../types';

// User behavior tracking for smart recommendations
interface UserBehavior {
  v: 2;
  viewedTags: Record<string, { s: number; ts: number }>;      // tag -> score
  viewedCreators: Record<string, { s: number; ts: number }>;  // creator id -> score
  viewedSources: Record<string, { s: number; ts: number }>;   // source -> score
  watchTime: Record<string, { s: number; ts: number; m: number }>; // video id -> seconds watched
  videoMeta: Record<string, { tags: string[]; creatorId?: string; source?: string; d?: number; ts?: number }>;
  lastViewed: { id: string; ts: number }[];
  sessionStart: number;
}

const STORAGE_KEY = 'velvet_user_behavior';
const SEARCH_STATS_KEY = 'velvet_search_stats';
const MAX_LAST_VIEWED = 50;
const WATCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const META_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_SEARCH_STATS = 200;
const WRITE_WT_EVERY_MS = 5000;

let behaviorCache: UserBehavior | null = null;
let storageListenerBound = false;

type SearchStat = { c: number; ts: number; label: string };

const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

const nowTs = () => Date.now();

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const safeStorage = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {}
  return null;
})();

if (typeof window !== 'undefined' && !storageListenerBound) {
  storageListenerBound = true;
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) behaviorCache = null;
  });
}

const storageGet = (key: string) => {
  if (!safeStorage) return null;
  try {
    return safeStorage.getItem(key);
  } catch {
    return null;
  }
};

const storageSet = (key: string, value: string) => {
  if (!safeStorage) return;
  try {
    safeStorage.setItem(key, value);
  } catch {}
};

const storageRemove = (key: string) => {
  if (!safeStorage) return;
  try {
    safeStorage.removeItem(key);
  } catch {}
};

const decayScore = (score: number, lastTs: number, now: number) => {
  const dt = Math.max(0, now - lastTs);
  const k = Math.pow(0.5, dt / HALF_LIFE_MS);
  return score * k;
};

const bumpAffinity = (map: Record<string, { s: number; ts: number }>, key: string, delta: number, now: number) => {
  const prev = map[key];
  if (!prev) {
    if (delta <= 0) return;
    map[key] = { s: delta, ts: now };
    return;
  }
  const decayed = decayScore(prev.s, prev.ts, now);
  const next = Math.max(0, decayed + delta);
  if (next === 0) {
    delete map[key];
    return;
  }
  map[key] = { s: next, ts: now };
};

const normLabel = (s: string) => s.trim().toLowerCase();

const normalizeSearch = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const STOPWORDS = new Set([
  'and','or','the','a','an','of','to','in','for','on','with','at','by','from','as','is','are','was','were','be','been',
  'this','that','these','those','it','its','you','your','we','our','they','their','i','me','my',
  'и','или','в','во','на','с','со','по','к','ко','за','от','до','из','у','о','об','для','как','это','то','та','те',
  'он','она','они','мы','вы','я','ты','его','ее','их','наш','ваш'
]);

const tokenizeSearch = (s: string) => {
  const tokens = s.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!tokens) return [];
  return tokens
    .filter(t => t.length >= 3)
    .filter(t => !STOPWORDS.has(t))
    .slice(0, 6);
};

const isSpecialSearch = (s: string) => {
  const value = normalizeSearch(s).replace(/^#/, '');
  return ['trending', 'new', 'shorts', 'в тренде', 'новое'].includes(value);
};

const pruneSearchStats = (stats: Record<string, SearchStat>, now: number) => {
  const cutoff = now - SEARCH_TTL_MS;
  for (const [key, entry] of Object.entries(stats)) {
    if (!entry || typeof entry.label !== 'string') {
      delete stats[key];
      continue;
    }
    if (entry.ts < cutoff) {
      delete stats[key];
    }
  }

  const keys = Object.keys(stats);
  if (keys.length > MAX_SEARCH_STATS) {
    const keep = keys
      .map((k) => ({ k, v: stats[k] }))
      .sort((a, b) => {
        if (b.v.c !== a.v.c) return b.v.c - a.v.c;
        return b.v.ts - a.v.ts;
      })
      .slice(0, MAX_SEARCH_STATS);
    const next: Record<string, SearchStat> = {};
    for (const it of keep) next[it.k] = it.v;
    return next;
  }
  return stats;
};

const getSearchStats = (): Record<string, SearchStat> => {
  try {
    const raw = storageGet(SEARCH_STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return pruneSearchStats(parsed as Record<string, SearchStat>, nowTs());
  } catch {
    return {};
  }
};

const saveSearchStats = (stats: Record<string, SearchStat>) => {
  try {
    storageSet(SEARCH_STATS_KEY, JSON.stringify(stats));
  } catch {}
};

const normalizeLabels = (labels: string[]) => {
  const uniq = new Set<string>();
  for (const label of labels) {
    const v = label ? normLabel(label) : '';
    if (!v || uniq.has(v)) continue;
    uniq.add(v);
    if (uniq.size >= 8) break;
  }
  return [...uniq];
};

const extractLabels = (video: Video): string[] => {
  const uniq = new Set<string>();
  for (const t of video.tags || []) {
    const label = typeof t === 'string' ? t : t?.label;
    const v = label ? normLabel(label) : '';
    if (!v || uniq.has(v)) continue;
    uniq.add(v);
    if (uniq.size >= 8) break;
  }
  return [...uniq];
};

const getCachedLabels = (video: Video, behavior: UserBehavior, cache?: Map<string, string[]>) => {
  const cached = cache?.get(video.id);
  if (cached) return cached;
  const metaLabels = behavior.videoMeta[video.id]?.tags;
  const labels = metaLabels?.length
    ? normalizeLabels(metaLabels)
    : extractLabels(video);
  const own = [...labels];
  cache?.set(video.id, own);
  return own;
};

const getEngagementMilestone = (secondsWatched: number, duration?: number) => {
  if (duration && duration > 0) {
    const ratio = clamp01(secondsWatched / duration);
    return ratio >= 0.75 ? 3 : ratio >= 0.5 ? 2 : ratio >= 0.25 ? 1 : 0;
  }
  return secondsWatched >= 180 ? 3 : secondsWatched >= 60 ? 2 : secondsWatched >= 20 ? 1 : 0;
};

const computeSessionBoost = (behavior: UserBehavior, now: number) => {
  const sessionWindowMs = 30 * 60 * 1000;
  const tags: Record<string, number> = {};
  const creators: Record<string, number> = {};
  const sources: Record<string, number> = {};

  for (const it of behavior.lastViewed) {
    if (now - it.ts > sessionWindowMs) continue;
    const meta = behavior.videoMeta[it.id];
    if (!meta) continue;
    const m = behavior.watchTime[it.id]?.m || 0;
    if (m <= 0) continue;
    const w = m;

    for (const label of meta.tags || []) {
      const t = normLabel(label);
      if (!t) continue;
      tags[t] = (tags[t] || 0) + w;
    }
    if (meta.creatorId) creators[meta.creatorId] = (creators[meta.creatorId] || 0) + w;
    if (meta.source) sources[meta.source] = (sources[meta.source] || 0) + w;
  }

  return { tags, creators, sources };
};

const log10 = (v: number) => Math.log(v) / Math.LN10;

const getPublishedTs = (publishedAt?: string) => {
  if (!publishedAt) return null;
  const ts = Date.parse(publishedAt);
  return Number.isFinite(ts) ? ts : null;
};

const computeFreshnessScore = (publishedAt?: string, now: number = nowTs()) => {
  const ts = getPublishedTs(publishedAt);
  if (!ts) return 0.2;
  const ageDays = Math.max(0, (now - ts) / (24 * 60 * 60 * 1000));
  return Math.exp(-ageDays / 30);
};

const computeQualityScore = (video: Video) => {
  const rating = typeof video.rating === 'number' ? clamp01(video.rating / 100) : 0;
  const views = typeof video.views === 'number' ? video.views : 0;
  const viewsScore = clamp01(log10(Math.max(1, views)) / 6);
  return rating * 0.6 + viewsScore * 0.4;
};

const computeDurationPreference = (behavior: UserBehavior) => {
  const durations: number[] = [];
  for (const it of behavior.lastViewed) {
    const meta = behavior.videoMeta[it.id];
    if (!meta?.d || meta.d <= 0) continue;
    const watch = behavior.watchTime[it.id];
    if (watch && watch.s < 10) continue;
    durations.push(meta.d);
    if (durations.length >= 24) break;
  }
  if (durations.length < 3) return null;
  durations.sort((a, b) => a - b);
  return durations[Math.floor(durations.length / 2)];
};

const computeDurationScore = (video: Video, pref: number | null) => {
  if (!pref || !video.duration || video.duration <= 0) return 0.5;
  const ratio = video.duration / pref;
  const delta = Math.abs(Math.log(ratio));
  return clamp01(Math.exp(-delta / Math.log(2)));
};

const hashString = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const stableNoise = (id: string, salt: number, amp: number = 0.02) => {
  const h = hashString(`${id}:${salt}`);
  return ((h % 1000) / 1000 - 0.5) * amp;
};

const getFavoriteIds = () => {
  try {
    const favs = JSON.parse(storageGet('velvet_favorites') || '[]');
    if (!Array.isArray(favs)) return new Set<string>();
    return new Set(favs.map((v: any) => String(v?.id || '')).filter(Boolean));
  } catch {
    return new Set<string>();
  }
};

const computeAffinityRaw = (
  video: Video,
  behavior: UserBehavior,
  now: number,
  labels?: string[],
  sessionBoost?: ReturnType<typeof computeSessionBoost> | null
) => {
  let score = 0;
  const tags = labels || extractLabels(video);
  for (const label of tags) {
    const a = behavior.viewedTags[label];
    if (a) score += decayScore(a.s, a.ts, now) * 1.1;
  }
  const creatorId = video.creator?.id ? String(video.creator.id) : undefined;
  if (creatorId) {
    const a = behavior.viewedCreators[creatorId];
    if (a) score += decayScore(a.s, a.ts, now) * 1.6;
  }
  const source = video.source ? String(video.source).trim() : '';
  if (source) {
    const a = behavior.viewedSources[source];
    if (a) score += decayScore(a.s, a.ts, now) * 0.6;
  }

  const session = sessionBoost === null ? null : sessionBoost || computeSessionBoost(behavior, now);
  if (session) {
    for (const label of tags) {
      if (session.tags[label]) score += session.tags[label] * 1.4;
    }
    if (creatorId && session.creators[creatorId]) score += session.creators[creatorId] * 1.8;
    if (source && session.sources[source]) score += session.sources[source] * 0.6;
  }

  return score;
};

const normalizeAffinity = (score: number) => 1 - Math.exp(-Math.max(0, score) / 6);

const computeSessionScore = (
  labels: string[],
  sessionBoost: ReturnType<typeof computeSessionBoost> | undefined,
  creatorId?: string,
  source?: string
) => {
  if (!sessionBoost) return 0;
  let s = 0;
  for (const label of labels) {
    if (sessionBoost.tags[label]) s += sessionBoost.tags[label];
  }
  if (creatorId && sessionBoost.creators[creatorId]) s += sessionBoost.creators[creatorId] * 1.2;
  if (source && sessionBoost.sources[source]) s += sessionBoost.sources[source] * 0.6;
  return 1 - Math.exp(-Math.max(0, s) / 4);
};

const computeNoveltyBoost = (video: Video, behavior: UserBehavior, labels?: string[]) => {
  let boost = 0;
  const tags = labels || extractLabels(video);
  const creatorId = video.creator?.id ? String(video.creator.id) : undefined;

  let seenTags = 0;
  for (const label of tags) {
    if (behavior.viewedTags[label]) seenTags += 1;
  }
  if (tags.length > 0 && seenTags === 0) boost += 0.25;
  if (creatorId && !behavior.viewedCreators[creatorId]) boost += 0.2;
  const source = video.source ? String(video.source).trim() : '';
  if (source && !behavior.viewedSources[source]) boost += 0.05;

  if (Object.keys(behavior.viewedTags).length === 0) boost *= 1.5;

  return clamp01(boost);
};

const computeFatiguePenalty = (
  video: Video,
  behavior: UserBehavior,
  now: number,
  lastViewedMap?: Map<string, number>
) => {
  let penalty = 0;
  const recentTs = lastViewedMap ? lastViewedMap.get(video.id) : behavior.lastViewed.find(v => v.id === video.id)?.ts;
  if (recentTs) {
    const dt = now - recentTs;
    if (dt < 60 * 60 * 1000) penalty += 0.9;
    else if (dt < 24 * 60 * 60 * 1000) penalty += 0.5;
    else penalty += 0.25;
  }

  const watch = behavior.watchTime[video.id];
  if (watch) {
    if (watch.m === 0 && watch.s < 10) penalty += 0.35;
    if (watch.m >= 2) penalty -= 0.15;
  }

  return clamp01(penalty);
};

const pruneBehavior = (behavior: UserBehavior, now: number) => {
  behavior.lastViewed = behavior.lastViewed
    .filter((v) => v && typeof v.id === 'string' && v.id)
    .slice(0, MAX_LAST_VIEWED);

  const keepIds = new Set(behavior.lastViewed.map((v) => v.id));
  const watchCutoff = now - WATCH_TTL_MS;
  const metaCutoff = now - META_TTL_MS;

  for (const [id, wt] of Object.entries(behavior.watchTime)) {
    if (keepIds.has(id)) continue;
    if (wt?.ts && wt.ts >= watchCutoff) continue;
    delete behavior.watchTime[id];
  }

  for (const [id, meta] of Object.entries(behavior.videoMeta)) {
    if (keepIds.has(id)) continue;
    if (meta?.ts && meta.ts >= metaCutoff) continue;
    delete behavior.videoMeta[id];
  }
};

const commitBehavior = (behavior: UserBehavior, now: number) => {
  pruneBehavior(behavior, now);
  saveBehavior(behavior);
};

type RankContext = {
  behavior: UserBehavior;
  now: number;
  sessionBoost: ReturnType<typeof computeSessionBoost>;
  durationPref?: number | null;
  labelCache?: Map<string, string[]>;
  lastViewedMap?: Map<string, number>;
  sessionWeight?: number;
  favoriteIds?: Set<string>;
};

// Get or initialize user behavior data
function getBehavior(): UserBehavior {
  try {
    if (behaviorCache) return behaviorCache;
    const stored = storageGet(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.v === 2) {
        const behavior = parsed as UserBehavior;
        const now = nowTs();
        pruneBehavior(behavior, now);
        saveBehavior(behavior);
        behaviorCache = behavior;
        return behavior;
      }
      const ts = nowTs();
      const viewedTags: Record<string, { s: number; ts: number }> = {};
      const viewedCreators: Record<string, { s: number; ts: number }> = {};
      const viewedSources: Record<string, { s: number; ts: number }> = {};
      const watchTime: Record<string, { s: number; ts: number; m: number }> = {};
      const lastViewed: { id: string; ts: number }[] = [];

      if (parsed?.viewedTags && typeof parsed.viewedTags === 'object') {
        for (const [k, v] of Object.entries(parsed.viewedTags)) {
          const label = normLabel(k);
          if (!label) continue;
          const n = Number(v) || 0;
          if (n > 0) viewedTags[label] = { s: n, ts };
        }
      }
      if (parsed?.viewedCreators && typeof parsed.viewedCreators === 'object') {
        for (const [k, v] of Object.entries(parsed.viewedCreators)) {
          const id = String(k);
          const n = Number(v) || 0;
          if (id && n > 0) viewedCreators[id] = { s: n, ts };
        }
      }
      if (parsed?.viewedSources && typeof parsed.viewedSources === 'object') {
        for (const [k, v] of Object.entries(parsed.viewedSources)) {
          const id = String(k);
          const n = Number(v) || 0;
          if (id && n > 0) viewedSources[id] = { s: n, ts };
        }
      }
      if (parsed?.watchTime && typeof parsed.watchTime === 'object') {
        for (const [k, v] of Object.entries(parsed.watchTime)) {
          const id = String(k);
          const n = Number(v) || 0;
          if (id && n > 0) watchTime[id] = { s: n, ts, m: 0 };
        }
      }
      if (Array.isArray(parsed?.lastViewed)) {
        for (const id of parsed.lastViewed) {
          if (typeof id === 'string' && id) lastViewed.push({ id, ts });
        }
      }

      const behavior = {
        v: 2,
        viewedTags,
        viewedCreators,
        viewedSources,
        watchTime,
        videoMeta: {},
        lastViewed: lastViewed.slice(0, MAX_LAST_VIEWED),
        sessionStart: parsed?.sessionStart || ts
      };
      pruneBehavior(behavior, ts);
      saveBehavior(behavior);
      behaviorCache = behavior;
      return behavior;
    }
  } catch {}
  const behavior = {
    v: 2,
    viewedTags: {},
    viewedCreators: {},
    viewedSources: {},
    watchTime: {},
    videoMeta: {},
    lastViewed: [],
    sessionStart: Date.now()
  };
  behaviorCache = behavior;
  return behavior;
}

// Save behavior data
function saveBehavior(behavior: UserBehavior) {
  try {
    storageSet(STORAGE_KEY, JSON.stringify(behavior));
    behaviorCache = behavior;
  } catch {}
}

export const RecommendationService = {
  
  // Track when user views a video
  trackView(video: Video) {
    const behavior = getBehavior();
    const ts = nowTs();
    const tags = extractLabels(video);
    const creatorId = video.creator?.id ? String(video.creator.id) : undefined;
    const source = video.source ? String(video.source).trim() : undefined;
    const duration = typeof video.duration === 'number' ? video.duration : undefined;
    behavior.videoMeta[video.id] = { tags: [...tags], creatorId, source, d: duration, ts };
    
    // Track tags
    for (const label of tags) {
      bumpAffinity(behavior.viewedTags, label, 1, ts);
    }
    
    // Track creator
    if (creatorId) {
      bumpAffinity(behavior.viewedCreators, creatorId, 1.5, ts);
    }
    
    // Track source
    if (source) {
      bumpAffinity(behavior.viewedSources, source, 0.5, ts);
    }
    
    // Track last viewed (keep 50)
    behavior.lastViewed = [{ id: video.id, ts }, ...behavior.lastViewed.filter(v => v.id !== video.id)].slice(0, MAX_LAST_VIEWED);
    
    commitBehavior(behavior, ts);
  },
  
  // Track watch time for a video
  trackWatchTime(videoId: string, seconds: number) {
    const behavior = getBehavior();
    const ts = nowTs();
    const prev = behavior.watchTime[videoId];
    const nextSeconds = Math.max(prev?.s || 0, seconds);
    const meta = behavior.videoMeta[videoId];
    const d = meta?.d;

    // Engagement milestones:
    // - If duration is known: use ratio thresholds.
    // - If duration is missing (common for embeds): use absolute time thresholds.
    const milestone = getEngagementMilestone(nextSeconds, d);
    const prevM = prev?.m || 0;
    behavior.watchTime[videoId] = { s: nextSeconds, ts, m: Math.max(prevM, milestone) };

    if (meta && milestone > prevM) {
      const delta = milestone - prevM;
      const weight = delta * 2;
      for (const label of meta.tags || []) {
        bumpAffinity(behavior.viewedTags, label, weight, ts);
      }
      if (meta.creatorId) {
        bumpAffinity(behavior.viewedCreators, meta.creatorId, weight * 1.25, ts);
      }
      if (meta.source) {
        bumpAffinity(behavior.viewedSources, meta.source, weight * 0.5, ts);
      }
    }
    const shouldWrite = !prev || (ts - prev.ts >= WRITE_WT_EVERY_MS) || milestone > prevM;
    if (shouldWrite) commitBehavior(behavior, ts);
  },

  trackExit(video: Video, secondsWatched: number) {
    const behavior = getBehavior();
    const ts = nowTs();
    const tags = extractLabels(video);
    const creatorId = video.creator?.id ? String(video.creator.id) : undefined;
    const source = video.source ? String(video.source).trim() : undefined;
    const duration = typeof video.duration === 'number' ? video.duration : undefined;
    behavior.videoMeta[video.id] = { tags: [...tags], creatorId, source, d: duration, ts };

    const ratio = duration && duration > 0 ? clamp01(secondsWatched / duration) : null;

    if (ratio !== null) {
      if (ratio < 0.08) {
        for (const label of tags) bumpAffinity(behavior.viewedTags, label, -2.5, ts);
        if (creatorId) bumpAffinity(behavior.viewedCreators, creatorId, -3.0, ts);
        if (source) bumpAffinity(behavior.viewedSources, source, -1.2, ts);
      } else if (ratio < 0.2) {
        for (const label of tags) bumpAffinity(behavior.viewedTags, label, -1.2, ts);
        if (creatorId) bumpAffinity(behavior.viewedCreators, creatorId, -1.4, ts);
      } else if (ratio > 0.85) {
        for (const label of tags) bumpAffinity(behavior.viewedTags, label, 1.0, ts);
        if (creatorId) bumpAffinity(behavior.viewedCreators, creatorId, 1.2, ts);
      }
    } else {
      const m = getEngagementMilestone(secondsWatched, duration);
      if (m === 0) {
        const penalty = -2;
        for (const label of tags) bumpAffinity(behavior.viewedTags, label, penalty, ts);
        if (creatorId) bumpAffinity(behavior.viewedCreators, creatorId, penalty * 1.2, ts);
        if (source) bumpAffinity(behavior.viewedSources, source, penalty * 0.6, ts);
        commitBehavior(behavior, ts);
        return;
      }

      if (secondsWatched > 0 && secondsWatched < 10) {
        const penalty = -0.5;
        for (const label of tags) bumpAffinity(behavior.viewedTags, label, penalty, ts);
        if (creatorId) bumpAffinity(behavior.viewedCreators, creatorId, penalty * 1.1, ts);
        if (source) bumpAffinity(behavior.viewedSources, source, penalty * 0.5, ts);
      }
    }

    commitBehavior(behavior, ts);
  },

  trackSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (isSpecialSearch(trimmed)) return;

    const normalized = normalizeSearch(trimmed.replace(/^#/, ''));
    if (!normalized) return;

    const ts = nowTs();
    const stats = getSearchStats();
    const entry = stats[normalized];
    stats[normalized] = {
      c: (entry?.c || 0) + 1,
      ts,
      label: trimmed,
    };
    const pruned = pruneSearchStats(stats, ts);
    saveSearchStats(pruned);

    const tokens = tokenizeSearch(normalized);
    if (tokens.length > 0) {
      const behavior = getBehavior();
      for (const token of tokens) {
        bumpAffinity(behavior.viewedTags, token, 0.35, ts);
      }
      commitBehavior(behavior, ts);
    }
  },

  getTopSearches(limit: number = 5): string[] {
    const stats = getSearchStats();
    return Object.values(stats)
      .filter((entry) => entry && typeof entry.label === 'string')
      .sort((a, b) => {
        if (b.c !== a.c) return b.c - a.c;
        return b.ts - a.ts;
      })
      .slice(0, limit)
      .map((entry) => entry.label);
  },

  trackLike(video: Video, liked: boolean) {
    const behavior = getBehavior();
    const ts = nowTs();
    const delta = liked ? 4 : -2;
    const tags = extractLabels(video);
    const creatorId = video.creator?.id ? String(video.creator.id) : undefined;
    const source = video.source ? String(video.source).trim() : undefined;

    for (const label of tags) {
      bumpAffinity(behavior.viewedTags, label, delta, ts);
    }
    if (creatorId) {
      bumpAffinity(behavior.viewedCreators, creatorId, delta * 1.25, ts);
    }
    if (source) {
      bumpAffinity(behavior.viewedSources, source, delta * 0.5, ts);
    }

    commitBehavior(behavior, ts);
  },
  
  // Get saved watch time for a video
  getWatchTime(videoId: string): number {
    const behavior = getBehavior();
    return behavior.watchTime[videoId]?.s || 0;
  },
  
  // Get top tags user prefers
  getTopTags(limit: number = 5): string[] {
    const behavior = getBehavior();
    const ts = nowTs();
    return Object.entries(behavior.viewedTags)
      .map(([k, v]) => ({ k, s: decayScore(v.s, v.ts, ts) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(({ k }) => k);
  },
  
  // Get preferred source
  getPreferredSource(): string | null {
    const behavior = getBehavior();
    const ts = nowTs();
    const entries = Object.entries(behavior.viewedSources).map(([k, v]) => ({ k, s: decayScore(v.s, v.ts, ts) }));
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b.s - a.s)[0].k;
  },

  createRankContext(sessionWeight?: number): RankContext {
    const behavior = getBehavior();
    const now = nowTs();
    const sessionBoost = computeSessionBoost(behavior, now);
    const durationPref = computeDurationPreference(behavior);
    const labelCache = new Map<string, string[]>();
    const lastViewedMap = new Map(behavior.lastViewed.map((x) => [x.id, x.ts]));
    const favoriteIds = getFavoriteIds();
    return { behavior, now, sessionBoost, durationPref, labelCache, lastViewedMap, favoriteIds, sessionWeight };
  },

  getAffinityScore(video: Video, ctx?: RankContext): number {
    const behavior = ctx?.behavior ?? getBehavior();
    const now = ctx?.now ?? nowTs();
    const labels = getCachedLabels(video, behavior, ctx?.labelCache);
    return normalizeAffinity(computeAffinityRaw(video, behavior, now, labels, ctx?.sessionBoost));
  },

  getQualityScore(video: Video): number {
    return computeQualityScore(video);
  },

  getFreshnessScore(video: Video, now?: number): number {
    return computeFreshnessScore(video.publishedAt, now ?? nowTs());
  },
  
  // Score a video based on user preferences (higher = more relevant)
  scoreVideo(video: Video, ctx?: RankContext): number {
    const behavior = ctx?.behavior ?? getBehavior();
    const now = ctx?.now ?? nowTs();
    const sessionBoost = ctx?.sessionBoost ?? computeSessionBoost(behavior, now);
    const durationPref = ctx?.durationPref ?? computeDurationPreference(behavior);
    const labels = getCachedLabels(video, behavior, ctx?.labelCache);
    const sessionWeight = ctx?.sessionWeight ?? 0.35;
    const creatorId = video.creator?.id ? String(video.creator.id) : undefined;
    const source = video.source ? String(video.source).trim() : '';

    const profileScore = normalizeAffinity(computeAffinityRaw(video, behavior, now, labels, null));
    const sessionScore = computeSessionScore(labels, sessionBoost, creatorId, source || undefined);
    const affinity = profileScore * (1 - sessionWeight) + sessionScore * sessionWeight;
    const quality = computeQualityScore(video);
    const freshness = computeFreshnessScore(video.publishedAt, now);
    const novelty = computeNoveltyBoost(video, behavior, labels);
    const durationScore = computeDurationScore(video, durationPref ?? null);
    const fatigue = computeFatiguePenalty(video, behavior, now, ctx?.lastViewedMap);

    let score =
      affinity * 0.5 +
      quality * 0.18 +
      freshness * 0.12 +
      novelty * 0.1 +
      durationScore * 0.1 -
      fatigue * 0.3;

    const favoriteIds = ctx?.favoriteIds;
    if (favoriteIds && favoriteIds.has(video.id)) {
      score += 0.2;
    }

    score += stableNoise(video.id, behavior.sessionStart);
    return score;
  },
  
  // Sort videos by recommendation score
  sortByRecommendation(videos: Video[]): Video[] {
    const behavior = getBehavior();
    const now = nowTs();
    const sessionBoost = computeSessionBoost(behavior, now);
    const durationPref = computeDurationPreference(behavior);
    const labelCache = new Map<string, string[]>();
    const lastViewedMap = new Map(behavior.lastViewed.map((x) => [x.id, x.ts]));
    const favoriteIds = getFavoriteIds();
    const baseSessionWeight = 0.35;

    const prepared = videos.map((v) => {
      const labels = getCachedLabels(v, behavior, labelCache);
      const creatorId = v.creator?.id ? String(v.creator.id) : undefined;
      const source = v.source ? String(v.source).trim() : '';
      const profileScore = normalizeAffinity(computeAffinityRaw(v, behavior, now, labels, null));
      const sessionScore = computeSessionScore(labels, sessionBoost, creatorId, source || undefined);
      const quality = computeQualityScore(v);
      const freshness = computeFreshnessScore(v.publishedAt, now);
      const novelty = computeNoveltyBoost(v, behavior, labels);
      const durationScore = computeDurationScore(v, durationPref ?? null);
      const fatigue = computeFatiguePenalty(v, behavior, now, lastViewedMap);
      const favoriteBoost = favoriteIds.has(v.id) ? 0.2 : 0;
      const noise = stableNoise(v.id, behavior.sessionStart);
      return { v, profileScore, sessionScore, quality, freshness, novelty, durationScore, fatigue, favoriteBoost, noise };
    });

    const scoreWithWeight = (item: (typeof prepared)[number], sessionWeight: number) => {
      const affinity = item.profileScore * (1 - sessionWeight) + item.sessionScore * sessionWeight;
      return (
        affinity * 0.5 +
        item.quality * 0.18 +
        item.freshness * 0.12 +
        item.novelty * 0.1 +
        item.durationScore * 0.1 -
        item.fatigue * 0.3 +
        item.favoriteBoost +
        item.noise
      );
    };

    const scored = prepared
      .map(item => ({ item, s: scoreWithWeight(item, baseSessionWeight) }))
      .sort((a, b) => b.s - a.s);

    const picked: Video[] = [];
    const pickedSet = new Set<string>();
    const creatorCount: Record<string, number> = {};
    const tagCount: Record<string, number> = {};

    const canPick = (video: Video) => {
      if (pickedSet.has(video.id)) return false;
      const creatorId = video.creator?.id ? String(video.creator.id) : undefined;
      if (creatorId && (creatorCount[creatorId] || 0) >= 2 && picked.length < 12) return false;
      const tags = getCachedLabels(video, behavior, labelCache);
      const primary = tags[0];
      if (primary && (tagCount[primary] || 0) >= 3 && picked.length < 18) return false;
      return true;
    };

    const take = (video: Video) => {
      picked.push(video);
      pickedSet.add(video.id);
      const creatorId = video.creator?.id ? String(video.creator.id) : undefined;
      if (creatorId) creatorCount[creatorId] = (creatorCount[creatorId] || 0) + 1;
      const tags = getCachedLabels(video, behavior, labelCache);
      const primary = tags[0];
      if (primary) tagCount[primary] = (tagCount[primary] || 0) + 1;
    };

    const pool = [...scored];
    const sessionTags = Object.entries(sessionBoost.tags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
    const sessionTagSet = new Set(sessionTags);
    const viewedTagSet = new Set(Object.keys(behavior.viewedTags));
    const exploreEvery = videos.length < 40 ? 6 : 10;
    const adjacentEvery = videos.length < 40 ? 4 : 8;
    const sessionFocusCount = Math.ceil(scored.length * 0.3);
    const avoidRecentMs = 2 * 60 * 60 * 1000;

    const similarityPenalty = (video: Video) => {
      const tags = getCachedLabels(video, behavior, labelCache);
      const primary = tags[0];
      const creatorId = video.creator?.id ? String(video.creator.id) : '';
      let p = 0;
      const last = picked[picked.length - 1];
      const prev = picked[picked.length - 2];
      const lastCreator = last?.creator?.id ? String(last.creator.id) : '';
      const prevCreator = prev?.creator?.id ? String(prev.creator.id) : '';
      if (creatorId && creatorId === lastCreator && creatorId === prevCreator) p += 0.25;
      if (primary && (tagCount[primary] || 0) >= 2) p += 0.12;
      return p;
    };

    const hasSessionTag = (labels: string[]) => labels.some((l) => sessionTagSet.has(l));

    const isAdjacent = (video: Video) => {
      if (sessionTagSet.size === 0) return false;
      const labels = getCachedLabels(video, behavior, labelCache);
      const creatorId = video.creator?.id ? String(video.creator.id) : '';
      return hasSessionTag(labels) && (!creatorId || !behavior.viewedCreators[creatorId]);
    };

    const isExplore = (video: Video) => {
      const labels = getCachedLabels(video, behavior, labelCache);
      const creatorId = video.creator?.id ? String(video.creator.id) : '';
      const primary = labels[0];
      const newCreator = creatorId && !behavior.viewedCreators[creatorId];
      const newPrimary = primary && !viewedTagSet.has(primary);
      if (hasSessionTag(labels)) return false;
      return !!(newCreator || newPrimary);
    };

    const pickFromPool = (
      predicate: (video: Video) => boolean,
      scanLimit: number,
      sessionWeight: number,
      avoidRecent: boolean
    ) => {
      let bestIdx = -1;
      let bestScore = -Infinity;
      const scan = Math.min(pool.length, scanLimit);
      for (let i = 0; i < scan; i++) {
        const entry = pool[i];
        const video = entry.item.v;
        const recentTs = avoidRecent ? lastViewedMap.get(video.id) : null;
        if (avoidRecent && recentTs && now - recentTs < avoidRecentMs) continue;
        if (!predicate(video)) continue;
        if (!canPick(video)) continue;
        const score = scoreWithWeight(entry.item, sessionWeight);
        const adjusted = score - similarityPenalty(video);
        if (adjusted > bestScore) {
          bestScore = adjusted;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    while (pool.length > 0) {
      const sessionWeight = picked.length < sessionFocusCount ? 0.45 : 0.25;
      const isExploreSlot = (picked.length + 1) % exploreEvery === 0;
      const isAdjacentSlot = (picked.length + 1) % adjacentEvery === 0;
      let idx = -1;

      if (isExploreSlot) {
        idx = pickFromPool(isExplore, 80, sessionWeight, true);
      } else if (isAdjacentSlot) {
        idx = pickFromPool(isAdjacent, 60, sessionWeight, false);
      }

      if (idx === -1) {
        idx = pickFromPool(() => true, 60, sessionWeight, false);
      }

      if (idx === -1) idx = 0;
      const [entry] = pool.splice(idx, 1);
      take(entry.item.v);
    }

    return picked;
  },
  
  // Get personalized query based on user behavior
  getPersonalizedQuery(): string {
    const behavior = getBehavior();
    const topTags = this.getTopTags(3);
    if (topTags.length > 0) {
      const idx = hashString(String(behavior.sessionStart)) % topTags.length;
      return topTags[idx];
    }
    return 'popular';
  },
  
  // Check if user is new (no behavior data)
  isNewUser(): boolean {
    const behavior = getBehavior();
    return Object.keys(behavior.viewedTags).length === 0;
  },
  
  // Clear all behavior data
  clearBehavior() {
    storageRemove(STORAGE_KEY);
    behaviorCache = null;
  }
};
