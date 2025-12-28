import { Video } from '../types';

const STORAGE_KEYS = {
  BLACKLIST: 'velvet_admin_blacklist',
  MANUAL_VIDEOS: 'velvet_admin_manual_videos',
  EDITS: 'velvet_admin_edits'
};

export const AdminService = {
  // --- BLACKLIST (Hidden Videos) ---
  
  getBlockedIds(): string[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BLACKLIST) || '[]');
    } catch { return []; }
  },

  clearBlocked() {
    localStorage.setItem(STORAGE_KEYS.BLACKLIST, JSON.stringify([]));
  },

  blockVideo(id: string) {
    const list = this.getBlockedIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(STORAGE_KEYS.BLACKLIST, JSON.stringify(list));
    }
  },

  unblockVideo(id: string) {
    const list = this.getBlockedIds();
    const newList = list.filter(x => x !== id);
    localStorage.setItem(STORAGE_KEYS.BLACKLIST, JSON.stringify(newList));
  },

  isBlocked(id: string): boolean {
    return this.getBlockedIds().includes(id);
  },

  // --- MANUAL VIDEOS (Added by Admin) ---

  getManualVideos(): Video[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.MANUAL_VIDEOS) || '[]');
    } catch { return []; }
  },

  clearManualVideos() {
    localStorage.setItem(STORAGE_KEYS.MANUAL_VIDEOS, JSON.stringify([]));
  },

  exportManualVideos(): string {
    return JSON.stringify(this.getManualVideos(), null, 2);
  },

  importManualVideos(json: string) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) throw new Error('Invalid format');
    localStorage.setItem(STORAGE_KEYS.MANUAL_VIDEOS, JSON.stringify(parsed));
  },

  addManualVideo(video: Video) {
    const list = this.getManualVideos();
    // Ensure ID is unique if not provided properly (though caller should handle)
    if (!video.id) video.id = `manual_${Date.now()}`;
    
    list.push(video);
    localStorage.setItem(STORAGE_KEYS.MANUAL_VIDEOS, JSON.stringify(list));
  },

  updateManualVideo(video: Video) {
    const list = this.getManualVideos();
    const index = list.findIndex(v => v.id === video.id);
    if (index !== -1) {
      list[index] = video;
      localStorage.setItem(STORAGE_KEYS.MANUAL_VIDEOS, JSON.stringify(list));
    }
  },

  deleteManualVideo(id: string) {
    const list = this.getManualVideos();
    const newList = list.filter(v => v.id !== id);
    localStorage.setItem(STORAGE_KEYS.MANUAL_VIDEOS, JSON.stringify(newList));
  },

  // --- EDITS (Overrides for External Videos) ---
  
  getEdits(): Record<string, Partial<Video>> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.EDITS) || '{}');
    } catch { return {}; }
  },

  clearEdits() {
    localStorage.setItem(STORAGE_KEYS.EDITS, JSON.stringify({}));
  },

  saveVideoEdit(id: string, overrides: Partial<Video>) {
    const edits = this.getEdits();
    edits[id] = { ...(edits[id] || {}), ...overrides };
    localStorage.setItem(STORAGE_KEYS.EDITS, JSON.stringify(edits));
  },

  // --- PROCESSOR ---

  processVideos(videos: Video[]): Video[] {
    const blocked = this.getBlockedIds();
    const edits = this.getEdits();

    return videos
      .filter(v => !blocked.includes(v.id))
      .map(v => {
        if (edits[v.id]) {
          return { ...v, ...edits[v.id] };
        }
        return v;
      });
  }
};
