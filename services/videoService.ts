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
        if (!query) {
          // Use personalized query based on user behavior
          query = RecommendationService.getPersonalizedQuery();
        }
        
        // Prioritize Pornhub (fastest) for quick first paint
        if (source === 'All') {
            // Load Pornhub first for fast initial render
            const phVideos = await TubeAdapter.fetchPornhub(query, page);
            videos = [...phVideos];
            
            // Then load other sources in parallel (non-blocking for UI)
            Promise.all([
                TubeAdapter.fetchEporner(query, 24, page),
                TubeAdapter.fetchXVideos(query, page)
            ]).then(([ep, xv]) => {
                // These will be available for next render/scroll
                console.log(`[VideoService] Background loaded: ${ep.length} Eporner, ${xv.length} XVideos`);
            }).catch(() => {});
            
            // Sort by recommendation score
            videos = RecommendationService.sortByRecommendation(videos);
        } else {
            // Single source - fetch directly
            if (source === 'Pornhub') {
                videos = await TubeAdapter.fetchPornhub(query, page);
            } else if (source === 'Eporner') {
                videos = await TubeAdapter.fetchEporner(query, 24, page);
            } else if (source === 'XVideos') {
                videos = await TubeAdapter.fetchXVideos(query, page);
            }
        }
        
    } catch (e) {
        console.warn("External API failed", e);
        videos = []; 
    }

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