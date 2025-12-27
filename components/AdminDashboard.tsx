import React, { useState, useEffect } from 'react';
import { Video, Creator } from '../types';
import { VideoService } from '../services/videoService';
import { Icon } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';

export const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'creators'>('videos');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vids, creats] = await Promise.all([
        VideoService.getVideos('General', searchQuery || 'popular'),
        VideoService.getCreators()
      ]);
      setVideos(vids);
      setCreators(creats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="min-h-screen bg-brand-bg text-gray-200 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Icon name="Shield" className="text-brand-gold" />
              {t('admin_dashboard')}
            </h1>
            <p className="text-gray-500 mt-1">{t('content_management')}</p>
          </div>
          <div className="flex gap-3">
             <button className="bg-brand-surface border border-white/10 px-4 py-2 rounded-lg hover:border-brand-gold transition flex items-center gap-2">
               <Icon name="Settings" size={18} /> {t('settings')}
             </button>
             <button className="bg-brand-gold text-black px-4 py-2 rounded-lg font-bold hover:bg-yellow-500 transition flex items-center gap-2">
               <Icon name="Plus" size={18} /> {t('add_new')}
             </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t('fetched_videos')}</div>
              <div className="text-2xl font-mono text-white">{videos.length}</div>
           </div>
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t('active_creators')}</div>
              <div className="text-2xl font-mono text-white">{creators.length}</div>
           </div>
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t('connected_sources')}</div>
              <div className="text-lg font-bold text-brand-gold mt-1">PH • EP • XV</div>
           </div>
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t('system_status')}</div>
              <div className="text-2xl font-bold text-green-500 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> {t('online')}</div>
           </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-white/10 mb-6">
           <button 
             onClick={() => setActiveTab('videos')}
             className={`pb-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'videos' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
           >
             {t('videos')}
           </button>
           <button 
             onClick={() => setActiveTab('creators')}
             className={`pb-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'creators' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
           >
             {t('creators')}
           </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
           <form onSubmit={handleSearch} className="flex-1 relative">
              <Icon name="Search" className="absolute left-3 top-3 text-gray-500" size={18} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_content')} 
                className="w-full bg-brand-surface border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-brand-gold focus:outline-none"
              />
           </form>
           <select className="bg-brand-surface border border-white/10 rounded-lg px-4 py-2 text-gray-300 focus:border-brand-gold outline-none">
              <option>{t('all_sources')}</option>
              <option>Pornhub</option>
              <option>Eporner</option>
           </select>
        </div>

        {/* Content Table */}
        <div className="bg-brand-surface border border-white/5 rounded-xl overflow-hidden">
           {loading ? (
             <div className="p-12 text-center text-gray-500">
               <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
               {t('loading')}
             </div>
           ) : activeTab === 'videos' ? (
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead className="bg-black/20 text-gray-500 text-xs uppercase">
                   <tr>
                     <th className="p-4">{t('thumbnail')}</th>
                     <th className="p-4">{t('title')}</th>
                     <th className="p-4">{t('source')}</th>
                     <th className="p-4">{t('duration')}</th>
                     <th className="p-4">{t('views')}</th>
                     <th className="p-4">{t('actions')}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                   {videos.map(video => (
                     <tr key={video.id} className="hover:bg-white/5 transition">
                       <td className="p-4 w-24">
                         <div className="w-16 h-10 rounded bg-gray-800 overflow-hidden">
                           <img src={video.thumbnail} className="w-full h-full object-cover" />
                         </div>
                       </td>
                       <td className="p-4">
                         <div className="font-bold text-white line-clamp-1">{video.title}</div>
                         <div className="text-xs text-gray-500">{video.tags.slice(0, 3).map(t => t.label).join(', ')}</div>
                       </td>
                       <td className="p-4">
                         <span className={`text-xs px-2 py-1 rounded ${video.source === 'Pornhub' ? 'bg-orange-900/30 text-orange-400' : 'bg-red-900/30 text-red-400'}`}>
                           {video.source || t('external_source')}
                         </span>
                       </td>
                       <td className="p-4 text-sm font-mono text-gray-400">
                         {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                       </td>
                       <td className="p-4 text-sm text-gray-400">
                         {video.views.toLocaleString()}
                       </td>
                       <td className="p-4">
                         <button className="text-gray-400 hover:text-white mr-2"><Icon name="Edit" size={16} /></button>
                         <button className="text-gray-400 hover:text-red-500"><Icon name="Trash" size={16} /></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           ) : (
             <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {creators.map(creator => (
                  <div key={creator.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-black/20">
                     <img src={creator.avatar} className="w-10 h-10 rounded-full object-cover" />
                     <div>
                        <div className="font-bold text-sm text-white">{creator.name}</div>
                        <div className="text-xs text-gray-500">{creator.tier === 'Exclusive' ? t('exclusive_tier') : creator.tier === 'Premium' ? t('premium_tag') : t('standard_tier')}</div>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
