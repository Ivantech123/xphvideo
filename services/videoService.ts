import { Video, UserMode, Creator } from '../types';
import { MOCK_VIDEOS, CREATORS } from '../constants';
import { TubeAdapter } from './tubeService';
import { CATEGORY_MAP } from './categoryMap';

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
        if (!query) query = 'popular';
        
        const fetchPromises = [];

        if (source === 'All' || source === 'Eporner') {
            fetchPromises.push(TubeAdapter.fetchEporner(query, 24, page));
        }
        if (source === 'All' || source === 'Pornhub') {
            fetchPromises.push(TubeAdapter.fetchPornhub(query, page));
        }
        if (source === 'All' || source === 'XVideos') {
            fetchPromises.push(TubeAdapter.fetchXVideos(query, page));
        }
        
        const results = await Promise.all(fetchPromises);
        
        // Flatten results
        const allFetched = results.flat();
        
        // Interleave if multiple sources
        if (source === 'All') {
             // Basic interleaving is hard with variable array lengths from flat(). 
             // Let's just shuffle or leave flat?
             // The previous logic assumed 3 specific arrays.
             // We can assume order: Eporner, Pornhub, XVideos in results if pushed in order.
             // But simpler to just use what we have.
             // Let's rely on basic flat for now, but shuffle might be better for variety?
             // Actually, the previous interleaving logic was better for "All".
             // Let's restore interleaving if All.
             
             // Extract back if All
             const ep = results[0] || [];
             const ph = results[1] || [];
             const xv = results[2] || [];
             
             const maxLength = Math.max(ep.length, ph.length, xv.length);
             for (let i = 0; i < maxLength; i++) {
                if (ph[i]) videos.push(ph[i]);
                if (ep[i]) videos.push(ep[i]);
                if (xv[i]) videos.push(xv[i]);
             }
        } else {
            videos = allFetched;
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