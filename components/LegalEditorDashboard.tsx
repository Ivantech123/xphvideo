import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LegalDocumentsService, type LegalDocument } from '../services/legalDocumentsService';
import { sanitizeHtml } from '../services/sanitizeHtml';

type EditableDoc = {
  slug: string;
  lang: string;
  title: string;
  content_html: string;
};

const DEFAULT_TEMPLATES: Record<
  string,
  Partial<Record<'en' | 'ru', Pick<EditableDoc, 'title' | 'content_html'>>>
> = {
  terms: {
    en: {
      title: 'Terms of Service',
      content_html: `
<h2>Terms of Service</h2>
<p><strong>18+ only.</strong> By accessing this website you confirm you are at least 18 years old (or the age of majority in your jurisdiction).</p>
<h3>1. What this site is</h3>
<p>This website is an aggregator/index that links to third‑party content. We do not host primary content unless explicitly stated.</p>
<h3>2. Prohibited use</h3>
<ul>
  <li>Access by minors or exposing minors to content.</li>
  <li>Illegal content, exploitation, or non‑consensual material.</li>
  <li>Attempting to bypass access restrictions or security controls.</li>
  <li>Scraping at high volume, abuse, or attacks.</li>
</ul>
<h3>3. Notice</h3>
<p>This is a template. Replace placeholders and review with qualified counsel for your jurisdiction.</p>
      `.trim(),
    },
    ru: {
      title: 'Пользовательское соглашение',
      content_html: `
<h2>Пользовательское соглашение</h2>
<p><strong>Только 18+.</strong> Посещая сайт, вы подтверждаете, что вам исполнилось 18 лет (или возраст совершеннолетия в вашей юрисдикции).</p>
<h3>1. Описание сервиса</h3>
<p>Сайт является агрегатором/индексом ссылок на материалы третьих лиц. Мы не размещаем первичный контент, если прямо не указано иное.</p>
<h3>2. Запрещено</h3>
<ul>
  <li>Доступ несовершеннолетних и демонстрация контента несовершеннолетним.</li>
  <li>Незаконный контент, эксплуатация, материалы без согласия.</li>
  <li>Попытки обхода ограничений доступа и мер безопасности.</li>
  <li>Скрапинг в больших объёмах, злоупотребления и атаки.</li>
</ul>
<h3>3. Важно</h3>
<p>Это шаблон. Замените плейсхолдеры и согласуйте с юристом под вашу юрисдикцию.</p>
      `.trim(),
    },
  },
  privacy: {
    en: {
      title: 'Privacy Policy',
      content_html: `
<h2>Privacy Policy</h2>
<p>This template describes typical data flows for a video aggregator.</p>
<h3>1. Data we process</h3>
<ul>
  <li>Account data (if you sign in): email, user id (via Supabase Auth).</li>
  <li>Support tickets: subject/message/status/admin notes and context (page URL).</li>
  <li>Local data stored in your browser: search history, favorites, watch history, settings.</li>
  <li>Advertising identifiers/cookies (if ads are enabled).</li>
</ul>
<h3>2. Purposes</h3>
<ul>
  <li>Provide core features and personalization.</li>
  <li>Security, abuse prevention, and troubleshooting.</li>
  <li>Advertising and measurement (where applicable).</li>
</ul>
<h3>3. Contact</h3>
<p>Email: <strong>support@your-domain.example</strong></p>
      `.trim(),
    },
    ru: {
      title: 'Политика конфиденциальности',
      content_html: `
<h2>Политика конфиденциальности</h2>
<p>Это шаблон, описывающий типичные потоки данных для видео‑агрегатора.</p>
<h3>1. Какие данные обрабатываются</h3>
<ul>
  <li>Данные аккаунта (если вы входите): email, user id (через Supabase Auth).</li>
  <li>Тикеты поддержки: тема/сообщение/статус/заметки админа и контекст (URL страницы).</li>
  <li>Локальные данные в браузере: история поиска, избранное, история просмотров, настройки.</li>
  <li>Рекламные идентификаторы/куки (если реклама включена).</li>
</ul>
<h3>2. Цели</h3>
<ul>
  <li>Работа сервиса и персонализация.</li>
  <li>Безопасность, предотвращение злоупотреблений, диагностика.</li>
  <li>Реклама и измерения (если применимо).</li>
</ul>
<h3>3. Контакты</h3>
<p>Email: <strong>support@your-domain.example</strong></p>
      `.trim(),
    },
  },
  dmca: {
    en: {
      title: 'DMCA Policy',
      content_html: `
<h2>DMCA Policy</h2>
<p>If you believe content indexed by this site infringes your copyright, send a notice to:</p>
<p><strong>dmca@your-domain.example</strong></p>
<h3>Required elements</h3>
<ul>
  <li>Your contact details.</li>
  <li>Identification of the copyrighted work.</li>
  <li>URLs to the allegedly infringing material.</li>
  <li>Good‑faith statement and statement under penalty of perjury.</li>
  <li>Signature (electronic is acceptable).</li>
</ul>
      `.trim(),
    },
    ru: {
      title: 'DMCA / Правообладателям',
      content_html: `
<h2>DMCA / Правообладателям</h2>
<p>Если вы считаете, что материалы, индексируемые сайтом, нарушают ваши права, направьте уведомление на:</p>
<p><strong>dmca@your-domain.example</strong></p>
<h3>Что указать</h3>
<ul>
  <li>Ваши контактные данные.</li>
  <li>Описание объекта авторского права.</li>
  <li>Ссылки (URL) на спорный материал.</li>
  <li>Заявление о добросовестности и заявление под страхом ответственности за ложные сведения.</li>
  <li>Подпись (электронная допускается).</li>
</ul>
      `.trim(),
    },
  },
  '2257': {
    en: {
      title: '2257 Compliance',
      content_html: `
<h2>18 U.S.C. § 2257 Compliance</h2>
<p>This website does not produce primary content. If applicable, provide custodian of records information below.</p>
<div>
  <p><strong>Custodian of Records (placeholder)</strong></p>
  <p>Company Name LLC</p>
  <p>Full Address</p>
  <p>Email: compliance@your-domain.example</p>
</div>
      `.trim(),
    },
    ru: {
      title: '2257 Compliance',
      content_html: `
<h2>18 U.S.C. § 2257 Compliance</h2>
<p>Сайт не производит первичный контент. При необходимости укажите данные хранителя записей (custodian of records).</p>
<div>
  <p><strong>Custodian of Records (шаблон)</strong></p>
  <p>Company Name LLC</p>
  <p>Адрес</p>
  <p>Email: compliance@your-domain.example</p>
</div>
      `.trim(),
    },
  },
};

const normalizeKey = (value: string) => (value || '').trim().toLowerCase();

export const LegalEditorDashboard: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const { t, lang: uiLang } = useLanguage();
  const { user, isLegalEditor } = useAuth();

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);

  const [activeKey, setActiveKey] = useState<string>('');
  const [doc, setDoc] = useState<EditableDoc>({ slug: 'terms', lang: uiLang, title: '', content_html: '' });
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const canUse = !!user && isLegalEditor;

  const docKey = `${LegalDocumentsService.normalizeSlug(doc.slug)}:${LegalDocumentsService.normalizeLang(doc.lang)}`;

  const previewHtml = useMemo(() => {
    return doc.content_html.trim() ? sanitizeHtml(doc.content_html) : '';
  }, [doc.content_html]);

  const loadList = async () => {
    setListLoading(true);
    setListError(null);
    const { data, error } = await LegalDocumentsService.list({ limit: 500 });
    if (error) setListError(error);
    setDocuments(data);
    setListLoading(false);
  };

  const openDoc = async (slug: string, lang: string) => {
    const s = LegalDocumentsService.normalizeSlug(slug);
    const l = LegalDocumentsService.normalizeLang(lang);
    const key = `${s}:${l}`;

    if (dirty) {
      const ok = window.confirm('Есть несохранённые изменения. Открыть другой документ и потерять правки?');
      if (!ok) return;
    }

    setSaveError(null);
    setSaveOk(null);
    setActiveKey(key);
    setDirty(false);

    const { data, error } = await LegalDocumentsService.get(s, l);
    if (error) {
      setSaveError(error);
      setDoc({ slug: s, lang: l, title: '', content_html: '' });
      return;
    }

    if (!data) {
      setDoc({ slug: s, lang: l, title: '', content_html: '' });
      return;
    }

    setDoc({
      slug: data.slug,
      lang: data.lang,
      title: data.title || '',
      content_html: data.content_html || '',
    });
  };

  const applyTemplate = (slug: string, lang: string) => {
    const s = LegalDocumentsService.normalizeSlug(slug);
    const l = LegalDocumentsService.normalizeLang(lang) as 'en' | 'ru';
    const tpl = DEFAULT_TEMPLATES[s]?.[l];
    if (!tpl) return;
    setDoc((prev) => ({
      ...prev,
      slug: s,
      lang: l,
      title: tpl.title || prev.title,
      content_html: tpl.content_html || prev.content_html,
    }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await LegalDocumentsService.upsert({
        slug: doc.slug,
        lang: doc.lang,
        title: doc.title?.trim() || null,
        content_html: doc.content_html || '',
      });
      if (res.error) {
        setSaveError(res.error);
        return;
      }
      setDirty(false);
      setSaveOk('Saved');
      await loadList();
      if (res.data) {
        setActiveKey(`${res.data.slug}:${res.data.lang}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const s = LegalDocumentsService.normalizeSlug(doc.slug);
    const l = LegalDocumentsService.normalizeLang(doc.lang);
    const ok = window.confirm(`Удалить документ ${s} (${l})?`);
    if (!ok) return;
    const { error } = await LegalDocumentsService.remove(s, l);
    if (error) {
      setSaveError(error);
      return;
    }
    setSaveOk('Deleted');
    setDirty(false);
    setActiveKey('');
    setDoc({ slug: 'terms', lang: uiLang, title: '', content_html: '' });
    await loadList();
  };

  useEffect(() => {
    if (!canUse) return;
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

  const filteredDocs = useMemo(() => {
    const normalized = documents
      .slice()
      .sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0));
    return normalized;
  }, [documents]);

  return (
    <div className="min-h-screen bg-brand-bg text-gray-200">
      <div className="max-w-[1700px] mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
              <Icon name="FileText" size={18} className="text-brand-gold" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-500">{t('admin') || 'Admin'}</div>
              <h1 className="text-xl md:text-2xl font-serif font-bold text-white">{t('legal_editor') || 'Legal editor'}</h1>
            </div>
          </div>
          {onExit && (
            <button
              onClick={onExit}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold transition"
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="ArrowLeft" size={16} />
                Back
              </span>
            </button>
          )}
        </div>

        {!user && (
          <div className="bg-yellow-900/10 border border-yellow-500/20 text-yellow-200 p-4 rounded-xl">
            Login required to edit legal documents.
          </div>
        )}

        {user && !isLegalEditor && (
          <div className="bg-red-900/10 border border-red-500/20 text-red-200 p-4 rounded-xl">
            Access denied.
          </div>
        )}

        {canUse && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-brand-surface border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="text-sm font-bold text-white">Documents</div>
                <button
                  onClick={loadList}
                  disabled={listLoading}
                  className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-bold hover:border-brand-gold/50 transition disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              <div className="p-4 border-b border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Slug</label>
                  <input
                    value={doc.slug}
                    onChange={(e) => {
                      setDoc((prev) => ({ ...prev, slug: e.target.value }));
                      setDirty(true);
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:border-brand-gold outline-none"
                    placeholder="terms / privacy / dmca / 2257"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Lang</label>
                  <select
                    value={doc.lang}
                    onChange={(e) => {
                      setDoc((prev) => ({ ...prev, lang: e.target.value }));
                      setDirty(true);
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:border-brand-gold outline-none"
                  >
                    <option value="en">en</option>
                    <option value="ru">ru</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Template</label>
                  <div className="flex flex-wrap gap-2">
                    {(['terms', 'privacy', 'dmca', '2257'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => applyTemplate(s, doc.lang)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-gray-500">
                    Templates are placeholders. Review with counsel and replace emails/addresses.
                  </div>
                </div>
              </div>

              {listError && (
                <div className="p-4 bg-red-900/10 border-b border-red-500/20 text-red-200 text-sm">{listError}</div>
              )}

              <div className="max-h-[55vh] overflow-y-auto">
                {listLoading ? (
                  <div className="p-4 text-gray-500 text-sm">Loading…</div>
                ) : filteredDocs.length === 0 ? (
                  <div className="p-4 text-gray-500 text-sm">No documents yet.</div>
                ) : (
                  filteredDocs.map((d) => {
                    const k = `${d.slug}:${d.lang}`;
                    const isActive = k === activeKey || k === docKey;
                    return (
                      <button
                        key={k}
                        onClick={() => openDoc(d.slug, d.lang)}
                        className={`w-full text-left p-4 border-t border-white/5 hover:bg-white/5 transition ${
                          isActive ? 'bg-white/5 border-l-2 border-l-brand-gold' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">{d.title || d.slug}</div>
                            <div className="text-[11px] text-gray-500">
                              {d.slug} • {d.lang}
                            </div>
                          </div>
                          <div className="text-[11px] text-gray-600 whitespace-nowrap">
                            {new Date(d.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              <div className="bg-brand-surface border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{doc.title?.trim() || doc.slug}</div>
                    <div className="text-[11px] text-gray-500">{docKey}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {dirty && <span className="text-[11px] text-yellow-300 bg-yellow-900/20 border border-yellow-500/20 px-2 py-1 rounded">Unsaved</span>}
                    {saveOk && <span className="text-[11px] text-green-300 bg-green-900/20 border border-green-500/20 px-2 py-1 rounded">{saveOk}</span>}
                    <button
                      onClick={save}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-brand-gold text-black font-bold hover:bg-yellow-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={remove}
                      className="px-4 py-2 rounded-lg bg-red-900/20 border border-red-500/20 text-red-200 font-bold hover:bg-red-900/30 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {saveError && (
                  <div className="p-4 bg-red-900/10 border-b border-red-500/20 text-red-200 text-sm">{saveError}</div>
                )}

                <div className="p-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Title</label>
                  <input
                    value={doc.title}
                    onChange={(e) => {
                      setDoc((prev) => ({ ...prev, title: e.target.value }));
                      setDirty(true);
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:border-brand-gold outline-none"
                    placeholder="Document title"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-brand-surface border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/10 text-sm font-bold text-white">HTML</div>
                  <div className="p-4">
                    <textarea
                      value={doc.content_html}
                      onChange={(e) => {
                        setDoc((prev) => ({ ...prev, content_html: e.target.value }));
                        setDirty(true);
                      }}
                      className="w-full min-h-[420px] bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-gray-200 focus:border-brand-gold outline-none font-mono text-xs"
                      placeholder="<h2>…</h2>\n<p>…</p>"
                    />
                    <div className="mt-2 text-[11px] text-gray-500">
                      Rendering is sanitized (scripts/iframes/styles stripped).
                    </div>
                  </div>
                </div>

                <div className="bg-brand-surface border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/10 text-sm font-bold text-white">Preview</div>
                  <div className="p-4">
                    {previewHtml ? (
                      <div
                        className="prose prose-invert prose-sm max-w-none text-gray-200"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    ) : (
                      <div className="text-gray-500 text-sm">No content.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

