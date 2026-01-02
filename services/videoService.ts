import { Video, UserMode, Creator } from '../types';
import { TubeAdapter } from './tubeService';
import { CATEGORY_MAP } from './categoryMap';
import { RecommendationService } from './recommendationService';
import { AdminService } from './adminService';

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

type CacheEntry<T> = { ts: number; data: T };

const VIDEOS_CACHE_TTL_MS = 30_000;
const CREATORS_CACHE_TTL_MS = 5 * 60_000;

const videosCache = new Map<string, CacheEntry<Video[]>>();
let creatorsCache: CacheEntry<Creator[]> | null = null;

const isAbortError = (e: unknown, signal?: AbortSignal) => {
  if (signal?.aborted) return true;
  return e instanceof DOMException && e.name === 'AbortError';
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
    // 1. Fetch External Data (Real API)
    // We map UserMode/Category to search queries
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

        // If query is empty, use baseQuery or default
        if (!query && !baseQuery) {
             query = 'popular'; // Default fallback
        }
        
        const finalQuery = query || baseQuery || 'popular';
        if (import.meta.env.DEV) console.log('[VideoService] Final query:', finalQuery, 'sortMode:', sortMode, 'durationFilter:', durationFilter);

        // Cache is fine for static sorts, but for personalized 'trending' it makes the feed feel stale.
        // So we disable cache reads/writes for trending.
        cacheKey = sortMode === 'trending' ? null : JSON.stringify({ mode, finalQuery, page, source, sortMode, durationFilter });
        if (cacheKey) {
          const cached = videosCache.get(cacheKey);
          if (cached && Date.now() - cached.ts < VIDEOS_CACHE_TTL_MS) {
            return cached.data;
          }
        }

        // Fetch from all sources in parallel
        if (source === 'All') {
            if (import.meta.env.DEV) console.log('[VideoService] Fetching from all sources with query:', finalQuery, 'sortMode:', sortMode);
            
            const results = await Promise.all([
                TubeAdapter.fetchPornhub(finalQuery, page, sortMode, signal).catch(e => { if (!isAbortError(e, signal)) console.error('[VideoService] Pornhub fetch error:', e); return []; }),
                TubeAdapter.fetchEporner(finalQuery, 24, page, sortMode, signal).catch(e => { if (!isAbortError(e, signal)) console.error('[VideoService] Eporner fetch error:', e); return []; }),
                TubeAdapter.fetchXVideos(finalQuery, page, sortMode, signal).catch(e => { if (!isAbortError(e, signal)) console.error('[VideoService] XVideos fetch error:', e); return []; })
            ]);
            
            const ph = results[0] || [];
            const ep = results[1] || [];
            const xv = results[2] || [];
            
            if (import.meta.env.DEV) console.log('[VideoService] Fetched videos:', { pornhub: ph.length, eporner: ep.length, xvideos: xv.length });
            
            // Interleave
            const maxLength = Math.max(ph.length, ep.length, xv.length);
            videos = [];
            for (let i = 0; i < maxLength; i++) {
                if (ph[i]) videos.push(ph[i]);
                if (ep[i]) videos.push(ep[i]);
                if (xv[i]) videos.push(xv[i]);
            }
            
            // Add Manual Videos (Only on Page 1 and if query is generic or matches)
            if (page === 1) {
                const manualVideos = AdminService.getManualVideos();
                // Simple filter for manual videos based on query
                const filteredManual = manualVideos.filter(v => {
                    if (!query) return true;
                    return v.title.toLowerCase().includes(query.toLowerCase()) || 
                           v.tags.some(t => (typeof t === 'string' ? t : t.label).toLowerCase().includes(query.toLowerCase()));
                });
                videos = [...filteredManual, ...videos];
            }
            
            // Sort by recommendation score only if "trending" or default
            if (sortMode === 'trending') {
                videos = RecommendationService.sortByRecommendation(videos);
            }
            if (import.meta.env.DEV) console.log('[VideoService] Total videos after interleave:', videos.length);
        } else {
            // Single source - fetch directly
            if (source === 'Pornhub') {
                videos = await TubeAdapter.fetchPornhub(finalQuery, page, sortMode, signal);
            } else if (source === 'Eporner') {
                videos = await TubeAdapter.fetchEporner(finalQuery, 24, page, sortMode, signal);
            } else if (source === 'XVideos') {
                videos = await TubeAdapter.fetchXVideos(finalQuery, page, sortMode, signal);
            }
        }
        
        // --- ADMIN: Process Blocklist & Edits ---
        videos = AdminService.processVideos(videos);
        
        // Filter for shorts (videos under 60 seconds)
        if (filterShorts) {
            videos = videos.filter(v => v.duration > 0 && v.duration <= 60);
            if (import.meta.env.DEV) console.log('[VideoService] Filtered shorts, remaining:', videos.length);
        }

        // Filter by duration buckets
        if (durationFilter && durationFilter !== 'All') {
            if (durationFilter === 'Short') {
                videos = videos.filter(v => v.duration > 0 && v.duration < 600);
            } else if (durationFilter === 'Medium') {
                videos = videos.filter(v => v.duration >= 600 && v.duration <= 1200);
            } else if (durationFilter === 'Long') {
                videos = videos.filter(v => v.duration > 1200);
            }
            if (import.meta.env.DEV) console.log('[VideoService] Duration filter applied:', durationFilter, 'remaining:', videos.length);
        }

        if (tagFilters.length > 0) {
            const wanted = new Set(tagFilters.map(norm));
            videos = videos.filter(v => {
                const labels = (v.tags || []).map(t => norm(typeof t === 'string' ? t : t.label));
                return labels.some(l => wanted.has(l));
            });
        }
        
    } catch (e) {
        if (isAbortError(e, signal)) throw e;
        console.error('[VideoService] External API failed:', e);
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

  async getVideoById(id: string, signal?: AbortSignal): Promise<Video | undefined> {
    // Try to fetch dynamic data by ID via TubeAdapter (supports ep_ and ph_ prefixes)
    return await TubeAdapter.fetchVideoById(id, signal);
  },

  async getCreators(signal?: AbortSignal) {
    // Dynamic creators from Pornhub
    if (creatorsCache && Date.now() - creatorsCache.ts < CREATORS_CACHE_TTL_MS) {
      return creatorsCache.data;
    }
    try {
        const stars = await TubeAdapter.fetchPornstars(signal);
        if (stars.length > 0) {
          creatorsCache = { ts: Date.now(), data: stars };
          return stars;
        }
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
        const creators = await this.getCreators(signal);
        return creators.find(c => c.id === id);
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
