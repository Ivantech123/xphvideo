export interface Creator {
  id: string;
  name: string;
  avatar: string;
  verified: boolean;
  tier: 'Standard' | 'Premium' | 'Exclusive';
}

export interface Tag {
  id: string;
  label: string;
}

export interface Chapter {
  time: number; // seconds
  label: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl?: string; // URL to the actual video file (mp4/m3u8)
  embedUrl?: string; // URL for iframe embedding (standard for tube sites)
  source?: 'Local' | 'Pornhub' | 'Eporner' | 'RedTube' | 'XVideos'; 
  duration: number; // in seconds
  creator: Creator;
  tags: Tag[];
  chapters?: Chapter[]; // New: Smart Timeline
  views: number;
  rating?: number; // 0-100 percentage
  quality: 'HD' | '4K' | '8K';
  price?: number; // If part of a paid collection
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  curator: string;
  videos: Video[];
  type: 'Mood' | 'Scenario' | 'Series' | 'Educational';
  tags: string[];
}

export interface AIMoodResponse {
  suggestedTags: string[];
  narrativeDescription: string;
  moodColor: string;
}

export type UserMode = 'General' | 'Him' | 'Her' | 'Couples' | 'Gay' | 'Trans' | 'Lesbian';
