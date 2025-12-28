import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

type Body = {
  queries?: string[];
  pages?: number;
  per_page?: number;
  sources?: Array<"Eporner" | "Pornhub" | "XVideos">;
};

type CatalogRow = {
  id: string;
  source: string;
  title: string;
  description: string;
  thumbnail: string;
  embed_url?: string | null;
  video_url?: string | null;
  duration?: number | null;
  creator_id?: string | null;
  creator_name?: string | null;
  creator_avatar?: string | null;
  tags?: string[] | null;
  views?: number | null;
  rating?: number | null;
  quality?: string | null;
  published_at?: string | null;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-max-age": "86400",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });

const uniq = <T>(arr: T[]) => Array.from(new Set(arr));

const normTag = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

const extractEmbedSrc = (html: string) => {
  const m = html.match(/src=["']([^"']+)["']/i);
  return m?.[1] || "";
};

const parseDuration = (durationStr: string): number => {
  const parts = durationStr.split(":").map((x) => Number(x));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
};

const fetchText = async (url: string) => {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.text();
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.json();
};

const mapEporner = (ev: any): CatalogRow => {
  const keywords = String(ev.keywords || "")
    .split(",")
    .map((k) => normTag(k))
    .filter(Boolean);

  const embedUrl = extractEmbedSrc(String(ev.embed || "")) || `https://www.eporner.com/embed/${ev.id}`;

  const creatorName = keywords[0] || "Eporner";

  return {
    id: `ep_${ev.id}`,
    source: "Eporner",
    title: String(ev.title || ""),
    description: `Views: ${ev.views ?? 0} • Rating: ${ev.rate ?? 0}`,
    thumbnail: ev?.default_thumb?.src || ev?.default_thumb || "",
    embed_url: embedUrl,
    duration: Number(ev.length_sec || 0) || 0,
    creator_id: `ep_${creatorName.replace(/\s+/g, "_")}`,
    creator_name: creatorName,
    creator_avatar: "https://www.eporner.com/favicon.ico",
    tags: uniq(keywords),
    views: Number(ev.views || 0) || 0,
    rating: Number.parseFloat(ev.rate || "0") || 0,
    quality: "HD",
    published_at: null,
  };
};

const mapPornhub = (ph: any): CatalogRow => {
  let creatorName = ph?.pornstars?.[0]?.pornstar_name;
  if (!creatorName && ph?.categories?.length > 0) {
    creatorName = ph.categories[0]?.category || ph.categories[0];
  }
  if (!creatorName) creatorName = "Pornhub Network";

  const tagsList: string[] = Array.isArray(ph.tags)
    ? ph.tags.map((t: any) => (typeof t === "string" ? t : (t.tag_name || ""))).filter(Boolean)
    : [];

  const ratingVal = ph.rating_percent ? Number(ph.rating_percent) : (ph.rating ? Number(ph.rating) * 20 : 0);

  return {
    id: `ph_${ph.video_id}`,
    source: "Pornhub",
    title: String(ph.title || ""),
    description: tagsList.join(", ") || "",
    thumbnail: String(ph.default_thumb || ""),
    embed_url: `https://www.pornhub.com/embed/${ph.video_id}`,
    duration: parseDuration(String(ph.duration || "0:00")),
    creator_id: `ph_c_${creatorName.replace(/\s+/g, "_")}`,
    creator_name: creatorName,
    creator_avatar: ph?.thumbs?.[0]?.src || "https://www.pornhub.com/favicon.ico",
    tags: uniq(tagsList.map(normTag)),
    views: Number(ph.views || 0) || 0,
    rating: Math.round(ratingVal),
    quality: "HD",
    published_at: null,
  };
};

const fetchEporner = async (query: string, page: number, perPage: number) => {
  const API_URL = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&thumbsize=big&order=top-weekly&format=json`;
  const data: any = await fetchJson(API_URL);
  const vids = Array.isArray(data?.videos) ? data.videos : [];
  return vids.map(mapEporner);
};

const fetchPornhub = async (query: string, page: number) => {
  const API_URL = `https://www.pornhub.com/webmasters/search?search=${encodeURIComponent(query)}&page=${page}&thumbsize=large&ordering=mostviewed`;
  // server-side: try direct first, then corsproxy fallback (best-effort)
  let data: any;
  try {
    data = await fetchJson(API_URL);
  } catch {
    const proxy = `https://corsproxy.io/?${encodeURIComponent(API_URL)}`;
    data = await fetchJson(proxy);
  }

  const vids = Array.isArray(data?.videos) ? data.videos : [];
  return vids.map(mapPornhub);
};

const fetchXVideosBestEffort = async (query: string, page: number) => {
  const TARGET_URL = `https://www.xvideos.com/?k=${encodeURIComponent(query)}&p=${page}&sort=relevance`;
  let html: string;
  try {
    html = await fetchText(TARGET_URL);
  } catch {
    const proxy = `https://corsproxy.io/?${encodeURIComponent(TARGET_URL)}`;
    html = await fetchText(proxy);
  }

  const rows: CatalogRow[] = [];
  const re = /class=\"thumb-block[^\"]*\"[\s\S]*?data-id=\"(\d+)\"[\s\S]*?class=\"title\"[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<img[^>]*(?:data-src=\"([^\"]+)\"|src=\"([^\"]+)\")[\s\S]*?class=\"duration\"[^>]*>([^<]+)<\/span>/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    const title = (m[2] || "").trim();
    let thumb = (m[3] || m[4] || "").trim();
    if (thumb.includes("THUMBNUM")) thumb = thumb.replace("THUMBNUM", "1");
    const durationStr = (m[5] || "0").trim();
    let duration = 0;
    if (durationStr.includes("h")) duration += parseInt(durationStr) * 3600;
    else if (durationStr.includes("min")) duration += parseInt(durationStr) * 60;
    else duration += parseInt(durationStr);

    rows.push({
      id: `xv_${id}`,
      source: "XVideos",
      title,
      description: "Source: XVideos",
      thumbnail: thumb,
      embed_url: `https://www.xvideos.com/embedframe/${id}`,
      duration,
      creator_id: "xv_net",
      creator_name: "XVideos",
      creator_avatar: "https://www.xvideos.com/favicon.ico",
      tags: ["xvideos"],
      views: 0,
      rating: 0,
      quality: "HD",
      published_at: null,
    });

    if (rows.length >= 12) break;
  }

  return rows;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const queries = (body.queries && body.queries.length > 0 ? body.queries : [
      "popular",
      "best",
      "new",
      "milf",
      "teen",
      "lesbian",
      "anal",
      "blowjob",
      "massage",
      "asian",
      "latina",
      "ebony",
      "big tits",
      "threesome",
      "creampie",
    ]).slice(0, 50);

    const pages = Math.min(Math.max(body.pages ?? 1, 1), 10);
    const perPage = Math.min(Math.max(body.per_page ?? 24, 6), 60);

    const sources = (body.sources && body.sources.length > 0 ? body.sources : ["Eporner", "Pornhub"]) as Body["sources"];

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: runRow } = await supabase
      .from('catalog_sync_runs')
      .insert({
        status: 'running',
        params: { body },
      })
      .select('id')
      .single();

    const runId = (runRow as any)?.id as string | undefined;

    let fetched = 0;
    let upserted = 0;
    const errors: Array<{ source: string; query: string; page: number; error: string }> = [];

    for (const q of queries) {
      for (let p = 1; p <= pages; p++) {
        const batch: CatalogRow[] = [];

        for (const s of sources || []) {
          try {
            if (s === "Eporner") {
              const rows = await fetchEporner(q, p, perPage);
              batch.push(...rows);
            } else if (s === "Pornhub") {
              const rows = await fetchPornhub(q, p);
              batch.push(...rows);
            } else if (s === "XVideos") {
              const rows = await fetchXVideosBestEffort(q, p);
              batch.push(...rows);
            }
          } catch (e) {
            errors.push({
              source: String(s),
              query: q,
              page: p,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        const uniqueRows = uniq(batch.map((r) => r.id)).map((id) => batch.find((x) => x.id === id)!).filter(Boolean);
        fetched += uniqueRows.length;

        if (uniqueRows.length > 0) {
          const { error } = await supabase
            .from("videos_catalog")
            .upsert(uniqueRows, { onConflict: "id" });

          if (error) {
            errors.push({ source: "supabase", query: q, page: p, error: error.message });
          } else {
            upserted += uniqueRows.length;
          }
        }
      }
    }

    const result = {
      ok: true,
      fetched,
      upserted,
      queries: queries.length,
      pages,
      per_page: perPage,
      sources,
      errors,
    };

    if (runId) {
      try {
        await supabase
          .from('catalog_sync_runs')
          .update({
            status: 'success',
            finished_at: new Date().toISOString(),
            fetched,
            upserted,
            error_count: errors.length,
            errors,
          })
          .eq('id', runId);
      } catch {}
    }

    return json(200, result);
  } catch (e) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase
          .from('catalog_sync_runs')
          .insert({
            status: 'error',
            finished_at: new Date().toISOString(),
            error_count: 1,
            errors: [{ source: 'catalog-sync', query: '', page: 0, error: e instanceof Error ? e.message : String(e) }],
          });
      }
    } catch {}
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
