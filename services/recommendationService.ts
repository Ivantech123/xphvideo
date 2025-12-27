import { Video } from '../types';

// User behavior tracking for smart recommendations
interface UserBehavior {
  viewedTags: Record<string, number>;      // tag -> view count
  viewedCreators: Record<string, number>;  // creator id -> view count
  viewedSources: Record<string, number>;   // source -> view count
  watchTime: Record<string, number>;       // video id -> seconds watched
  lastViewed: string[];                    // last 20 video IDs
  sessionStart: number;
}

const STORAGE_KEY = 'velvet_user_behavior';

// Get or initialize user behavior data
function getBehavior(): UserBehavior {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    viewedTags: {},
    viewedCreators: {},
    viewedSources: {},
    watchTime: {},
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
    
    // Track tags
    video.tags?.forEach(tag => {
      const label = typeof tag === 'string' ? tag : tag.label;
      behavior.viewedTags[label] = (behavior.viewedTags[label] || 0) + 1;
    });
    
    // Track creator
    if (video.creator?.id) {
      behavior.viewedCreators[video.creator.id] = (behavior.viewedCreators[video.creator.id] || 0) + 1;
    }
    
    // Track source
    if (video.source) {
      behavior.viewedSources[video.source] = (behavior.viewedSources[video.source] || 0) + 1;
    }
    
    // Track last viewed (keep 20)
    behavior.lastViewed = [video.id, ...behavior.lastViewed.filter(id => id !== video.id)].slice(0, 20);
    
    saveBehavior(behavior);
  },
  
  // Track watch time for a video
  trackWatchTime(videoId: string, seconds: number) {
    const behavior = getBehavior();
    behavior.watchTime[videoId] = Math.max(behavior.watchTime[videoId] || 0, seconds);
    saveBehavior(behavior);
  },
  
  // Get top tags user prefers
  getTopTags(limit: number = 5): string[] {
    const behavior = getBehavior();
    return Object.entries(behavior.viewedTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  },
  
  // Get preferred source
  getPreferredSource(): string | null {
    const behavior = getBehavior();
    const entries = Object.entries(behavior.viewedSources);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  },
  
  // Score a video based on user preferences (higher = more relevant)
  scoreVideo(video: Video): number {
    const behavior = getBehavior();
    let score = 0;
    
    // Base score from rating
    score += (video.rating || 0) / 10;
    
    // Boost for matching tags
    video.tags?.forEach(tag => {
      const label = typeof tag === 'string' ? tag : tag.label;
      const tagScore = behavior.viewedTags[label] || 0;
      score += tagScore * 2;
    });
    
    // Boost for preferred creator
    if (video.creator?.id && behavior.viewedCreators[video.creator.id]) {
      score += behavior.viewedCreators[video.creator.id] * 3;
    }
    
    // Boost for preferred source
    if (video.source && behavior.viewedSources[video.source]) {
      score += behavior.viewedSources[video.source];
    }
    
    // Penalize already viewed
    if (behavior.lastViewed.includes(video.id)) {
      score -= 50;
    }
    
    // Add some randomness for variety (0-10)
    score += Math.random() * 10;
    
    return score;
  },
  
  // Sort videos by recommendation score
  sortByRecommendation(videos: Video[]): Video[] {
    return [...videos]
      .map(v => ({ video: v, score: this.scoreVideo(v) }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.video);
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
