import React, { useState } from 'react';
import { Icon } from './Icon';
import { LegalModal } from './LegalModal';
import { useLanguage } from '../contexts/LanguageContext';

interface AgeGateProps {
  onVerify: () => void;
}

export const AgeGate: React.FC<AgeGateProps> = ({ onVerify }) => {
  // Safe fallback if context isn't ready
  let t = (k: string) => k;
  try {
     const ctx = useLanguage();
     t = ctx.t;
  } catch(e) {}

  const [isExiting, setIsExiting] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const handleExit = () => {
    setIsExiting(true);
    window.location.href = 'https://www.google.com';
  };

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="absolute inset-0 bg-grain opacity-50 z-0 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-bg via-black/90 to-black z-0" />
        
        <div className="relative z-10 max-w-lg w-full animate-fade-in border border-white/10 bg-[#121212]/50 backdrop-blur-xl p-8 md:p-12 shadow-2xl">
          
          <div className="flex flex-col items-center gap-6 mb-8">
            <div className="w-20 h-20 rounded-full bg-brand-gold/5 flex items-center justify-center border border-brand-gold/20 shadow-[0_0_30px_rgba(212,175,55,0.1)]">
               <span className="font-serif font-black text-3xl text-brand-gold">V</span>
            </div>
            <div>
              <h1 className="text-4xl font-serif font-black text-white tracking-tight mb-2">VELVET</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.4em] mb-4">Cinematic Adult Experience</p>
              <div className="border border-red-900/50 bg-red-900/10 p-2 rounded">
                 <p className="text-red-500 font-bold text-xs uppercase tracking-widest">{t('age_verification')}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8 text-left">
            <h2 className="text-lg font-bold text-white uppercase">{t('age_warning_title')}</h2>
            <p className="text-gray-400 text-xs leading-relaxed">
              {t('age_warning_text')}
            </p>
            <p className="text-gray-500 text-[10px]">
               {t('footer_disclaimer')}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={onVerify}
              className="w-full bg-brand-gold hover:bg-[#b5952f] text-black font-bold py-4 px-6 rounded uppercase tracking-widest transition duration-300 shadow-lg transform hover:scale-[1.01] text-sm"
            >
              {t('enter_site')}
            </button>
            <button 
              onClick={handleExit}
              className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white font-medium py-3 px-6 rounded transition duration-300 text-xs uppercase tracking-wide"
            >
              {isExiting ? t('redirecting') : t('exit_site')}
            </button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap justify-center gap-4 text-[10px] text-gray-500 uppercase tracking-wider font-bold">
             <button onClick={() => setShowPolicy(true)} className="hover:text-brand-gold transition">{t('terms_short')}</button>
             <span>•</span>
             <button onClick={() => setShowPolicy(true)} className="hover:text-brand-gold transition">{t('privacy_short')}</button>
             <span>•</span>
             <span className="text-gray-600 cursor-default">RTA</span>
          </div>
        </div>
      </div>
      {showPolicy && <LegalModal onClose={() => setShowPolicy(false)} />}
    </>
  );
};