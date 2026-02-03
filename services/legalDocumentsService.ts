import { supabase } from './supabase';

export type LegalDocSlug = 'terms' | 'privacy' | 'dmca' | '2257' | (string & {});
export type LegalDocLang = 'en' | 'ru' | (string & {});

export type LegalDocument = {
  id: string;
  slug: string;
  lang: string;
  title: string | null;
  content_html: string;
  created_at: string;
  updated_at: string;
};

export type LegalDocumentInput = Pick<LegalDocument, 'slug' | 'lang' | 'title' | 'content_html'>;

const normalizeSlug = (value: string): string => {
  const cleaned = (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned;
};

const normalizeLang = (value: string): string => {
  const cleaned = (value || '').trim().toLowerCase();
  if (!cleaned) return 'en';
  return cleaned.replace(/[^a-z0-9_-]+/g, '');
};

export const LegalDocumentsService = {
  normalizeSlug,
  normalizeLang,

  async list(params?: { limit?: number }) {
    const limit = params?.limit ?? 200;
    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) return { data: [] as LegalDocument[], error: error.message as string | null };
    return { data: (data as LegalDocument[]) || [], error: null as string | null };
  },

  async get(slug: string, lang: string) {
    const s = normalizeSlug(slug);
    const l = normalizeLang(lang);
    if (!s) return { data: null as LegalDocument | null, error: 'Missing slug' as string | null };

    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('slug', s)
      .eq('lang', l)
      .maybeSingle();

    if (error) return { data: null as LegalDocument | null, error: error.message as string | null };
    return { data: (data as LegalDocument) || null, error: null as string | null };
  },

  async upsert(input: LegalDocumentInput) {
    const payload: LegalDocumentInput = {
      slug: normalizeSlug(input.slug),
      lang: normalizeLang(input.lang),
      title: input.title ?? null,
      content_html: input.content_html ?? '',
    };

    if (!payload.slug) return { error: 'Missing slug' as string | null };

    const { data, error } = await supabase
      .from('legal_documents')
      .upsert(payload, { onConflict: 'slug,lang' });

    if (error) return { data: null as LegalDocument | null, error: error.message as string | null };

    // Supabase doesn't always return rows for upsert unless explicitly selected.
    const refreshed = await LegalDocumentsService.get(payload.slug, payload.lang);
    if (refreshed.error) return { data: null as LegalDocument | null, error: null as string | null };
    return { data: refreshed.data, error: null as string | null };
  },

  async remove(slug: string, lang: string) {
    const s = normalizeSlug(slug);
    const l = normalizeLang(lang);
    if (!s) return { error: 'Missing slug' as string | null };

    const { error } = await supabase.from('legal_documents').delete().eq('slug', s).eq('lang', l);
    if (error) return { error: error.message as string | null };
    return { error: null as string | null };
  },
};
