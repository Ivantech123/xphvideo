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
  async fetchEporner(query: string = '4k', limit: number = 20, page: number = 1, sort: 'trending' | 'new' | 'best' = 'trending'): Promise<Video[]> {
    try {
      let order = 'top-weekly';
      if (sort === 'new') order = 'latest';
      if (sort === 'best') order = 'top-monthly'; // or top-alltime

      // Use direct API call (Eporner has CORS enabled)
      const API_URL = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=${limit}&page=${page}&thumbsize=big&order=${order}&format=json`;
      
      console.log('[TubeAdapter] Eporner URL:', API_URL);
      
      let data: EpornerResponse;
      try {
        // Try direct API first
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Direct API failed');
        data = await response.json();
      } catch {
        // Fallback to corsproxy
        console.log('[TubeAdapter] Eporner direct failed, trying corsproxy...');
        const PROXY_URL = `https://corsproxy.io/?${encodeURIComponent(API_URL)}`;
        const response = await fetch(PROXY_URL);
        if (!response.ok) throw new Error('Proxy also failed');
        data = await response.json();
      }
      
      return data.videos.map(ev => {
        // Extract first keyword as pseudo-author name for variety
        const keywords = ev.keywords?.split(',').map(k => k.trim()).filter(k => k.length > 0) || [];
        const pseudoAuthor = keywords[0] || 'Eporner';
        
        return {
        id: `ep_${ev.id}`,
        title: ev.title,
        description: ev.keywords, 
        thumbnail: ev.default_thumb.src,
        videoUrl: '', 
        embedUrl: ev.embed.match(/src="([^"]+)"/)?.[1] || '', 
        duration: ev.length_sec,
        creator: {
          id: `ep_${pseudoAuthor.replace(/\s+/g, '_')}`,
          name: pseudoAuthor,
          avatar: 'https://www.eporner.com/favicon.ico',
          verified: false,
          tier: 'Standard'
        },
        tags: ev.keywords.split(',').map((tag, idx) => ({ id: `tag_${idx}`, label: tag.trim() })),
        views: ev.views,
        rating: parseFloat(ev.rate) || 0, // Eporner rate is usually percentage string "95.5"
        quality: 'HD', 
        source: 'Eporner'
      };
      });

    } catch (error) {
      console.error("Failed to fetch from Eporner:", error);
      return [];
    }
  },

  // PORNHUB API
  async fetchPornhub(query: string = 'popular', page: number = 1, sort: 'trending' | 'new' | 'best' = 'trending'): Promise<Video[]> {
    try {
       const PROXY = 'https://corsproxy.io/?'; 
       let ordering = 'mostviewed'; // trending/default
       if (sort === 'new') ordering = 'newest';
       if (sort === 'best') ordering = 'rating';

       const API_URL = `https://www.pornhub.com/webmasters/search?search=${encodeURIComponent(query)}&page=${page}&thumbsize=large&ordering=${ordering}`;
       
       const response = await fetch(PROXY + encodeURIComponent(API_URL));
       if (!response.ok) throw new Error('PH Network response was not ok');

       const data: PornhubResponse = await response.json();
       
       console.log('[TubeAdapter] Pornhub response videos:', data.videos?.length || 0);

       return data.videos.map(ph => {
         // Use first pornstar name, or first category, or extract from title
         let creatorName = ph.pornstars?.[0]?.pornstar_name;
         if (!creatorName && ph.categories?.length > 0) {
           creatorName = ph.categories[0]?.category || ph.categories[0];
         }
         if (!creatorName) {
           // Extract potential name from title (first capitalized word)
           const titleWords = ph.title.split(' ').filter(w => w.length > 2);
           creatorName = titleWords[0] || 'Amateur';
         }
         // Ensure tags are strings before joining
         const tagsList = Array.isArray(ph.tags) ? ph.tags.map((t: any) => typeof t === 'string' ? t : (t.tag_name || 'Tag')) : [];
         
         // Normalize rating: prefer rating_percent (0-100), fallback to rating (0-5) * 20
         const ratingVal = ph.rating_percent ? Number(ph.rating_percent) : (ph.rating ? Number(ph.rating) * 20 : 0);

         return {
          id: `ph_${ph.video_id}`,
          title: ph.title,
          description: tagsList.join(', ') || 'No description available',
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
          tags: tagsList.map((t, i) => ({ id: `pht_${i}`, label: t })),
          views: Number(ph.views),
          rating: Math.round(ratingVal),
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
  async fetchXVideos(query: string = 'best', page: number = 1, sort: 'trending' | 'new' | 'best' = 'trending'): Promise<Video[]> {
    console.log('[TubeAdapter] fetchXVideos called:', { query, page, sort });
    try {
      // XVideos search url. Page parameter is 'p'
      // Sort: relevance (default), uploaddate (new), rating (best)
      let sortParam = 'relevance';
      if (sort === 'new') sortParam = 'uploaddate';
      if (sort === 'best') sortParam = 'rating';
      
      const TARGET_URL = `https://www.xvideos.com/?k=${encodeURIComponent(query)}&p=${page}&sort=${sortParam}`;
      
      console.log('[TubeAdapter] XVideos target URL:', TARGET_URL);
      
      let html: string;
      try {
        // Try allorigins first
        const PROXY_URL = `https://api.allorigins.win/get?url=${encodeURIComponent(TARGET_URL)}`;
        const response = await fetch(PROXY_URL);
        if (!response.ok) throw new Error('allorigins failed');
        const wrapper = await response.json();
        html = wrapper.contents;
      } catch {
        // Fallback to corsproxy
        console.log('[TubeAdapter] XVideos allorigins failed, trying corsproxy...');
        const PROXY_URL = `https://corsproxy.io/?${encodeURIComponent(TARGET_URL)}`;
        const response = await fetch(PROXY_URL);
        if (!response.ok) throw new Error('All proxies failed');
        html = await response.text();
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const nodes = Array.from(doc.querySelectorAll('.thumb-block'));
      
      return nodes
        .slice(0, 12)
        .map((node: Element) => {
          const id = node.getAttribute('data-id');
          if (!id) return null;

          const titleEl = node.querySelector('.title a');
          const title = titleEl?.textContent || 'Untitled';
          const thumbEl = node.querySelector('img');
          let thumbnail = thumbEl?.getAttribute('data-src') || thumbEl?.getAttribute('src') || '';

          if (thumbnail.includes('THUMBNUM')) {
            thumbnail = thumbnail.replace('THUMBNUM', '1');
          }

          const durationEl = node.querySelector('.duration');
          const durationStr = durationEl?.textContent || '0 min';
          let duration = 0;
          if (durationStr.includes('h')) duration += parseInt(durationStr) * 3600;
          else if (durationStr.includes('min')) duration += parseInt(durationStr) * 60;
          else duration += parseInt(durationStr);

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
            source: 'XVideos' as any
          };
        })
        .filter((v): v is Video => v !== null);
    } catch (e) {
      console.error('XVideos fetch error', e);
      return [];
    }
  },

  async fetchVideoById(id: string): Promise<Video | undefined> {
    // Eporner
    if (id.startsWith('ep_')) {
      const realId = id.replace('ep_', '');
      try {
        const API_URL = `https://www.eporner.com/api/v2/video/id/?id=${encodeURIComponent(realId)}&thumbsize=big&format=json`;
        let data: EpornerVideo;
        try {
          const response = await fetch(API_URL);
          if (!response.ok) throw new Error('Direct API failed');
          data = await response.json();
        } catch {
          const PROXY_URL = `https://corsproxy.io/?${encodeURIComponent(API_URL)}`;
          const response = await fetch(PROXY_URL);
          if (!response.ok) throw new Error('Proxy also failed');
          data = await response.json();
        }

        const keywords = data.keywords?.split(',').map(k => k.trim()).filter(k => k.length > 0) || [];
        const pseudoAuthor = keywords[0] || 'Eporner';

        return {
          id: `ep_${data.id}`,
          title: data.title,
          description: `Views: ${data.views} • Rating: ${data.rate}`,
          thumbnail: data.default_thumb.src,
          videoUrl: '',
          embedUrl: data.embed.match(/src="([^"]+)"/)?.[1] || '',
          duration: data.length_sec,
          creator: {
            id: `ep_${pseudoAuthor.replace(/\s+/g, '_')}`,
            name: pseudoAuthor,
            avatar: 'https://www.eporner.com/favicon.ico',
            verified: false,
            tier: 'Standard'
          },
          tags: keywords.map((tag, idx) => ({ id: `tag_${idx}`, label: tag })),
          views: data.views,
          rating: parseFloat(data.rate) || 0,
          quality: 'HD',
          source: 'Eporner'
        };
      } catch (e) {
        console.error('Eporner ID fetch error', e);
        return undefined;
      }
    }

    // Pornhub
    if (id.startsWith('ph_')) {
      const realId = id.replace('ph_', '');
      try {
        const PROXY = 'https://corsproxy.io/?';
        const API_URL = `https://www.pornhub.com/webmasters/search?search=${encodeURIComponent(realId)}&thumbsize=large`;

        const response = await fetch(PROXY + encodeURIComponent(API_URL));
        if (!response.ok) throw new Error('PH ID fetch failed');

        const data: PornhubResponse = await response.json();
        const ph = data.videos.find(v => v.video_id === realId) || data.videos[0];
        if (!ph) return undefined;

        let creatorName = ph.pornstars?.[0]?.pornstar_name;
        if (!creatorName && ph.categories?.length > 0) {
          creatorName = ph.categories[0]?.category || (ph.categories[0] as any);
        }
        if (!creatorName) creatorName = 'Pornhub Network';

        const tagsList = Array.isArray(ph.tags) ? ph.tags.map((t: any) => (typeof t === 'string' ? t : (t.tag_name || 'Tag'))) : [];
        const ratingVal = ph.rating_percent ? Number(ph.rating_percent) : (ph.rating ? Number(ph.rating) * 20 : 0);

        return {
          id: `ph_${ph.video_id}`,
          title: ph.title,
          description: tagsList.join(', ') || `Rating: ${ph.rating}% • Views: ${ph.views}`,
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
          tags: tagsList.map((t, i) => ({ id: `pht_${i}`, label: t })),
          views: Number(ph.views),
          rating: Math.round(ratingVal),
          quality: 'HD',
          source: 'Pornhub'
        };
      } catch (e) {
        console.error('PH ID fetch error', e);
        return undefined;
      }
    }

    // XVideos
    if (id.startsWith('xv_')) {
      const realId = id.replace('xv_', '');
      try {
        const TARGET_URL = `https://www.xvideos.com/video${encodeURIComponent(realId)}`;
        const PROXY_URL = `https://api.allorigins.win/get?url=${encodeURIComponent(TARGET_URL)}`;

        const response = await fetch(PROXY_URL);
        if (!response.ok) throw new Error('XVideos ID fetch failed');

        const wrapper = await response.json();
        const html = wrapper.contents;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

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
          rating: 0,
          quality: 'HD',
          source: 'XVideos' as any
        };
      } catch (e) {
        console.error('XVideos ID fetch error', e);
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
