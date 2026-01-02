import { Video, Creator } from '../types';

const isAbortError = (e: unknown, signal?: AbortSignal) => {
  if (signal?.aborted) return true;
  return e instanceof DOMException && e.name === 'AbortError';
};

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

// Robust Proxy Rotator
const fetchWithProxy = async (targetUrl: string, signal?: AbortSignal): Promise<string> => {
  const proxies = [
    { name: 'corsproxy', url: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
    { name: 'codetabs', url: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
    { name: 'thingproxy', url: (u: string) => `https://thingproxy.freeboard.io/fetch/${u}` },
    { name: 'allorigins', url: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, json: true }
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.url(targetUrl), { signal });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      
      if (proxy.json) {
        const data = await res.json();
        return data.contents; 
      }
      return await res.text();
    } catch (e) {
      if (isAbortError(e, signal)) throw e;
      console.warn(`[TubeService] Proxy ${proxy.name} failed:`, e);
    }
  }
  throw new Error('All proxies failed');
};

const extractEmbedSrc = (embed: string | undefined | null): string => {
  const raw = (embed || '').trim();
  if (!raw) return '';

  // Sometimes API can return a direct URL instead of iframe HTML
  if (/^https?:\/\//i.test(raw)) return raw;

  // Typical: <iframe src="..."> or <iframe src='...'>
  const m = raw.match(/src\s*=\s*['"]([^'"]+)['"]/i);
  if (m?.[1]) return m[1];

  // Last resort: first URL-like token
  const m2 = raw.match(/https?:\/\/[^\s'"]+/i);
  return m2?.[0] || '';
};

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

const normTag = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

const tagsFromLabels = (labels: string[], idPrefix: string): { id: string; label: string }[] => {
  const uniq = new Map<string, string>();
  for (const raw of labels) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    const n = normTag(trimmed);
    if (!n) continue;
    if (!uniq.has(n)) uniq.set(n, trimmed);
  }
  return Array.from(uniq.entries())
    .slice(0, 12)
    .map(([n, label]) => ({ id: `${idPrefix}_${n.replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`, label }));
};

// Adapter to convert External Data -> Our Internal 'Video' Format
export const TubeAdapter = {
  
  // EPORNER API (Documentation: https://www.eporner.com/api/v2/)
  async fetchEporner(query: string = '4k', limit: number = 20, page: number = 1, sort: 'trending' | 'new' | 'best' = 'trending', signal?: AbortSignal): Promise<Video[]> {
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
        const response = await fetch(API_URL, { signal });
        if (!response.ok) throw new Error('Direct API failed');
        data = await response.json();
      } catch {
        // Fallback to corsproxy
        console.log('[TubeAdapter] Eporner direct failed, trying corsproxy...');
        const PROXY_URL = `https://corsproxy.io/?${encodeURIComponent(API_URL)}`;
        const response = await fetch(PROXY_URL, { signal });
        if (!response.ok) throw new Error('Proxy also failed');
        data = await response.json();
      }
      
      return data.videos.map(ev => {
        // Extract first keyword as pseudo-author name for variety
        const keywords = ev.keywords?.split(',').map(k => k.trim()).filter(k => k.length > 0) || [];
        const pseudoAuthor = keywords[0] || 'Eporner';

        const embedUrl = extractEmbedSrc(ev.embed) || `https://www.eporner.com/embed/${ev.id}`;
        
        return {
        id: `ep_${ev.id}`,
        title: ev.title,
        description: ev.keywords, 
          thumbnail: ev.default_thumb.src,
          videoUrl: '', 
          embedUrl: embedUrl,
          duration: ev.length_sec,
          publishedAt: ev.added || undefined,
          creator: {
            id: `ep_${pseudoAuthor.replace(/\s+/g, '_')}`,
            name: pseudoAuthor,
            avatar: 'https://www.eporner.com/favicon.ico',
          verified: false,
          tier: 'Standard'
        },
        tags: tagsFromLabels(keywords, `ep_${ev.id}`),
        views: ev.views,
        rating: parseFloat(ev.rate) || 0, // Eporner rate is usually percentage string "95.5"
        quality: 'HD', 
        source: 'Eporner'
      };
      });

    } catch (error) {
      if (isAbortError(error, signal)) throw error;
      console.error("Failed to fetch from Eporner:", error);
      return [];
    }
  },

  // PORNHUB API
  async fetchPornhub(query: string = 'popular', page: number = 1, sort: 'trending' | 'new' | 'best' = 'trending', signal?: AbortSignal): Promise<Video[]> {
    try {
       const PROXY = 'https://corsproxy.io/?'; 
       let ordering = 'mostviewed'; // trending/default
       if (sort === 'new') ordering = 'newest';
       if (sort === 'best') ordering = 'rating';

       const API_URL = `https://www.pornhub.com/webmasters/search?search=${encodeURIComponent(query)}&page=${page}&thumbsize=large&ordering=${ordering}`;
       
       const response = await fetch(PROXY + encodeURIComponent(API_URL), { signal });
       if (!response.ok) throw new Error('PH API response was not ok');
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
        const tags = tagsFromLabels(tagsList, `ph_${ph.video_id}`);
         
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
            publishedAt: ph.publish_date || undefined,
            creator: {
            id: `ph_c_${creatorName.replace(/\s+/g, '_')}`,
            name: creatorName,
            avatar: ph.thumbs?.[0]?.src || 'https://www.pornhub.com/favicon.ico', 
            verified: true,
            tier: 'Standard'
          },
          tags: tags,
          views: Number(ph.views),
          rating: Math.round(ratingVal),
          quality: 'HD',
          source: 'Pornhub'
       };
      });

    } catch (error) {
       if (isAbortError(error, signal)) throw error;
       console.error("Failed to fetch from Pornhub:", error);
       return [];
    }
  },

  async fetchPornstars(signal?: AbortSignal): Promise<Creator[]> {
    try {
       const API_URL = `https://www.pornhub.com/webmasters/pornstars`;

       // Browser cannot call Pornhub directly (CORS + redirects). Proxy-only and best-effort.
       const raw = await fetchWithProxy(API_URL, signal);
       if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
         throw new Error('Pornstars endpoint returned HTML (blocked)');
       }

       let data: PornhubPornstarResponse;
       try {
         data = JSON.parse(raw);
       } catch {
         throw new Error('Pornstars endpoint returned non-JSON response');
       }

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
       if (isAbortError(error, signal)) throw error;
       console.warn("Failed to fetch pornstars", error);
       return [];
    }
  },

  // XVIDEOS API (Scraper via Proxy)
  async fetchXVideos(query: string = 'best', page: number = 1, sort: 'trending' | 'new' | 'best' = 'trending', signal?: AbortSignal): Promise<Video[]> {
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
        html = await fetchWithProxy(TARGET_URL, signal);
      } catch (e) {
        if (isAbortError(e, signal)) throw e;
        console.error('[TubeAdapter] XVideos fetch failed:', e);
        return [];
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
            tags: [{ id: 'xv_tag', label: 'xvideos' }],
            views: 0,
            rating: 0,
            quality: 'HD',
            source: 'XVideos' as any
          };
        })
        .filter((v): v is Video => v !== null);
    } catch (e) {
      if (isAbortError(e, signal)) throw e;
      console.error('XVideos fetch error', e);
      return [];
    }
  },

  async fetchVideoById(id: string, signal?: AbortSignal): Promise<Video | undefined> {
    // Eporner
    if (id.startsWith('ep_')) {
      const realId = id.replace('ep_', '');
      try {
        const API_URL = `https://www.eporner.com/api/v2/video/id/?id=${encodeURIComponent(realId)}&thumbsize=big&format=json`;
        let data: EpornerVideo;
        try {
          const response = await fetch(API_URL, { signal });
          if (!response.ok) throw new Error('Direct API failed');
          data = await response.json();
        } catch {
          const PROXY_URL = `https://corsproxy.io/?${encodeURIComponent(API_URL)}`;
          const response = await fetch(PROXY_URL, { signal });
          if (!response.ok) throw new Error('Proxy also failed');
          data = await response.json();
        }
        
        const keywords = data.keywords?.split(',').map(k => k.trim()).filter(k => k.length > 0) || [];
        const pseudoAuthor = keywords[0] || 'Eporner';

        const embedUrl = extractEmbedSrc(data.embed) || `https://www.eporner.com/embed/${realId}`;

        return {
          id: `ep_${data.id}`,
          title: data.title,
          description: `Views: ${data.views} • Rating: ${data.rate}`,
          thumbnail: data.default_thumb.src,
          videoUrl: '', 
          embedUrl: embedUrl,
          duration: data.length_sec,
          publishedAt: (data as any).added || undefined,
          creator: {
            id: `ep_${pseudoAuthor.replace(/\s+/g, '_')}`,
            name: pseudoAuthor,
            avatar: 'https://www.eporner.com/favicon.ico',
            verified: false,
            tier: 'Standard'
          },
          tags: tagsFromLabels(keywords, `ep_${data.id}`),
          views: data.views,
          rating: parseFloat(data.rate) || 0,
          quality: 'HD',
          source: 'Eporner'
        };
      } catch (e) {
        if (isAbortError(e, signal)) throw e;
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

        const response = await fetch(PROXY + encodeURIComponent(API_URL), { signal });
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
        const tags = tagsFromLabels(tagsList, `ph_${ph.video_id}`);

        return {
          id: `ph_${ph.video_id}`,
          title: ph.title,
          description: tagsList.join(', ') || `Rating: ${ph.rating}% • Views: ${ph.views}`,
          thumbnail: ph.default_thumb,
          videoUrl: '',
          embedUrl: `https://www.pornhub.com/embed/${ph.video_id}`,
          duration: parseDuration(ph.duration),
          publishedAt: (ph as any).publish_date || undefined,
          creator: {
            id: `ph_c_${creatorName.replace(/\s+/g, '_')}`,
            name: creatorName,
            avatar: ph.thumbs?.[0]?.src || 'https://www.pornhub.com/favicon.ico',
            verified: true,
            tier: 'Standard'
          },
          tags: tags,
          views: Number(ph.views),
          rating: Math.round(ratingVal),
          quality: 'HD',
          source: 'Pornhub'
        };
      } catch (e) {
        if (isAbortError(e, signal)) throw e;
        console.error('PH ID fetch error', e);
        return undefined;
      }
    }

    // XVideos
    if (id.startsWith('xv_')) {
      const realId = id.replace('xv_', '');
      try {
        const TARGET_URL = `https://www.xvideos.com/video${realId}`;
        
        const html = await fetchWithProxy(TARGET_URL, signal);

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
          tags: [{ id: 'xv_tag', label: 'xvideos' }],
          views: 0, 
          quality: 'HD',
          source: 'XVideos' as any
        };
      } catch (e) {
        if (isAbortError(e, signal)) throw e;
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
