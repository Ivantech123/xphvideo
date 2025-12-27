import { Video, Creator } from '../types';

// Interfaces for External APIs
interface EpornerVideo {
  id: string;
  title: string;
  keywords: string; // comma separated
  views: number;
  rate: string;
  url: string;
  added: string;
  length_sec: number;
  length_min: string;
  embed: string; // HTML code or URL
  default_thumb: { src: string; width: number; height: number };
  thumbs: { src: string; width: number; height: number }[];
}

interface EpornerResponse {
  count: number;
  start: number;
  per_page: number;
  videos: EpornerVideo[];
}

interface PornhubVideo {
  video_id: string;
  title: string;
  duration: string;
  default_thumb: string;
  thumb: string;
  thumbs: { src: string; width: number; height: number; type: string }[];
  url: string;
  publish_date: string;
  views: number;
  rating: number;
  rating_percent: number;
  votes: number;
  segment: string;
  tags: string[];
  pornstars: { pornstar_name: string }[];
  categories: { category: string }[];
}

interface PornhubResponse {
  videos: PornhubVideo[];
}

interface PornhubPornstar {
  pornstar_name: string;
  rank: number;
  type: string;
  videos_count_all: number;
  monthly_searches: number;
  views: number;
  thumbnails: { height: number; width: number; src: string; type: string }[];
}

interface PornhubPornstarResponse {
  pornstars: PornhubPornstar[];
}

// Adapter to convert External Data -> Our Internal 'Video' Format
export const TubeAdapter = {
  
  // EPORNER API (Documentation: https://www.eporner.com/api/v2/)
  async fetchEporner(query: string = '4k', limit: number = 20, page: number = 1): Promise<Video[]> {
    try {
      const PROXY = 'https://corsproxy.io/?'; 
      const API_URL = `https://www.eporner.com/api/v2_video/search/?query=${query}&per_page=${limit}&page=${page}&thumbsize=big&order=top-weekly&json=json`;
      
      const response = await fetch(PROXY + encodeURIComponent(API_URL));
      
      if (!response.ok) throw new Error('Network response was not ok');
      
      const data: EpornerResponse = await response.json();
      
      return data.videos.map(ev => ({
        id: `ep_${ev.id}`,
        title: ev.title,
        description: ev.keywords, // Use keywords as description/metadata since we don't have a real summary
        thumbnail: ev.default_thumb.src,
        videoUrl: '', 
        embedUrl: ev.embed.match(/src="([^"]+)"/)?.[1] || '', 
        duration: ev.length_sec,
        creator: {
          id: 'eporner',
          name: 'Eporner Network',
          avatar: 'https://www.eporner.com/favicon.ico',
          verified: true,
          tier: 'Standard'
        },
        tags: ev.keywords.split(',').map((tag, idx) => ({ id: `tag_${idx}`, label: tag.trim() })),
        views: ev.views,
        rating: parseFloat(ev.rate),
        quality: 'HD', // Default assumption
        source: 'Eporner'
      }));

    } catch (error) {
      console.error("Failed to fetch from Eporner:", error);
      return [];
    }
  },

  // PORNHUB API
  // NOTE: This usually requires a CORS proxy for frontend-only calls.
  async fetchPornhub(query: string = 'teens', page: number = 1): Promise<Video[]> {
    try {
       // Using a common public CORS proxy for demo purposes. 
       // In production, you should route this through your own backend.
       const PROXY = 'https://corsproxy.io/?'; 
       const API_URL = `https://www.pornhub.com/webmasters/search?search=${query}&page=${page}&thumbsize=large`;
       
       const response = await fetch(PROXY + encodeURIComponent(API_URL));
       if (!response.ok) throw new Error('PH Network response was not ok');

       const data: PornhubResponse = await response.json();

       return data.videos.map(ph => {
         const creatorName = ph.pornstars?.[0]?.pornstar_name || 'Pornhub Network';
         const tagsArray = Array.isArray(ph.tags) ? ph.tags.map((t: any) => typeof t === 'string' ? t : (t.tag_name || 'Tag')) : [];
         
         return {
          id: `ph_${ph.video_id}`,
          title: ph.title,
          description: tagsArray.join(', ') || 'No description available',
          thumbnail: ph.default_thumb,
          videoUrl: '', 
          embedUrl: `https://www.pornhub.com/embed/${ph.video_id}`,
          duration: parseDuration(ph.duration),
          creator: {
            id: `ph_c_${creatorName.replace(/\s+/g, '_')}`,
            name: creatorName,
            avatar: ph.thumbs?.[0]?.src || 'https://www.pornhub.com/favicon.ico', // Use a video thumb as avatar proxy or default
            verified: true,
            tier: 'Standard'
          },
          tags: tagsArray.map((t, i) => ({ id: `pht_${i}`, label: t })),
          views: Number(ph.views),
          rating: Number(ph.rating),
          quality: 'HD',
          source: 'Pornhub'
       };
      });

    } catch (error) {
       console.error("Failed to fetch from Pornhub:", error);
       return [];
    }
  },

  async fetchPornstars(): Promise<Creator[]> {
    try {
       const PROXY = 'https://corsproxy.io/?'; 
       const API_URL = `https://www.pornhub.com/webmasters/pornstars`;
       
       const response = await fetch(PROXY + encodeURIComponent(API_URL));
       if (!response.ok) throw new Error('PH Pornstars Network response was not ok');

       const data: PornhubPornstarResponse = await response.json();
       
       return data.pornstars.slice(0, 50).map(p => ({
         id: `star_${p.pornstar_name.replace(/\s+/g, '_')}`,
         name: p.pornstar_name,
         avatar: p.thumbnails?.[0]?.src || '',
         verified: true,
         tier: p.rank < 100 ? 'Exclusive' : 'Premium',
         stats: {
            videos: p.videos_count_all,
            views: p.views
         }
       }));
    } catch (error) {
       console.error("Failed to fetch pornstars", error);
       return [];
    }
  },

  // XVIDEOS API (Scraper via Proxy)
  async fetchXVideos(query: string = 'best', page: number = 1): Promise<Video[]> {
    try {
      const PROXY = 'https://corsproxy.io/?';
      // XVideos search url. Page parameter is 'p'
      const TARGET_URL = `https://www.xvideos.com/?k=${encodeURIComponent(query)}&p=${page}&sort=relevance`;
      
      const response = await fetch(PROXY + encodeURIComponent(TARGET_URL));
      if (!response.ok) throw new Error('XVideos fetch failed');
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const nodes = Array.from(doc.querySelectorAll('.thumb-block'));
      
      return nodes.slice(0, 12).map((node: Element) => {
         const id = node.getAttribute('data-id') || Math.random().toString(36).substr(2, 9);
         const titleEl = node.querySelector('.title a');
         const title = titleEl?.textContent || 'Untitled';
         const thumbEl = node.querySelector('img');
         const thumbnail = thumbEl?.getAttribute('data-src') || thumbEl?.src || '';
         const durationEl = node.querySelector('.duration'); // Format "10 min" or "50 sec"
         const durationStr = durationEl?.textContent || '0 min';
         
         // Parse duration
         let duration = 0;
         if (durationStr.includes('h')) duration += parseInt(durationStr) * 3600;
         else if (durationStr.includes('min')) duration += parseInt(durationStr) * 60;
         else duration += parseInt(durationStr);

         // Extract Embed URL from ID
         // XVideos embed: https://www.xvideos.com/embedframe/ID
         const embedUrl = `https://www.xvideos.com/embedframe/${id}`;

         return {
           id: `xv_${id}`,
           title: title,
           description: 'Source: XVideos',
           thumbnail: thumbnail,
           videoUrl: '', 
           embedUrl: embedUrl,
           duration: duration,
           creator: {
             id: 'xv_net',
             name: 'XVideos',
             avatar: 'https://www.xvideos.com/favicon.ico',
             verified: false,
             tier: 'Standard'
           },
           tags: [{ id: 'xv_tag', label: 'XVideos' }],
           views: 0, 
           rating: 0,
           quality: 'HD',
           source: 'XVideos' as any // Cast because 'XVideos' might not be in literal type yet
         };
      });

    } catch (e) {
      console.error("XVideos fetch error", e);
      return [];
    }
  },

  async fetchVideoById(id: string): Promise<Video | undefined> {
    // Eporner
    if (id.startsWith('ep_')) {
      const realId = id.replace('ep_', '');
      try {
        const PROXY = 'https://corsproxy.io/?';
        const API_URL = `https://www.eporner.com/api/v2_video/id/?id=${realId}&thumbsize=big&json=json`;
        
        const response = await fetch(PROXY + encodeURIComponent(API_URL));
        if (!response.ok) throw new Error('Eporner ID fetch failed');
        const data: EpornerVideo = await response.json();
        
        // Map single object
        return {
            id: `ep_${data.id}`,
            title: data.title,
            description: `Views: ${data.views} • Rating: ${data.rate}`,
            thumbnail: data.default_thumb.src,
            videoUrl: '', 
            embedUrl: data.embed.match(/src="([^"]+)"/)?.[1] || '',
            duration: data.length_sec,
            creator: {
              id: 'eporner',
              name: 'Eporner Network',
              avatar: 'https://www.eporner.com/favicon.ico',
              verified: true,
              tier: 'Standard'
            },
            tags: data.keywords.split(',').map((tag, idx) => ({ id: `tag_${idx}`, label: tag.trim() })),
            views: data.views,
            quality: 'HD',
            source: 'Eporner'
        };
      } catch (e) {
        console.error("Eporner ID fetch error", e);
        return undefined;
      }
    }

    // Pornhub
    if (id.startsWith('ph_')) {
      const realId = id.replace('ph_', '');
      try {
         // Try searching by ID as keyword - simplistic approach for public API
         const PROXY = 'https://corsproxy.io/?'; 
         const API_URL = `https://www.pornhub.com/webmasters/search?search=${realId}&thumbsize=large`;
         
         const response = await fetch(PROXY + encodeURIComponent(API_URL));
         if (!response.ok) throw new Error('PH ID fetch failed');
         
         const data: PornhubResponse = await response.json();
         const ph = data.videos.find(v => v.video_id === realId) || data.videos[0];

         if (!ph) return undefined;

         const creatorName = ph.pornstars?.[0]?.pornstar_name || 'Pornhub Network';
         return {
            id: `ph_${ph.video_id}`,
            title: ph.title,
            description: `Rating: ${ph.rating}% • Views: ${ph.views}`,
            thumbnail: ph.default_thumb,
            videoUrl: '', 
            embedUrl: `https://www.pornhub.com/embed/${ph.video_id}`,
            duration: parseDuration(ph.duration),
            creator: {
              id: `ph_c_${creatorName.replace(/\s+/g, '_')}`,
              name: creatorName,
              avatar: ph.thumbs?.[0]?.src || 'https://www.pornhub.com/favicon.ico',
              verified: true,
              tier: 'Standard'
            },
            tags: Array.isArray(ph.tags) ? ph.tags.map((t: any, i) => ({ 
              id: `pht_${i}`, 
              label: typeof t === 'string' ? t : (t.tag_name || 'Tag') 
            })) : [],
            views: Number(ph.views),
            quality: 'HD',
            source: 'Pornhub'
         };
      } catch (e) {
        console.error("PH ID fetch error", e);
        return undefined;
      }
    }

    // XVideos
    if (id.startsWith('xv_')) {
      const realId = id.replace('xv_', '');
      try {
        const PROXY = 'https://corsproxy.io/?';
        const TARGET_URL = `https://www.xvideos.com/video${realId}`;
        
        const response = await fetch(PROXY + encodeURIComponent(TARGET_URL));
        if (!response.ok) throw new Error('XVideos ID fetch failed');
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Meta tags extraction
        const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || 'Unknown Title';
        const thumbnail = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
        const durationStr = doc.querySelector('.duration')?.textContent || '0 min';
        
        let duration = 0;
        if (durationStr.includes('h')) duration += parseInt(durationStr) * 3600;
        else if (durationStr.includes('min')) duration += parseInt(durationStr) * 60;
        else duration += parseInt(durationStr);

        return {
           id: `xv_${realId}`,
           title: title.replace(' - XVIDEOS.COM', ''),
           description: 'Source: XVideos',
           thumbnail: thumbnail,
           videoUrl: '', 
           embedUrl: `https://www.xvideos.com/embedframe/${realId}`,
           duration: duration,
           creator: {
             id: 'xv_net',
             name: 'XVideos',
             avatar: 'https://www.xvideos.com/favicon.ico',
             verified: false,
             tier: 'Standard'
           },
           tags: [{ id: 'xv_tag', label: 'XVideos' }],
           views: 0, 
           quality: 'HD',
           source: 'XVideos' as any
        };
      } catch (e) {
        console.error("XVideos ID fetch error", e);
        return undefined;
      }
    }

    return undefined;
  }
};

// Helper to parse "MM:SS" string to seconds
const parseDuration = (durationStr: string): number => {
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
};
