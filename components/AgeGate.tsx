import React, { useState } from 'react';
import { Icon } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

const LegalModal = React.lazy(() => import('./LegalModal').then((m) => ({ default: m.LegalModal })));

interface AgeGateProps {
  onVerify: (opts?: { remember?: boolean; method?: 'dob' | 'confirm' }) => void;
}

export const AgeGate: React.FC<AgeGateProps> = ({ onVerify }) => {
  // Safe fallback if context isn't ready
  let t = (k: string) => k;
  let lang: 'ru' | 'en' = 'en';
  try {
     const ctx = useLanguage();
     t = ctx.t;
     lang = ctx.lang;
  } catch(e) {}

  const [isExiting, setIsExiting] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [policyTab, setPolicyTab] = useState<'terms' | 'privacy'>('terms');
  const [dob, setDob] = useState('');
  const [agree, setAgree] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleExit = () => {
    setIsExiting(true);
    window.location.href = 'https://www.google.com';
  };

  const computeAge = (isoDate: string) => {
    // isoDate expected as YYYY-MM-DD from <input type="date">
    const parts = isoDate.split('-').map((p) => Number(p));
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    if (!y || !m || !d) return null;

    const birth = new Date(y, m - 1, d);
    if (Number.isNaN(birth.getTime())) return null;

    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDelta = now.getMonth() - birth.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age;
  };

  const handleEnter = () => {
    setError(null);

    const age = computeAge(dob);
    if (age === null) {
      setError(lang === 'ru' ? 'Укажите дату рождения.' : 'Please enter your date of birth.');
      return;
    }
    if (age < 18) {
      setError(lang === 'ru' ? 'Доступ запрещён: только 18+.' : 'Access denied: 18+ only.');
      setTimeout(handleExit, 1200);
      return;
    }
    if (!agree) {
      setError(
        lang === 'ru'
          ? 'Подтвердите, что вам 18+ и вы принимаете условия и политику.'
          : 'Please confirm you are 18+ and accept the terms and privacy policy.'
      );
      return;
    }

    onVerify({ remember, method: 'dob' });
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

          <div className="space-y-4 mb-6 text-left">
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                {lang === 'ru' ? 'Дата рождения' : 'Date of birth'}
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-brand-gold outline-none transition"
                max={new Date().toISOString().slice(0, 10)}
              />
              <div className="text-[10px] text-gray-500 mt-2">
                {lang === 'ru'
                  ? 'Дата рождения не сохраняется — используется только для расчёта возраста.'
                  : 'DOB is not stored — it is only used to calculate your age.'}
              </div>
            </div>

            <label className="flex items-start gap-3 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1 w-4 h-4 accent-[#D4AF37]"
              />
              <span>
                {lang === 'ru'
                  ? 'Подтверждаю, что мне 18+ и я принимаю условия использования и политику конфиденциальности.'
                  : 'I confirm I am 18+ and accept the Terms of Service and Privacy Policy.'}
              </span>
            </label>

            <label className="flex items-center gap-3 text-xs text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-[#D4AF37]"
              />
              <span>{lang === 'ru' ? 'Запомнить на этом устройстве (30 дней)' : 'Remember on this device (30 days)'}</span>
            </label>

            {error && (
              <div className="bg-red-900/10 border border-red-500/20 text-red-200 text-xs p-3 rounded">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleEnter}
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
             <button onClick={() => { setPolicyTab('terms'); setShowPolicy(true); }} className="hover:text-brand-gold transition">{t('terms_short')}</button>
             <span>•</span>
             <button onClick={() => { setPolicyTab('privacy'); setShowPolicy(true); }} className="hover:text-brand-gold transition">{t('privacy_short')}</button>
             <span>•</span>
             <span className="text-gray-600 cursor-default">RTA</span>
          </div>
        </div>
      </div>
      {showPolicy && (
        <React.Suspense fallback={<div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"><Icon name="Loader2" className="animate-spin text-brand-gold" /></div>}>
          <LegalModal initialTab={policyTab} onClose={() => setShowPolicy(false)} />
        </React.Suspense>
      )}
    </>
  );
};
