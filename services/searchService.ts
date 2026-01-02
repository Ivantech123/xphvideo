import { supabase } from './supabase';
import { Video } from '../types';
import { CATEGORY_MAP } from './categoryMap';
import { RecommendationService } from './recommendationService';

const norm = (s: string) => s.trim().toLowerCase();
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const normalizeText = (s: string) => s.trim().toLowerCase();

const STOPWORDS = new Set([
  'and','or','the','a','an','of','to','in','for','on','with','at','by','from','as','is','are','was','were','be','been',
  'this','that','these','those','it','its','you','your','we','our','they','their','i','me','my',
  'и','или','в','во','на','с','со','по','к','ко','за','от','до','из','у','о','об','для','как','это','то','та','те',
  'он','она','они','мы','вы','я','ты','его','ее','их','наш','ваш',
  'trending','new','best','hot','top','shorts','новое','тренде','лучшее','топ','горячее'
]);

const SPECIAL_QUERY_TOKENS = new Set(['trending', 'new', 'best', 'hot', 'top', 'shorts', 'новое', 'тренде', 'лучшее', 'топ', 'горячее']);

const tokenizeQuery = (s: string) => {
  const tokens = normalizeText(s).match(/[\p{L}\p{N}]+/gu);
  if (!tokens) return [];
  return Array.from(new Set(tokens.map(t => t.toLowerCase())))
    .filter(t => t.length >= 3)
    .filter(t => !STOPWORDS.has(t))
    .slice(0, 8);
};

const mapQueryToken = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return CATEGORY_MAP[trimmed] ?? trimmed;
};

const normalizeTag = (value: string) => norm(mapQueryToken(value));

const parseSearchFilters = (raw: string) => {
  const tagFilters: string[] = [];
  const cleaned = raw.replace(/#[^\s#]+/g, (m) => {
    const t = normalizeTag(m.slice(1));
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
          const t = normalizeTag(p);
          if (t) tagFilters.push(t);
        } else {
          keep.push(p);
        }
      }
      const text = mapQueryToken(keep.join(' ').replace(/\s+/g, ' ').trim());
      return { text, tagFilters };
    }
  }

  const text = mapQueryToken(cleaned.replace(/\s+/g, ' ').trim());
  const filteredTags = tagFilters.filter((t) => t && !SPECIAL_QUERY_TOKENS.has(t));
  return { text, tagFilters: filteredTags };
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
  published_at?: string | null;
  score?: number | null;
};

type SearchParams = {
  limit?: number;
  offset?: number;
  source?: string;
  duration?: 'All' | 'Short' | 'Medium' | 'Long';
  sort?: 'trending' | 'new' | 'best';
};

type RankedItem = {
  video: Video;
  searchScore: number;
};

const normalizeSearchScore = (score: number) => 1 - Math.exp(-Math.max(0, score));

const applySourceFilter = (items: RankedItem[], source: string) => {
  if (!source || source === 'All') return items;
  return items.filter(({ video }) => (video.source || 'Unknown') === source);
};

const applyDurationFilter = (items: RankedItem[], duration: SearchParams['duration']) => {
  if (!duration || duration === 'All') return items;
  if (duration === 'Short') return items.filter(({ video }) => video.duration > 0 && video.duration < 600);
  if (duration === 'Medium') return items.filter(({ video }) => video.duration >= 600 && video.duration <= 1200);
  if (duration === 'Long') return items.filter(({ video }) => video.duration > 1200);
  return items;
};

const normalizeLabelList = (labels: string[]) => {
  const uniq = new Set<string>();
  for (const label of labels) {
    const v = label ? norm(label) : '';
    if (!v || uniq.has(v)) continue;
    uniq.add(v);
    if (uniq.size >= 8) break;
  }
  return [...uniq];
};

const getTagLabels = (video: Video) => {
  return (video.tags || [])
    .map((t) => (typeof t === 'string' ? t : t.label))
    .filter(Boolean)
    .map(norm);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wordHas = (text: string, token: string) => {
  if (!text || !token) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(token)}(\\s|$)`).test(text);
};

const fieldScore = (text: string, tokens: string[]) => {
  if (!text || tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) if (wordHas(text, t)) hits += 1;
  return hits / tokens.length;
};

const computeLexicalScore = (video: Video, tokens: string[], tagFilters: string[]) => {
  if (tokens.length === 0 && tagFilters.length === 0) return 0;

  const title = normalizeText(video.title || '');
  const desc = normalizeText(video.description || '');
  const creator = normalizeText(video.creator?.name || '');
  const tags = getTagLabels(video);

  const uniqTokens = Array.from(new Set(tokens)).slice(0, 8);
  const tScore = fieldScore(title, uniqTokens);
  const cScore = fieldScore(creator, uniqTokens);
  const dScore = fieldScore(desc, uniqTokens) * 0.6;
  const tagTextScore = fieldScore(tags.join(' '), uniqTokens) * 0.8;

  const normalizedFilters = normalizeLabelList(tagFilters);
  const tagMatched = normalizedFilters.filter((t) => tags.includes(t)).length;
  const tagFilterScore = normalizedFilters.length ? tagMatched / normalizedFilters.length : 0;

  const phrase = uniqTokens.join(' ');
  const phraseScore = phrase && title.includes(phrase) ? 0.35 : 0;

  return clamp01(
    (tScore * 0.45 + cScore * 0.1 + dScore * 0.25 + tagTextScore * 0.2) * 0.75 +
    tagFilterScore * 0.2 +
    phraseScore * 0.05
  );
};

const rankSearchResults = (
  items: RankedItem[],
  sort: SearchParams['sort'],
  tokens: string[],
  tagFilters: string[],
  intent: 'exact' | 'browse',
  rankContext?: Parameters<typeof RecommendationService.getAffinityScore>[1]
) => {
  const weights =
    sort === 'new'
      ? { text: 0.25, personal: 0.15, quality: 0.1, fresh: 0.5 }
      : sort === 'best'
      ? { text: 0.35, personal: 0.15, quality: 0.45, fresh: 0.05 }
      : { text: 0.45, personal: 0.3, quality: 0.15, fresh: 0.1 };

  const now = Date.now();
  const scored = items.map((item) => {
    const textBase = normalizeSearchScore(item.searchScore);
    const lex = computeLexicalScore(item.video, tokens, tagFilters);
    const text = clamp01(textBase * 0.75 + lex * 0.25);
    const personalK = intent === 'exact' ? 0.5 : 1;
    const personal = RecommendationService.getAffinityScore(item.video, rankContext);
    const quality = RecommendationService.getQualityScore(item.video);
    const fresh = RecommendationService.getFreshnessScore(item.video, now);
    const rank =
      text * weights.text +
      personal * weights.personal * personalK +
      quality * weights.quality +
      fresh * weights.fresh;
    return { ...item, rank };
  });

  return scored.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    const rb = b.video.rating ?? 0;
    const ra = a.video.rating ?? 0;
    if (rb !== ra) return rb - ra;
    return (b.video.views || 0) - (a.video.views || 0);
  });
};

export const SearchService = {
  async searchVideos(query: string, params?: SearchParams) {
    if (!supabase) return { data: [] as Video[], error: 'Supabase not initialized' as string | null, exhausted: true };

    const parsed = parseSearchFilters(query || '');
    const q = parsed.text || '';
    const tag_filters = parsed.tagFilters;
    const tokens = tokenizeQuery(parsed.text || query);
    const tokens = tokenizeQuery(parsed.text || query);

    const limit = params?.limit ?? 24;
    const offset = params?.offset ?? 0;
    const source = params?.source ?? 'All';
    const duration = params?.duration ?? 'All';
    const sort = params?.sort ?? 'trending';

    const needsFilter = (source && source !== 'All') || (duration && duration !== 'All');
    const fetchLimit = needsFilter ? Math.min(Math.max(limit * 3, limit), 96) : limit;

    const target = limit;
    let baseOffset = 0;
    let remainingSkip = offset;
    let collected: RankedItem[] = [];
    let reachedEnd = false;
    let rounds = 0;
    const seen = new Set<string>();

    const intent = (() => {
      const len = q.length;
      const isLong = len >= 18;
      const isMulti = tokens.length >= 3;
      const hasCreatorLike = tokens.length >= 2 && tokens.some(t => t.length >= 6);
      return (isLong || isMulti || hasCreatorLike) ? 'exact' as const : 'browse' as const;
    })();

    const rankContext = RecommendationService.createRankContext?.();

    while (collected.length < target) {
      rounds += 1;
      if (rounds > 20) break;

      const { data, error } = await supabase.rpc('search_videos', {
        q,
        tag_filters,
        lim: fetchLimit,
        off: baseOffset,
      });

      if (error) return { data: [] as Video[], error: error.message, exhausted: true };

      const rows = (data || []) as SearchRow[];
      if (rows.length === 0) {
        reachedEnd = true;
        break;
      }

      let batch: RankedItem[] = rows.map((r) => {
        const video: Video = {
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
          publishedAt: r.published_at || undefined,
        };
        return { video, searchScore: typeof r.score === 'number' ? r.score : 0 };
      });

      batch = applySourceFilter(batch, source);
      batch = applyDurationFilter(batch, duration);

      if (remainingSkip > 0) {
        if (batch.length <= remainingSkip) {
          remainingSkip -= batch.length;
          batch = [];
        } else {
          batch = batch.slice(remainingSkip);
          remainingSkip = 0;
        }
      }

      if (batch.length > 0) {
        for (const item of batch) {
          if (!item.video.id || seen.has(item.video.id)) continue;
          seen.add(item.video.id);
          collected.push(item);
        }
      }

      if (rows.length < fetchLimit) {
        reachedEnd = true;
        break;
      }
      baseOffset += fetchLimit;
    }

    const items = rankSearchResults(collected, sort, tokens, tag_filters, intent, rankContext);

    const limited = items.slice(0, limit).map((item) => item.video);
    const exhausted = reachedEnd || limited.length < limit;

    return { data: limited, error: null as string | null, exhausted };
  }
};
