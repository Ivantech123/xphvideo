import React, { useState, useEffect } from 'react';
import { Creator, Video } from '../types';
import { VideoCard } from './VideoCard';
import { Icon } from './Icon';
import { VideoService } from '../services/videoService';
import { SubscriptionService } from '../services/subscriptionService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface ProfileViewProps {
  creator: Creator;
  onVideoClick: (video: Video) => void;
  onBack: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ creator, onVideoClick, onBack }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const canSubscribe = creator?.subscribable !== false;

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch videos by creator id (stable across sources and works with catalog).
        const vids = await VideoService.getVideosByCreatorId(creator.id, 1, 'All', 'trending', 'All', controller.signal);
        if (controller.signal.aborted) return;
        setVideos(vids);
        
        if (user && canSubscribe && creator?.id) {
          const subbed = await SubscriptionService.isSubscribed(creator.id);
          if (controller.signal.aborted) return;
          setIsSubscribed(subbed);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadData();
    return () => controller.abort();
  }, [creator, user, canSubscribe]);

  const toggleSubscribe = async () => {
    if (!canSubscribe) return;
    if (!user) return; // TODO: Show auth modal
    
    if (isSubscribed) {
      await SubscriptionService.unsubscribe(creator.id);
      setIsSubscribed(false);
    } else {
      await SubscriptionService.subscribe(creator.id, creator.name, creator.avatar);
      setIsSubscribed(true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="relative h-64 md:h-80 bg-gradient-to-b from-gray-800 to-black">
        {/* Cover Image Placeholder - could be a blurred frame from a video */}
        <div className="absolute inset-0 overflow-hidden opacity-50">
           {videos.length > 0 && <img src={videos[0].thumbnail} className="w-full h-full object-cover blur-md" />}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-brand-bg to-transparent" />
        
        <button onClick={onBack} className="absolute top-4 left-4 p-2 bg-black/50 rounded-full text-white hover:bg-white/20 transition z-10">
          <Icon name="ArrowLeft" size={24} />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 flex flex-col md:flex-row items-end md:items-center gap-6">
          <div className="relative">
            <img src={creator.avatar} className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-brand-bg object-cover shadow-2xl" />
            {creator.verified && (
              <div className="absolute bottom-1 right-1 bg-blue-500 rounded-full p-1 border-2 border-brand-bg">
                <Icon name="Check" size={16} className="text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 mb-2">
            <h1 className="text-3xl md:text-4xl font-black text-white font-serif flex items-center gap-2">
              {creator.name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
              <span>{creator.tier} Model</span>
              {creator.stats?.videos ? <span>• {creator.stats.videos} Videos</span> : null}
              {typeof creator.stats?.views === 'number' && creator.stats.views > 0 ? (
                <span>• {(creator.stats.views / 1000000).toFixed(1)}M Views</span>
              ) : null}
            </div>
          </div>

          <div className="mb-2">
            {canSubscribe ? (
              <button
                onClick={toggleSubscribe}
                className={`${isSubscribed ? 'bg-gray-700 hover:bg-gray-600' : 'bg-brand-accent hover:bg-red-600'} text-white px-8 py-3 rounded-full font-bold uppercase tracking-wider shadow-lg transition transform hover:scale-105 flex items-center gap-2`}
              >
                {isSubscribed ? (
                  <><Icon name="Check" size={18} /> {t('subscribed')}</>
                ) : (
                  <><Icon name="Bell" size={18} /> {t('subscribe')}</>
                )}
              </button>
            ) : (
              <div className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border border-white/10 text-gray-400">
                {t('source') || 'Source'}: {videos?.[0]?.source || 'Unknown'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Icon name="Video" className="text-brand-gold" /> {t('videos_label') || 'Videos'}
        </h2>
        
        {loading ? (
           <div className="flex items-center justify-center h-64 text-brand-gold">
             <Icon name="Loader2" size={48} className="animate-spin" />
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map(video => (
              <VideoCard 
                key={video.id} 
                video={video} 
                onClick={() => onVideoClick(video)} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
