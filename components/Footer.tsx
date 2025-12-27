import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icon } from './Icon';

interface FooterProps {
  onOpenLegal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegal }) => {
  const { t } = useLanguage();

  return (
    <footer className="bg-[#080808] border-t border-white/5 pt-12 pb-24 md:pb-8 mt-12 text-center md:text-left">
      <div className="max-w-[1700px] mx-auto px-6">
        
        {/* Top Section: Links & Logos */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
          
          {/* Brand & Disclaimer */}
          <div className="max-w-2xl">
            <h3 className="font-serif font-black text-2xl text-white mb-4 tracking-tight">VELVET</h3>
            <p className="text-gray-500 text-xs leading-relaxed mb-4 uppercase font-medium tracking-wide">
              {t('footer_disclaimer')}
            </p>
            <p className="text-gray-600 text-[10px] leading-relaxed">
              {t('footer_intermediary')}
            </p>
          </div>

          {/* Compliance Badges */}
          <div className="flex flex-wrap justify-center md:justify-end gap-4 opacity-50 grayscale hover:grayscale-0 transition duration-500">
             <div className="border border-white/20 px-2 py-1 rounded text-[10px] font-bold text-gray-400">{t('badge_rta')}</div>
             <div className="border border-white/20 px-2 py-1 rounded text-[10px] font-bold text-gray-400">{t('badge_asacp')}</div>
             <div className="border border-white/20 px-2 py-1 rounded text-[10px] font-bold text-gray-400">{t('badge_compliance')}</div>
             <div className="border border-white/20 px-2 py-1 rounded text-[10px] font-bold text-gray-400">{t('badge_dmca')}</div>
          </div>
        </div>

        <div className="h-px bg-white/5 w-full mb-8"></div>

        {/* Bottom Section: Links */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex flex-wrap justify-center gap-6 text-xs font-bold uppercase tracking-wider text-gray-400">
              <button onClick={onOpenLegal} className="hover:text-brand-gold transition">{t('terms_of_use')}</button>
              <button onClick={onOpenLegal} className="hover:text-brand-gold transition">{t('privacy_policy')}</button>
              <button onClick={onOpenLegal} className="hover:text-brand-gold transition">{t('dmca_policy')}</button>
              <button onClick={onOpenLegal} className="hover:text-brand-gold transition">{t('compliance_2257')}</button>
              <button onClick={onOpenLegal} className="text-red-900 hover:text-red-500 transition flex items-center gap-1">
                 <Icon name="Flag" size={12} /> {t('report_abuse')}
              </button>
           </div>
           
           <div className="text-[10px] text-gray-600 font-mono">
              © 2024 Velvet Media Holdings, Ltd. {t('rights_reserved')}
           </div>
        </div>
        
        <div className="mt-8 text-center">
            <p className="text-[10px] text-gray-700">{t('parental_control')}</p>
        </div>

      </div>
    </footer>
  );
};