import { Video } from '../types';

// User behavior tracking for smart recommendations
interface UserBehavior {
  v: 2;
  viewedTags: Record<string, { s: number; ts: number }>;      // tag -> score
  viewedCreators: Record<string, { s: number; ts: number }>;  // creator id -> score
  viewedSources: Record<string, { s: number; ts: number }>;   // source -> score
  watchTime: Record<string, { s: number; ts: number; m: number }>; // video id -> seconds watched
  videoMeta: Record<string, { tags: string[]; creatorId?: string; source?: string; d?: number }>;
  lastViewed: { id: string; ts: number }[];
  sessionStart: number;
}

const STORAGE_KEY = 'velvet_user_behavior';

const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

const nowTs = () => Date.now();

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const decayScore = (score: number, lastTs: number, now: number) => {
  const dt = Math.max(0, now - lastTs);
  const k = Math.pow(0.5, dt / HALF_LIFE_MS);
  return score * k;
};

const bumpAffinity = (map: Record<string, { s: number; ts: number }>, key: string, delta: number, now: number) => {
  const prev = map[key];
  if (!prev) {
    map[key] = { s: delta, ts: now };
    return;
  }
  const decayed = decayScore(prev.s, prev.ts, now);
  map[key] = { s: decayed + delta, ts: now };
};

const normLabel = (s: string) => s.trim().toLowerCase();

const extractLabels = (video: Video): string[] => {
  const raw = (video.tags || []).map((t: any) => (typeof t === 'string' ? t : t?.label || '')).filter(Boolean);
  const uniq = new Set<string>();
  for (const r of raw) {
    const v = normLabel(r);
    if (v) uniq.add(v);
  }
  return Array.from(uniq).slice(0, 8);
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
    const wt = behavior.watchTime[it.id]?.s || 0;
    const m = getEngagementMilestone(wt, meta.d);
    if (m <= 0) continue;
    const w = m;

    for (const label of meta.tags || []) {
      tags[label] = (tags[label] || 0) + w;
    }
    if (meta.creatorId) creators[meta.creatorId] = (creators[meta.creatorId] || 0) + w;
    if (meta.source) sources[meta.source] = (sources[meta.source] || 0) + w;
  }

  return { tags, creators, sources };
};

// Get or initialize user behavior data
function getBehavior(): UserBehavior {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.v === 2) return parsed as UserBehavior;
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

      return {
        v: 2,
        viewedTags,
        viewedCreators,
        viewedSources,
        watchTime,
        videoMeta: {},
        lastViewed: lastViewed.slice(0, 50),
        sessionStart: parsed?.sessionStart || ts
      };
    }
  } catch {}
  return {
    v: 2,
    viewedTags: {},
    viewedCreators: {},
    viewedSources: {},
    watchTime: {},
    videoMeta: {},
    lastViewed: [],
    sessionStart: Date.now()
  };
}

// Save behavior data
function saveBehavior(behavior: UserBehavior) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(behavior));
  } catch {}
}

export const RecommendationService = {
  
  // Track when user views a video
  trackView(video: Video) {
    const behavior = getBehavior();
    const ts = nowTs();
    const tags = extractLabels(video);
    const creatorId = video.creator?.id;
    const source = video.source;
    const duration = typeof video.duration === 'number' ? video.duration : undefined;
    behavior.videoMeta[video.id] = { tags, creatorId, source, d: duration };
    
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
    
    // Track last viewed (keep 20)
    behavior.lastViewed = [{ id: video.id, ts }, ...behavior.lastViewed.filter(v => v.id !== video.id)].slice(0, 50);
    
    saveBehavior(behavior);
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
    let milestone = 0;
    if (d && d > 0) {
      const ratio = clamp01(nextSeconds / d);
      milestone = ratio >= 0.75 ? 3 : ratio >= 0.5 ? 2 : ratio >= 0.25 ? 1 : 0;
    } else {
      milestone = nextSeconds >= 180 ? 3 : nextSeconds >= 60 ? 2 : nextSeconds >= 20 ? 1 : 0;
    }
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
    saveBehavior(behavior);
  },

  trackExit(video: Video, secondsWatched: number) {
    const behavior = getBehavior();
    const ts = nowTs();
    const tags = extractLabels(video);
    const creatorId = video.creator?.id;
    const source = video.source;
    const duration = typeof video.duration === 'number' ? video.duration : undefined;
    behavior.videoMeta[video.id] = { tags, creatorId, source, d: duration };

    const m = getEngagementMilestone(secondsWatched, duration);
    if (m === 0) {
      const penalty = -2;
      for (const label of tags) bumpAffinity(behavior.viewedTags, label, penalty, ts);
      if (creatorId) bumpAffinity(behavior.viewedCreators, creatorId, penalty * 1.2, ts);
      if (source) bumpAffinity(behavior.viewedSources, source, penalty * 0.6, ts);
      saveBehavior(behavior);
      return;
    }

    if (secondsWatched > 0 && secondsWatched < 10) {
      const penalty = -0.5;
      for (const label of tags) bumpAffinity(behavior.viewedTags, label, penalty, ts);
      if (creatorId) bumpAffinity(behavior.viewedCreators, creatorId, penalty * 1.1, ts);
      if (source) bumpAffinity(behavior.viewedSources, source, penalty * 0.5, ts);
    }

    saveBehavior(behavior);
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
  
  // Score a video based on user preferences (higher = more relevant)
  scoreVideo(video: Video): number {
    const behavior = getBehavior();
    const ts = nowTs();
    const session = computeSessionBoost(behavior, ts);

    let score = 0;

    const rating = typeof video.rating === 'number' ? video.rating : 0;
    score += (rating / 100) * 6;

    const views = typeof video.views === 'number' ? video.views : 0;
    score += Math.log10(Math.max(1, views)) * 1.5;

    const tags = extractLabels(video);
    for (const label of tags) {
      const a = behavior.viewedTags[label];
      if (a) score += decayScore(a.s, a.ts, ts) * 1.25;
      const sb = session.tags[label] || 0;
      if (sb) score += sb * 1.5;
    }

    const creatorId = video.creator?.id;
    if (creatorId) {
      const a = behavior.viewedCreators[creatorId];
      if (a) score += decayScore(a.s, a.ts, ts) * 2.0;
      const sb = session.creators[creatorId] || 0;
      if (sb) score += sb * 2.2;
    }

    if (video.source) {
      const a = behavior.viewedSources[video.source];
      if (a) score += decayScore(a.s, a.ts, ts) * 0.8;
      const sb = session.sources[video.source] || 0;
      if (sb) score += sb * 0.8;
    }

    const recent = behavior.lastViewed.find(v => v.id === video.id);
    if (recent) {
      const dt = ts - recent.ts;
      if (dt < 60 * 60 * 1000) score -= 120;
      else if (dt < 24 * 60 * 60 * 1000) score -= 80;
      else score -= 40;
    } else {
      score += 10;
    }

    try {
      const favs = JSON.parse(localStorage.getItem('velvet_favorites') || '[]');
      if (Array.isArray(favs) && favs.some((v: any) => v?.id === video.id)) {
        score += 30;
      }
    } catch {}

    score += (Math.random() - 0.5) * 2;
    return score;
  },
  
  // Sort videos by recommendation score
  sortByRecommendation(videos: Video[]): Video[] {
    const scored = [...videos]
      .map(v => ({ v, s: this.scoreVideo(v) }))
      .sort((a, b) => b.s - a.s);

    const picked: Video[] = [];
    const creatorCount: Record<string, number> = {};
    const tagCount: Record<string, number> = {};

    const canPick = (video: Video) => {
      const creatorId = video.creator?.id;
      if (creatorId && (creatorCount[creatorId] || 0) >= 2 && picked.length < 12) return false;
      const tags = extractLabels(video);
      const primary = tags[0];
      if (primary && (tagCount[primary] || 0) >= 3 && picked.length < 18) return false;
      return true;
    };

    const take = (video: Video) => {
      picked.push(video);
      const creatorId = video.creator?.id;
      if (creatorId) creatorCount[creatorId] = (creatorCount[creatorId] || 0) + 1;
      const tags = extractLabels(video);
      const primary = tags[0];
      if (primary) tagCount[primary] = (tagCount[primary] || 0) + 1;
    };

    const pool = scored.map(x => x.v);
    const behavior = getBehavior();
    const now = nowTs();
    const recentSet = new Set(behavior.lastViewed.filter(x => now - x.ts < 24 * 60 * 60 * 1000).map(x => x.id));
    const exploreEvery = 4;

    while (pool.length > 0) {
      const wantExplore = picked.length > 0 && picked.length % exploreEvery === 0;
      let idx = -1;

      if (wantExplore) {
        const scan = Math.min(pool.length, 60);
        for (let i = scan - 1; i >= 0; i--) {
          const v = pool[i];
          if (recentSet.has(v.id)) continue;
          if (canPick(v)) {
            idx = i;
            break;
          }
        }
      }

      if (idx === -1) {
        const scan = Math.min(pool.length, 40);
        for (let i = 0; i < scan; i++) {
          if (canPick(pool[i])) {
            idx = i;
            break;
          }
        }
      }

      if (idx === -1) idx = 0;
      const [v] = pool.splice(idx, 1);
      take(v);
    }

    return picked;
  },
  
  // Get personalized query based on user behavior
  getPersonalizedQuery(): string {
    const topTags = this.getTopTags(3);
    if (topTags.length > 0) {
      // Return random top tag for variety
      return topTags[Math.floor(Math.random() * topTags.length)];
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
    localStorage.removeItem(STORAGE_KEY);
  }
};
