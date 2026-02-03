import { Video, UserMode, Creator } from '../types';
import { CATEGORY_MAP } from './categoryMap';
import { RecommendationService } from './recommendationService';
import { AdminService } from './adminService';
import { supabase } from './supabase';
import { SearchService } from './searchService';
import { makeCreatorFromCatalog } from './creatorUtils';

const norm = (s: string) => s.trim().toLowerCase();

const parseSearchFilters = (raw: string) => {
  const tagFilters: string[] = [];
  const cleaned = raw.replace(/#[^\s#]+/g, (m) => {
    const t = norm(m.slice(1));
    if (t) tagFilters.push(t);
    return ' ';
  });

  // Support comma-separated tags: "blonde, anal" => tag filters.
  // We only treat comma parts that are single tokens (no spaces) as tags.
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const keep: string[] = [];
      for (const p of parts) {
        if (!p.includes(' ')) {
          const t = norm(p);
          if (t) tagFilters.push(t);
        } else {
          keep.push(p);
        }
      }
      const text = keep.join(' ').replace(/\s+/g, ' ').trim();
      return { text, tagFilters };
    }
  }

  const text = cleaned.replace(/\s+/g, ' ').trim();
  return { text, tagFilters };
};

// Fisher-Yates shuffle for randomizing videos
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const getSourceKey = (video: Video) => (video.source ? String(video.source).trim() : 'Manual');

const balanceBySource = (videos: Video[], maxStreak: number = 3): Video[] => {
  if (videos.length <= 2) return videos;
  const buckets = new Map<string, Video[]>();
  for (const video of videos) {
    const key = getSourceKey(video);
    const list = buckets.get(key);
    if (list) list.push(video);
    else buckets.set(key, [video]);
  }
  if (buckets.size <= 1) return videos;

  const sources = Array.from(buckets.keys());
  const result: Video[] = [];
  let lastSource = '';
  let streak = 0;
  const total = videos.length;

  for (let guard = 0; result.length < total && guard < total * 5; guard += 1) {
    const candidates = sources
      .filter((s) => (buckets.get(s)?.length ?? 0) > 0)
      .sort((a, b) => (buckets.get(b)?.length ?? 0) - (buckets.get(a)?.length ?? 0));
    if (candidates.length === 0) break;

    let picked = candidates[0];
    if (picked === lastSource && streak >= maxStreak && candidates.length > 1) {
      picked = candidates.find((s) => s !== lastSource) || picked;
    }

    const next = buckets.get(picked)?.shift();
    if (!next) continue;
    result.push(next);
    if (picked === lastSource) {
      streak += 1;
    } else {
      lastSource = picked;
      streak = 1;
    }
  }

  return result.length === videos.length ? result : videos;
};

type CacheEntry<T> = { ts: number; data: T };

const VIDEOS_CACHE_TTL_MS = 30_000;
const CREATORS_CACHE_TTL_MS = 5 * 60_000;

const videosCache = new Map<string, CacheEntry<Video[]>>();
let creatorsCache: CacheEntry<Creator[]> | null = null;

const isAbortError = (e: unknown, signal?: AbortSignal) => {
  if (signal?.aborted) return true;
  return e instanceof DOMException && e.name === 'AbortError';
};

type CatalogRow = {
  id: string;
  source: string | null;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  embed_url: string | null;
  video_url: string | null;
  duration: number | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_avatar: string | null;
  tags: string[] | null;
  views: number | null;
  rating: number | null;
  quality: string | null;
  published_at?: string | null;
};

const LIVE_SOURCES_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_LIVE_SOURCES === 'true';

const loadTubeAdapter = async () => {
  const mod = await import('./tubeService');
  return mod.TubeAdapter;
};

const mapCatalogRowToVideo = (row: CatalogRow): Video => {
  const creator = makeCreatorFromCatalog({
    source: row.source,
    creator_id: row.creator_id,
    creator_name: row.creator_name,
    creator_avatar: row.creator_avatar,
  });

  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    thumbnail: row.thumbnail || '',
    embedUrl: row.embed_url || undefined,
    videoUrl: row.video_url || undefined,
    source: (row.source as any) || undefined,
    duration: row.duration || 0,
    creator,
    tags: (row.tags || []).map((t) => ({ id: t, label: t })),
    views: Number(row.views || 0) || 0,
    rating: row.rating != null ? Number(row.rating) : undefined,
    quality: ((row.quality as any) || 'HD') as any,
    publishedAt: row.published_at || undefined,
  };
};

const applyDurationFilterToQuery = <T extends { gt: any; gte: any; lt: any; lte: any }>(
  q: T,
  durationFilter: string,
  filterShorts: boolean
) => {
  if (filterShorts) {
    return q.gt('duration', 0).lte('duration', 60);
  }

  if (!durationFilter || durationFilter === 'All') return q;
  if (durationFilter === 'Short') return q.gt('duration', 0).lt('duration', 600);
  if (durationFilter === 'Medium') return q.gte('duration', 600).lte('duration', 1200);
  if (durationFilter === 'Long') return q.gt('duration', 1200);
  return q;
};

const fetchCatalogVideos = async (params: {
  page: number;
  limit: number;
  source: string;
  sort: 'trending' | 'new' | 'best';
  durationFilter: string;
  tagFilters: string[];
  filterShorts: boolean;
  creatorId?: string;
  signal?: AbortSignal;
}): Promise<Video[]> => {
  const offset = Math.max(0, (params.page - 1) * params.limit);
  const to = offset + params.limit - 1;

  let q = supabase
    .from('videos_catalog')
    .select(
      'id, source, title, description, thumbnail, embed_url, video_url, duration, creator_id, creator_name, creator_avatar, tags, views, rating, quality, published_at, updated_at'
    )
    .range(offset, to);

  if (params.signal) {
    q = (q as any).abortSignal(params.signal);
  }

  if (params.source && params.source !== 'All') {
    q = q.eq('source', params.source);
  }

  if (params.creatorId) {
    q = q.eq('creator_id', params.creatorId);
  }

  q = applyDurationFilterToQuery(q as any, params.durationFilter, params.filterShorts) as any;

  if (params.tagFilters.length > 0) {
    q = q.overlaps('tags', params.tagFilters);
  }

  if (params.sort === 'best') {
    q = q.order('rating', { ascending: false, nullsFirst: false });
    q = q.order('views', { ascending: false, nullsFirst: false });
    q = q.order('updated_at', { ascending: false });
  } else if (params.sort === 'new') {
    q = q.order('published_at', { ascending: false, nullsFirst: false });
    q = q.order('updated_at', { ascending: false });
    q = q.order('views', { ascending: false, nullsFirst: false });
  } else {
    q = q.order('views', { ascending: false, nullsFirst: false });
    q = q.order('updated_at', { ascending: false });
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r) => mapCatalogRowToVideo(r as any));
};

// --- DATA FETCHING & PARSING LOGIC ---

/**
 * Service to fetch data from external API endpoints
 * (Tube site affiliate APIs or headless CMS).
 */

export const VideoService = {
  
  async getVideos(
    mode: UserMode,
    category?: string,
    page: number = 1,
    source: string = 'All',
    sort: 'trending' | 'new' | 'best' = 'trending',
    durationFilter: string = 'All',
    signal?: AbortSignal
  ): Promise<Video[]> {
    let videos: Video[] = [];
    let query = '';
    let sortMode: 'trending' | 'new' | 'best' = sort;
    let filterShorts = false; // Filter for videos under 60 seconds
    let tagFilters: string[] = [];
    
    if (import.meta.env.DEV) console.log('[VideoService] getVideos called:', { mode, category, page, source });

    let cacheKey: string | null = null;
    
    try {
        // Map 'Him', 'Her' etc to base search terms if no specific category is selected
        let baseQuery = '';
        if (mode === 'Him') baseQuery = 'straight';
        if (mode === 'Her') baseQuery = 'for women';
        if (mode === 'Couples') baseQuery = 'couples';
        if (mode === 'Gay') baseQuery = 'gay';
        if (mode === 'Trans') baseQuery = 'transgender';
        if (mode === 'Lesbian') baseQuery = 'lesbian';

        let rawCategory = category && category !== 'All' && category !== 'Все видео' ? category : '';
        // Translate category if possible
        let mappedCategory = CATEGORY_MAP[rawCategory] || rawCategory;
        
        query = mappedCategory || baseQuery;

        const parsed = parseSearchFilters(query);
        tagFilters = parsed.tagFilters;
        query = parsed.text || (tagFilters.length > 0 ? tagFilters.join(' ') : query);
        
        if (import.meta.env.DEV) console.log('[VideoService] Query params:', { baseQuery, rawCategory, mappedCategory, query });

        // Detect sort mode and special filters from query
        if (query === 'trending' || query === 'В тренде') {
            sortMode = 'trending';
            query = ''; // Clear query to fetch general trending
        } else if (query === 'new' || query === 'Новое') {
            sortMode = 'new';
            query = ''; 
        } else if (query === 'best') {
            sortMode = 'best';
            query = '';
        } else if (query === 'shorts' || query === 'Shorts') {
            // Shorts = videos under 1 minute
            filterShorts = true;
            sortMode = 'trending';
            query = '';
        }

        // Unlike the legacy tube fetcher, catalog mode can browse with an empty query.
        // (Empty q = "feed".) Only use text search when we actually have something to search for.
        const finalQuery = query || baseQuery || '';
        if (import.meta.env.DEV) console.log('[VideoService] Final query:', finalQuery, 'sortMode:', sortMode, 'durationFilter:', durationFilter);

        // Cache is fine for static sorts, but for personalized 'trending' it makes the feed feel stale.
        // So we disable cache reads/writes for trending.
        cacheKey = sortMode === 'trending' ? null : JSON.stringify({ mode, finalQuery, page, source, sortMode, durationFilter, tagFilters, filterShorts });
        if (cacheKey) {
          const cached = videosCache.get(cacheKey);
          if (cached && Date.now() - cached.ts < VIDEOS_CACHE_TTL_MS) {
            return cached.data;
          }
        }

        const limit = 24;

        // 1) Catalog browsing (empty query) — fast and CORS-safe.
        if (!finalQuery) {
          videos = await fetchCatalogVideos({
            page,
            limit,
            source,
            sort: sortMode,
            durationFilter,
            tagFilters,
            filterShorts,
            signal,
          });
        } else {
          // 2) Indexed search (FTS + trigram) + local personalization ranking.
          const searchQuery = [
            ...tagFilters.map((t) => `#${t}`),
            finalQuery
          ].filter(Boolean).join(' ').trim();

          const offset = (page - 1) * limit;
          const { data, error } = await SearchService.searchVideos(searchQuery, {
            limit,
            offset,
            source,
            duration: durationFilter as any,
            sort: sortMode,
          });

          if (!error) {
            videos = data;
          } else if (LIVE_SOURCES_ENABLED) {
            // Optional dev-only fallback to live tube sources.
            const TubeAdapter = await loadTubeAdapter();
            if (source === 'All') {
              const results = await Promise.all([
                TubeAdapter.fetchPornhub(finalQuery, page, sortMode, signal).catch(() => []),
                TubeAdapter.fetchEporner(finalQuery, 24, page, sortMode, signal).catch(() => []),
                TubeAdapter.fetchXVideos(finalQuery, page, sortMode, signal).catch(() => []),
              ]);
              videos = balanceBySource([...(results[0] || []), ...(results[1] || []), ...(results[2] || [])]);
            } else if (source === 'Pornhub') {
              videos = await TubeAdapter.fetchPornhub(finalQuery, page, sortMode, signal);
            } else if (source === 'Eporner') {
              videos = await TubeAdapter.fetchEporner(finalQuery, 24, page, sortMode, signal);
            } else if (source === 'XVideos') {
              videos = await TubeAdapter.fetchXVideos(finalQuery, page, sortMode, signal);
            }
          }
        }

        // Local-only manual videos can be blended in on page 1.
        if (page === 1 && (source === 'All' || source === 'Local')) {
          const manualVideos = AdminService.getManualVideos();
          const q = finalQuery.toLowerCase();
          const wanted = new Set(tagFilters.map(norm));
          const filteredManual = manualVideos.filter(v => {
            if (!q && wanted.size === 0) return true;
            if (q && v.title.toLowerCase().includes(q)) return true;
            const labels = (v.tags || []).map(t => norm(typeof t === 'string' ? t : t.label));
            if (wanted.size > 0 && labels.some(l => wanted.has(l))) return true;
            if (q && labels.some(l => l.includes(q))) return true;
            return false;
          });
          videos = [...filteredManual, ...videos];
        }
        
        // --- ADMIN: Process Blocklist & Edits ---
        videos = AdminService.processVideos(videos);
        
        // Extra safeguards (SearchService handles most; manual videos may still need filtering).
        if (filterShorts) {
          videos = videos.filter(v => v.duration > 0 && v.duration <= 60);
        }

        if (durationFilter && durationFilter !== 'All') {
          if (durationFilter === 'Short') videos = videos.filter(v => v.duration > 0 && v.duration < 600);
          else if (durationFilter === 'Medium') videos = videos.filter(v => v.duration >= 600 && v.duration <= 1200);
          else if (durationFilter === 'Long') videos = videos.filter(v => v.duration > 1200);
        }

        if (tagFilters.length > 0) {
          const wanted = new Set(tagFilters.map(norm));
          videos = videos.filter(v => {
            const labels = (v.tags || []).map(t => norm(typeof t === 'string' ? t : t.label));
            return labels.some(l => wanted.has(l));
          });
        }

        // Personalization + variety (mirrors legacy behavior, but on catalog data).
        if (sortMode === 'trending') {
          videos = RecommendationService.sortByRecommendation(videos);
        }
        if (source === 'All') {
          videos = balanceBySource(videos);
        }
        
    } catch (e) {
        if (isAbortError(e, signal)) throw e;
        console.error('[VideoService] Catalog fetch failed:', e);
        videos = [];
    }

    // Shuffle only for non-personalized sorts. For 'trending' we already sort by RecommendationService.
    if (sortMode === 'new') {
        videos = [...videos].sort((a, b) => {
            const ta = Date.parse(a.publishedAt || '');
            const tb = Date.parse(b.publishedAt || '');
            const na = Number.isFinite(ta) ? ta : 0;
            const nb = Number.isFinite(tb) ? tb : 0;
            if (nb !== na) return nb - na;
            return (b.views || 0) - (a.views || 0);
        });
    }
    if (!query && !filterShorts && sortMode === 'best') {
        videos = shuffleArray(videos);
    }

    if (import.meta.env.DEV) console.log('[VideoService] Returning', videos.length, 'videos');

    if (cacheKey) videosCache.set(cacheKey, { ts: Date.now(), data: videos });
    return videos;
  },

  async getVideosByCreatorId(
    creatorId: string,
    page: number = 1,
    source: string = 'All',
    sort: 'trending' | 'new' | 'best' = 'trending',
    durationFilter: string = 'All',
    signal?: AbortSignal
  ): Promise<Video[]> {
    if (!creatorId) return [];

    try {
      let videos = await fetchCatalogVideos({
        creatorId,
        page,
        limit: 24,
        source,
        sort,
        durationFilter,
        tagFilters: [],
        filterShorts: false,
        signal,
      });

      videos = AdminService.processVideos(videos);
      if (sort === 'trending') {
        videos = RecommendationService.sortByRecommendation(videos);
      }
      return videos;
    } catch (e) {
      if (isAbortError(e, signal)) throw e;
      return [];
    }
  },

  async getVideoById(id: string, signal?: AbortSignal): Promise<Video | undefined> {
    try {
      let q = supabase
        .from('videos_catalog')
        .select('id, source, title, description, thumbnail, embed_url, video_url, duration, creator_id, creator_name, creator_avatar, tags, views, rating, quality, published_at')
        .eq('id', id)
        .maybeSingle();

      if (signal) {
        q = (q as any).abortSignal(signal);
      }

      const { data, error } = await q;
      if (error) throw error;
      if (data) {
        const v = mapCatalogRowToVideo(data as any);
        return AdminService.processVideos([v])[0];
      }
    } catch (e) {
      if (isAbortError(e, signal)) throw e;
    }

    if (LIVE_SOURCES_ENABLED) {
      try {
        const TubeAdapter = await loadTubeAdapter();
        return await TubeAdapter.fetchVideoById(id, signal);
      } catch (e) {
        if (isAbortError(e, signal)) throw e;
      }
    }

    return undefined;
  },

  async getCreators(signal?: AbortSignal) {
    if (creatorsCache && Date.now() - creatorsCache.ts < CREATORS_CACHE_TTL_MS) {
      return creatorsCache.data;
    }
    try {
        let q = supabase
          .from('videos_catalog')
          .select('creator_id, creator_name, creator_avatar, source, views')
          .not('creator_id', 'is', null)
          .order('views', { ascending: false, nullsFirst: false })
          .limit(1000);

        if (signal) {
          q = (q as any).abortSignal(signal);
        }

        const { data, error } = await q;
        if (error) throw error;

        const rows = (data || []) as Array<{
          creator_id: string | null;
          creator_name: string | null;
          creator_avatar: string | null;
          source: string | null;
        }>;

        const seen = new Set<string>();
        const creators: Creator[] = [];
        for (const r of rows) {
          const creator = makeCreatorFromCatalog(r as any);
          if (!creator.subscribable) continue;
          if (!creator.id || seen.has(creator.id)) continue;
          seen.add(creator.id);
          creators.push(creator);
          if (creators.length >= 200) break;
        }

        creatorsCache = { ts: Date.now(), data: creators };
        return creators;
    } catch (e) {
        if (isAbortError(e, signal)) throw e;
        console.warn("Failed to fetch creators", e);
    }
    // Cache negative result to avoid spamming a flaky endpoint.
    creatorsCache = { ts: Date.now(), data: [] };
    return [];
  },

  async getCreatorById(id: string, signal?: AbortSignal): Promise<Creator | undefined> {
    try {
      let q = supabase
        .from('videos_catalog')
        .select('creator_id, creator_name, creator_avatar, source, views')
        .eq('creator_id', id)
        .order('views', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (signal) {
        q = (q as any).abortSignal(signal);
      }

      const { data, error } = await q;
      if (error) throw error;
      if (!data) return undefined;

      const creator = makeCreatorFromCatalog(data as any);

      // Best-effort stats.
      try {
        let cq = supabase
          .from('videos_catalog')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', id);
        if (signal) {
          cq = (cq as any).abortSignal(signal);
        }
        const { count } = await cq;
        if (typeof count === 'number') {
          creator.stats = { videos: count, views: 0 };
        }
      } catch {}

      return creator;
    } catch (e) {
      if (isAbortError(e, signal)) throw e;
      console.warn("Failed to fetch creator by ID", e);
      return undefined;
    }
  },

  // --- LOCAL STORAGE HELPERS (History/Favorites) ---
  
  addToHistory(video: Video) {
    const history = this.getHistory();
    // Remove if exists (to move to top)
    const filtered = history.filter(v => v.id !== video.id);
    const newHistory = [video, ...filtered].slice(0, 50); // Keep last 50
    localStorage.setItem('velvet_history', JSON.stringify(newHistory));
  },

  getHistory(): Video[] {
    try {
      return JSON.parse(localStorage.getItem('velvet_history') || '[]');
    } catch { return []; }
  },

  toggleFavorite(video: Video) {
    const favorites = this.getFavorites();
    const exists = favorites.find(v => v.id === video.id);
    let newFavs;
    if (exists) {
      newFavs = favorites.filter(v => v.id !== video.id);
    } else {
      newFavs = [video, ...favorites];
    }
    localStorage.setItem('velvet_favorites', JSON.stringify(newFavs));
    RecommendationService.trackLike(video, !exists);
    return !exists; // returns true if added, false if removed
  },

  getFavorites(): Video[] {
    try {
      return JSON.parse(localStorage.getItem('velvet_favorites') || '[]');
    } catch { return []; }
  },

  isFavorite(id: string): boolean {
    const favorites = this.getFavorites();
    return !!favorites.find(v => v.id === id);
  }
};
