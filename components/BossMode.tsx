import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface BossModeProps {
  isActive: boolean;
  onExit: () => void;
}

export const BossMode: React.FC<BossModeProps> = ({ isActive, onExit }) => {
  const { t } = useLanguage();

  if (!isActive) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-white text-gray-800 font-mono flex flex-col p-8 overflow-hidden"
      onClick={onExit}
    >
      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('boss_title')}</h1>
          <p className="text-sm text-gray-500">{t('last_updated')}</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-gray-100 px-4 py-2 rounded text-sm">{t('boss_user')}</div>
           <div className="bg-blue-600 text-white px-4 py-2 rounded text-sm">{t('export_csv')}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
         {[1,2,3,4].map(i => (
           <div key={i} className="border p-4 rounded shadow-sm">
             <div className="text-xs text-gray-500 uppercase mb-2">{t('metric')} {i}</div>
             <div className="text-2xl font-bold text-blue-900">{Math.floor(Math.random() * 10000)}</div>
             <div className="text-xs text-green-600 mt-2">▲ 12.5%</div>
           </div>
         ))}
      </div>

      <div className="flex-1 border rounded shadow-inner bg-gray-50 p-6">
         <div className="w-full h-full flex flex-col gap-4">
            <div className="w-full h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-3/4 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-5/6 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-full h-64 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
               <span className="text-gray-400">{t('visualization_loading')}</span>
            </div>
         </div>
      </div>
      
      <div className="mt-4 text-center text-xs text-gray-400">
        {t('boss_return')}
      </div>
    </div>
  );
};