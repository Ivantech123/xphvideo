import { Video, UserMode } from '../types';
import { MOCK_VIDEOS, CREATORS } from '../constants';
import { TubeAdapter } from './tubeService';
import { CATEGORY_MAP } from './categoryMap';

// --- API SIMULATION & PARSING LOGIC ---

/**
 * In a real application, this service would fetch data from an external API endpoint
 * (e.g., a Tube site affiliate API or a headless CMS).
 */

export const VideoService = {
  
  async getVideos(mode: UserMode, category?: string, page: number = 1): Promise<Video[]> {
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
        
        // Parallel fetch from multiple providers
        const [epornerVids, phVids, xvVids] = await Promise.all([
          TubeAdapter.fetchEporner(query, 24, page),
          TubeAdapter.fetchPornhub(query, page),
          TubeAdapter.fetchXVideos(query, page)
        ]);
        
        // Interleave videos to mix sources
        const maxLength = Math.max(epornerVids.length, phVids.length, xvVids.length);
        for (let i = 0; i < maxLength; i++) {
            if (phVids[i]) videos.push(phVids[i]);
            if (epornerVids[i]) videos.push(epornerVids[i]);
            if (xvVids[i]) videos.push(xvVids[i]);
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