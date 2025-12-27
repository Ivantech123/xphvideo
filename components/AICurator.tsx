import React, { useState } from 'react';
import { Icon } from './Icon';
import { getCuratedMood } from '../services/geminiService';
import { AIMoodResponse } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface AICuratorProps {
  onMoodSelected: (mood: AIMoodResponse) => void;
}

export const AICurator: React.FC<AICuratorProps> = ({ onMoodSelected }) => {
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);

  const handleCurate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const result = await getCuratedMood(prompt);
      if (result) {
        onMoodSelected(result);
        setPrompt('');
        setActive(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!active) {
    return (
      <button 
        onClick={() => setActive(true)}
        className="w-full bg-gradient-to-r from-brand-surface to-brand-surface/50 border border-white/10 hover:border-brand-gold/50 p-4 rounded-xl flex items-center justify-between group transition-all duration-300 shadow-lg"
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-brand-gold/10 rounded-full text-brand-gold group-hover:text-white group-hover:bg-brand-gold transition-colors">
            <Icon name="Sparkles" size={20} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white group-hover:text-brand-gold transition-colors">{t('ai_concierge')}</h3>
            <p className="text-xs text-gray-500">{t('ai_desc')}</p>
          </div>
        </div>
        <div className="bg-black/30 p-2 rounded-full">
           <Icon name="ChevronRight" size={16} className="text-gray-600 group-hover:text-brand-gold" />
        </div>
      </button>
    );
  }

  return (
    <div className="w-full bg-brand-surface border border-brand-gold/30 p-6 rounded-xl relative overflow-hidden animate-fade-in shadow-2xl">
      <div className="absolute top-0 right-0 p-4 z-20">
        <button onClick={() => setActive(false)} className="text-gray-500 hover:text-white transition">
          <Icon name="X" size={20} />
        </button>
      </div>
      
      <div className="flex flex-col gap-4 relative z-10">
        <div className="flex items-center gap-2 text-brand-gold mb-1">
          <Icon name="Bot" size={18} />
          <span className="text-xs font-bold tracking-widest uppercase">{t('velvet_intel')}</span>
        </div>
        
        <h3 className="text-xl font-serif text-white">{t('mood_prompt')}</h3>
        <p className="text-gray-400 text-sm">{t('mood_desc')}</p>
        
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCurate(); } }}
            placeholder={t('prompt_placeholder')}
            className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-white focus:outline-none focus:border-brand-gold/50 resize-none h-24 text-sm transition-colors"
          />
          {loading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-lg z-20">
              <div className="flex flex-col items-center gap-2 text-brand-gold">
                <Icon name="Loader2" size={24} className="animate-spin" />
                <span className="text-xs font-medium animate-pulse">{t('analyzing')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="flex gap-2 text-[10px] text-gray-600">
             <span className="bg-white/5 px-2 py-1 rounded">{t('safe_search')}</span>
             <span className="bg-white/5 px-2 py-1 rounded">{t('smart_tags')}</span>
          </div>
          <button 
            onClick={handleCurate}
            disabled={!prompt.trim() || loading}
            className="bg-brand-gold hover:bg-yellow-500 text-black px-6 py-2 rounded-lg font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-gold/10"
          >
            {t('pick_for_me')}
          </button>
        </div>
      </div>

      {/* Background Decor */}
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
};