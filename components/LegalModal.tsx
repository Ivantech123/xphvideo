import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { LegalDocumentsService, type LegalDocument } from '../services/legalDocumentsService';
import { sanitizeHtml } from '../services/sanitizeHtml';

interface LegalModalProps {
  onClose: () => void;
  initialTab?: Tab;
}

type Tab = 'terms' | '2257' | 'dmca' | 'privacy';

export const LegalModal: React.FC<LegalModalProps> = ({ onClose, initialTab }) => {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || 'terms');
  const [docs, setDocs] = useState<Record<string, LegalDocument | null>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedRef = useRef<Set<string>>(new Set());

  const slug = useMemo(() => {
    if (activeTab === '2257') return '2257';
    return activeTab;
  }, [activeTab]);

  const activeDoc = docs[`${slug}:${lang}`] ?? null;
  const sanitizedHtml = useMemo(() => {
    const raw = activeDoc?.content_html || '';
    return raw.trim() ? sanitizeHtml(raw) : '';
  }, [activeDoc?.content_html]);
  const lastUpdatedLabel = lang === 'ru' ? 'Обновлено' : 'Last updated';

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let cancelled = false;

    const fetchOne = async (targetSlug: string, targetLang: string) => {
      const key = `${targetSlug}:${targetLang}`;
      if (loadedRef.current.has(key)) return;
      loadedRef.current.add(key);
      const { data, error } = await LegalDocumentsService.get(targetSlug, targetLang);
      if (cancelled) return;
      if (error) {
        setDocs((prev) => ({ ...prev, [key]: null }));
        return;
      }
      setDocs((prev) => ({ ...prev, [key]: data }));
    };

    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        await fetchOne(slug, lang);

        // Best-effort prefetch the other tabs for smoother navigation.
        const slugs: string[] = ['terms', 'privacy', 'dmca', '2257'];
        await Promise.all(slugs.filter((s) => s !== slug).map((s) => fetchOne(s, lang)));
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || 'Failed to load policies');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, lang]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-[#0f0f0f] w-full md:max-w-4xl h-full md:h-[85vh] md:rounded-lg border border-white/5 shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-brand-gold rounded flex items-center justify-center text-black font-serif font-bold text-lg">V</div>
             <div>
               <h2 className="text-lg font-bold text-white tracking-wide uppercase">{t('legal_center')}</h2>
               <p className="text-[10px] text-gray-500 uppercase tracking-widest">{t('compliance_safety')}</p>
             </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
             <Icon name="X" size={24} />
           </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Tabs (Desktop) */}
          <div className="hidden md:block w-64 bg-[#080808] border-r border-white/5 p-4 space-y-2">
             <button onClick={() => setActiveTab('terms')} className={`w-full text-left px-4 py-3 rounded text-xs font-bold uppercase tracking-wider transition ${activeTab === 'terms' ? 'bg-white/10 text-brand-gold border-l-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}>{t('terms_tab')}</button>
             <button onClick={() => setActiveTab('2257')} className={`w-full text-left px-4 py-3 rounded text-xs font-bold uppercase tracking-wider transition ${activeTab === '2257' ? 'bg-white/10 text-brand-gold border-l-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}>{t('compliance_tab')}</button>
             <button onClick={() => setActiveTab('dmca')} className={`w-full text-left px-4 py-3 rounded text-xs font-bold uppercase tracking-wider transition ${activeTab === 'dmca' ? 'bg-white/10 text-brand-gold border-l-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}>{t('dmca_tab')}</button>
             <button onClick={() => setActiveTab('privacy')} className={`w-full text-left px-4 py-3 rounded text-xs font-bold uppercase tracking-wider transition ${activeTab === 'privacy' ? 'bg-white/10 text-brand-gold border-l-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}>{t('privacy_tab')}</button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gradient-to-br from-[#0f0f0f] to-black custom-scrollbar">
             
             {/* Mobile Tabs */}
             <div className="md:hidden flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-white/5 scrollbar-hide">
                <button onClick={() => setActiveTab('terms')} className={`whitespace-nowrap px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider border ${activeTab === 'terms' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-transparent text-gray-500 border-white/10'}`}>{t('terms_tab')}</button>
                <button onClick={() => setActiveTab('2257')} className={`whitespace-nowrap px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider border ${activeTab === '2257' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-transparent text-gray-500 border-white/10'}`}>{t('compliance_tab')}</button>
                <button onClick={() => setActiveTab('dmca')} className={`whitespace-nowrap px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider border ${activeTab === 'dmca' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-transparent text-gray-500 border-white/10'}`}>{t('dmca_tab')}</button>
                <button onClick={() => setActiveTab('privacy')} className={`whitespace-nowrap px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider border ${activeTab === 'privacy' ? 'bg-brand-gold text-black border-brand-gold' : 'bg-transparent text-gray-500 border-white/10'}`}>{t('privacy_tab')}</button>
             </div>

             <div className="prose prose-invert prose-sm max-w-none text-gray-400">
               {loadError && (
                 <div className="mb-6 bg-red-900/10 border border-red-900/30 p-4 rounded text-sm text-red-200">
                   {loadError}
                 </div>
               )}

               {loading && !activeDoc && (
                 <div className="space-y-3 animate-pulse">
                   <div className="h-6 w-52 bg-white/10 rounded" />
                   <div className="h-3 w-full bg-white/5 rounded" />
                   <div className="h-3 w-11/12 bg-white/5 rounded" />
                   <div className="h-3 w-10/12 bg-white/5 rounded" />
                 </div>
               )}

               {activeDoc?.content_html?.trim() ? (
                 <div className="animate-fade-in space-y-6">
                   <h3 className="text-xl font-serif text-white border-b border-brand-gold/30 pb-2">
                     {activeDoc.title || (activeTab === 'terms' ? t('terms_title') : activeTab === 'privacy' ? t('privacy_title') : activeTab === 'dmca' ? t('dmca_title') : t('compliance_title'))}
                   </h3>
                   <div
                     className="text-sm leading-relaxed"
                     dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                   />
                   <div className="text-[11px] text-gray-500 border-t border-white/10 pt-4">
                     {lastUpdatedLabel}: {new Date(activeDoc.updated_at).toLocaleString()}
                   </div>
                 </div>
               ) : (
                 <>
               {activeTab === 'terms' && (
                 <div className="animate-fade-in space-y-6">
                    <h3 className="text-xl font-serif text-white border-b border-brand-gold/30 pb-2">{t('terms_title')}</h3>
                    <p className="text-sm font-medium text-white bg-red-900/10 border border-red-900/30 p-4 rounded">
                       {t('terms_warning')}
                    </p>
                    <p>{t('terms_affirm')}</p>
                    <ul className="list-disc pl-5 space-y-2">
                       <li>{t('terms_age')}</li>
                       <li>{t('terms_legal')}</li>
                       <li>{t('terms_vol')}</li>
                       <li>{t('terms_minors')}</li>
                    </ul>
                    <p>Velvet Media Holdings, Ltd. reserves the right to terminate access to anyone who violates these terms.</p>
                 </div>
               )}

               {activeTab === '2257' && (
                 <div className="animate-fade-in space-y-6">
                    <h3 className="text-xl font-serif text-white border-b border-brand-gold/30 pb-2">{t('compliance_title')}</h3>
                    <p>{t('compliance_text')}</p>
                    <div className="bg-white/5 p-6 rounded border border-white/10">
                       <h4 className="text-white font-bold mb-2 uppercase text-xs">{t('custodian')}</h4>
                       <p className="text-gray-300 italic">
                         Velvet Media Holdings, Ltd.<br/>
                         Legal Department / Compliance Officer<br/>
                         1200 N. Federal Hwy, Suite 200<br/>
                         Boca Raton, FL 33432, USA
                       </p>
                    </div>
                 </div>
               )}

               {activeTab === 'dmca' && (
                 <div className="animate-fade-in space-y-6">
                    <h3 className="text-xl font-serif text-white border-b border-brand-gold/30 pb-2">{t('dmca_title')}</h3>
                    <p>{t('dmca_text')}</p>
                    <p className="mt-4">
                       <strong>{t('zero_tolerance')}</strong> {t('zero_tolerance_text')}
                    </p>
                    <p>Report Abuse / DMCA: <span className="text-brand-gold cursor-pointer">legal@velvet.com</span></p>
                 </div>
               )}

               {activeTab === 'privacy' && (
                 <div className="animate-fade-in space-y-6">
                    <h3 className="text-xl font-serif text-white border-b border-brand-gold/30 pb-2">{t('privacy_title')}</h3>
                    <p>{t('privacy_text')}</p>
                    <h4 className="font-bold text-white text-sm">{t('data_collection')}</h4>
                    <p>{t('data_text')}</p>
                    <h4 className="font-bold text-white text-sm">{t('cookies')}</h4>
                    <p>{t('cookies_text')}</p>
                 </div>
               )}
                 </>
               )}

             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-black flex justify-end">
          <button 
            onClick={onClose}
            className="bg-brand-gold hover:bg-yellow-500 text-black px-8 py-2 rounded font-bold uppercase tracking-widest transition text-xs"
          >
            {t('close')}
          </button>
        </div>

      </div>
    </div>
  );
};
