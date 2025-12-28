import { supabase } from './supabase';
import { Video } from '../types';

const norm = (s: string) => s.trim().toLowerCase();

const parseSearchFilters = (raw: string) => {
  const tagFilters: string[] = [];
  const cleaned = raw.replace(/#[^\s#]+/g, (m) => {
    const t = norm(m.slice(1));
    if (t) tagFilters.push(t);
    return ' ';
  });

  // Support comma-separated tags: "blonde, anal" => tag filters.
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

type SearchRow = {
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
};

export const SearchService = {
  async searchVideos(query: string, params?: { limit?: number; offset?: number }) {
    if (!supabase) return { data: [] as Video[], error: 'Supabase not initialized' as string | null };

    const parsed = parseSearchFilters(query || '');
    const q = parsed.text || '';
    const tag_filters = parsed.tagFilters;

    const limit = params?.limit ?? 24;
    const offset = params?.offset ?? 0;

    const { data, error } = await supabase.rpc('search_videos', {
      q,
      tag_filters,
      lim: limit,
      off: offset,
    });

    if (error) return { data: [] as Video[], error: error.message };

    const rows = (data || []) as SearchRow[];
    const videos: Video[] = rows.map((r) => {
      return {
        id: r.id,
        title: r.title || '',
        description: r.description || '',
        thumbnail: r.thumbnail || '',
        embedUrl: r.embed_url || undefined,
        videoUrl: r.video_url || undefined,
        source: (r.source as any) || undefined,
        duration: r.duration || 0,
        creator: {
          id: r.creator_id || r.creator_name || 'unknown',
          name: r.creator_name || 'Unknown',
          avatar: r.creator_avatar || 'https://via.placeholder.com/80',
          verified: false,
          tier: 'Standard',
        },
        tags: (r.tags || []).map((t) => ({ id: t, label: t })),
        views: (r.views as any) || 0,
        rating: (r.rating as any) || undefined,
        quality: ((r.quality as any) || 'HD') as any,
      };
    });

    return { data: videos, error: null as string | null };
  }
};
