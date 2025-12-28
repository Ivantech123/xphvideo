import { Video, UserMode, Creator } from '../types';
import { MOCK_VIDEOS, CREATORS } from '../constants';
import { TubeAdapter } from './tubeService';
import { CATEGORY_MAP } from './categoryMap';
import { RecommendationService } from './recommendationService';

// Fisher-Yates shuffle for randomizing videos
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- API SIMULATION & PARSING LOGIC ---

/**
 * In a real application, this service would fetch data from an external API endpoint
 * (e.g., a Tube site affiliate API or a headless CMS).
 */

export const VideoService = {
  
  async getVideos(mode: UserMode, category?: string, page: number = 1, source: string = 'All'): Promise<Video[]> {
    // 1. Fetch External Data (Real API)
    // We map UserMode/Category to search queries
    let videos: Video[] = [];
    
    console.log('[VideoService] getVideos called:', { mode, category, page, source });
    
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
        
        let query = mappedCategory || baseQuery;
        
        console.log('[VideoService] Query params:', { baseQuery, rawCategory, mappedCategory, query });

        // Detect sort mode and special filters from query
        let sortMode: 'trending' | 'new' | 'best' = 'trending';
        let filterShorts = false; // Filter for videos under 60 seconds
        
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
            query = ''; // Fetch trending, then filter by duration
        }

        // If query is empty, use baseQuery or default
        if (!query && !baseQuery) {
             query = 'popular'; // Default fallback
        }
        
        const finalQuery = query || baseQuery || 'popular';
        console.log('[VideoService] Final query:', finalQuery, 'sortMode:', sortMode, 'filterShorts:', filterShorts);

        // Fetch from all sources in parallel
        if (source === 'All') {
            console.log('[VideoService] Fetching from all sources with query:', finalQuery, 'sortMode:', sortMode);
            
            const results = await Promise.all([
                TubeAdapter.fetchPornhub(finalQuery, page, sortMode).catch(e => { console.error('[VideoService] Pornhub fetch error:', e); return []; }),
                TubeAdapter.fetchEporner(finalQuery, 24, page, sortMode).catch(e => { console.error('[VideoService] Eporner fetch error:', e); return []; }),
                TubeAdapter.fetchXVideos(finalQuery, page, sortMode).catch(e => { console.error('[VideoService] XVideos fetch error:', e); return []; })
            ]);
            
            const ph = results[0] || [];
            const ep = results[1] || [];
            const xv = results[2] || [];
            
            console.log('[VideoService] Fetched videos:', { pornhub: ph.length, eporner: ep.length, xvideos: xv.length });
            
            // Interleave
            const maxLength = Math.max(ph.length, ep.length, xv.length);
            videos = [];
            for (let i = 0; i < maxLength; i++) {
                if (ph[i]) videos.push(ph[i]);
                if (ep[i]) videos.push(ep[i]);
                if (xv[i]) videos.push(xv[i]);
            }
            
            // Sort by recommendation score
            videos = RecommendationService.sortByRecommendation(videos);
            console.log('[VideoService] Total videos after interleave:', videos.length);
        } else {
            // Single source - fetch directly
            if (source === 'Pornhub') {
                videos = await TubeAdapter.fetchPornhub(finalQuery, page, sortMode);
            } else if (source === 'Eporner') {
                videos = await TubeAdapter.fetchEporner(finalQuery, 24, page, sortMode);
            } else if (source === 'XVideos') {
                videos = await TubeAdapter.fetchXVideos(finalQuery, page, sortMode);
            }
        }
        
        // Filter for shorts (videos under 60 seconds)
        if (filterShorts) {
            videos = videos.filter(v => v.duration > 0 && v.duration <= 60);
            console.log('[VideoService] Filtered shorts, remaining:', videos.length);
        }
        
    } catch (e) {
        console.error('[VideoService] External API failed:', e);
        videos = []; 
    }

    console.log('[VideoService] Returning', videos.length, 'videos');
    return videos;
  },

  async getVideoById(id: string): Promise<Video | undefined> {
    // Try to fetch dynamic data by ID via TubeAdapter (supports ep_ and ph_ prefixes)
    return await TubeAdapter.fetchVideoById(id);
  },

  async getCreators() {
    // Dynamic creators from Pornhub
    try {
        const stars = await TubeAdapter.fetchPornstars();
        if (stars.length > 0) return stars;
    } catch (e) {
        console.warn("Failed to fetch creators", e);
    }
    return []; 
  },

  async getCreatorById(id: string): Promise<Creator | undefined> {
    try {
        const creators = await this.getCreators();
        return creators.find(c => c.id === id);
    } catch (e) {
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