import React, { useState, useEffect } from 'react';
import { UserMode, Creator } from '../types';
import { Icon } from './Icon';
import { VideoService } from '../services/videoService';
import { useLanguage } from '../contexts/LanguageContext';

interface BodyRatingsProps {
  userMode: UserMode;
  onClose: () => void;
}

export const BodyRatings: React.FC<BodyRatingsProps> = ({ userMode, onClose }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(0);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await VideoService.getCreators();
      setCreators(data);
      setLoading(false);
    };
    load();
  }, []);

  // Organize creators into pseudo-categories for the UI
  const categories = [
    { label: t('global_top'), items: creators.slice(0, 20) },
    { label: t('trending'), items: creators.slice(20, 40) },
    { label: t('rising_stars'), items: creators.slice(40, 60) }
  ];

  const currentCategory = categories[activeTab] || categories[0];

  const getTierLabel = (tier: string) => {
    if (tier === 'Exclusive') return t('exclusive_tier');
    if (tier === 'Premium') return t('premium');
    return t('standard_tier');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-2xl bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-brand-surface to-brand-bg">
           <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2 uppercase tracking-tighter">
                <Icon name="Trophy" className="text-brand-gold" size={24} />
                {t('velvet_charts')}
              </h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">
                 {t('top_ratings')} • {userMode} Mode
              </p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
              <Icon name="X" size={24} className="text-gray-400" />
           </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 overflow-x-auto scrollbar-hide">
           {categories.map((cat, idx) => (
             <button 
               key={idx}
               onClick={() => setActiveTab(idx)}
               className={`px-6 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                 activeTab === idx 
                   ? 'text-brand-gold border-b-2 border-brand-gold bg-white/5' 
                   : 'text-gray-500 hover:text-white hover:bg-white/5'
               }`}
             >
               {cat.label}
             </button>
           ))}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
           {loading ? (
             <div className="flex items-center justify-center h-40 text-brand-gold">
               <Icon name="Loader2" size={32} className="animate-spin" />
             </div>
           ) : currentCategory.items.map((item, idx) => (
             <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-brand-gold/30 hover:bg-white/10 transition group cursor-pointer">
                
                {/* Rank Number */}
                <div className={`text-2xl font-black w-8 text-center ${idx === 0 ? 'text-brand-gold' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-700' : 'text-gray-600'}`}>
                   {idx + 1}
                </div>

                {/* Avatar */}
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-brand-gold transition">
                   <img src={item.avatar} className="w-full h-full object-cover" alt={item.name} onError={(e) => (e.currentTarget.src = 'https://www.pornhub.com/favicon.ico')} />
                </div>

                {/* Info */}
                <div className="flex-1">
                   <h3 className="font-bold text-white group-hover:text-brand-gold transition">{item.name}</h3>
                   <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{getTierLabel(item.tier)}</span>
                      {item.verified && <Icon name="BadgeCheck" size={14} className="text-blue-500" />}
                   </div>
                </div>

                {/* Vote Button */}
                <button className="p-3 rounded-full bg-white/5 hover:bg-brand-gold hover:text-black transition">
                   <Icon name="ThumbsUp" size={18} />
                </button>
             </div>
           ))}

           <div className="text-center text-xs text-gray-600 mt-8 uppercase tracking-widest">
              {t('live_data')}
           </div>
        </div>
      </div>
    </div>
  );
};