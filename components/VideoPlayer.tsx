import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { Icon } from './Icon';
import { AdUnit } from './AdUnit';
import { VideoCard } from './VideoCard';
import { VideoService } from '../services/videoService';
import { SubscriptionService } from '../services/subscriptionService';
import { RecommendationService } from '../services/recommendationService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface VideoPlayerProps {
  video: Video;
  onClose: () => void;
  onVideoChange: (video: Video) => void;
  onCreatorClick?: (creator: any) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onClose, onVideoChange, onCreatorClick }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isBlurred, setIsBlurred] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (videoRef.current) {
        if (isPlaying) {
            videoRef.current.play().catch(() => {});
        } else {
            videoRef.current.pause();
        }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
        videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    // Track video view for recommendations
    RecommendationService.trackView(video);
    
    setIsFavorite(VideoService.isFavorite(video.id));
    if (user && video.creator?.id) {
        SubscriptionService.isSubscribed(video.creator.id).then(setIsSubscribed);
    }
    
    // Fetch related videos based on tags or title
    const loadRelated = async () => {
       // Use up to 3 tags for better relevance, or title keywords
       const tags = video.tags?.slice(0, 3).map(t => t.label).join(' ') || video.title.split(' ').slice(0, 3).join(' ');
       const query = tags || 'popular';
       const vids = await VideoService.getVideos('General', query);
       // Filter out current video
       const filtered = vids.filter(v => v.id !== video.id).slice(0, 12);
       setRelatedVideos(filtered);
    };
    loadRelated();
  }, [video, user]);

  const toggleFav = () => {
    const newVal = VideoService.toggleFavorite(video);
    setIsFavorite(newVal);
  };

  const toggleSubscribe = async () => {
    if (!user) {
        // Maybe prompt login, but for now just ignore or show toast
        return;
    }
    if (isSubscribed) {
        await SubscriptionService.unsubscribe(video.creator.id);
        setIsSubscribed(false);
    } else {
        await SubscriptionService.subscribe(video.creator.id, video.creator.name, video.creator.avatar);
        setIsSubscribed(true);
    }
  };

  const handleCreatorClick = () => {
    if (onCreatorClick) {
        onCreatorClick(video.creator);
    }
  };

  // Track watch time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentTime > 0) {
        RecommendationService.trackWatchTime(video.id, currentTime);
      }
    }, 10000); // Save every 10 seconds
    return () => clearInterval(interval);
  }, [video.id, currentTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      switch(e.code) {
        case 'Space': case 'KeyK': e.preventDefault(); setIsPlaying(p => !p); break;
        case 'KeyM': setIsMuted(m => !m); break;
        case 'Escape': onClose(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


  return (
    <div className="fixed inset-0 z-[60] bg-brand-bg overflow-y-auto animate-fade-in custom-scrollbar">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur z-20 px-4 h-14 flex items-center gap-4 border-b border-brand-border">
        <button onClick={onClose} className="p-2 hover:bg-brand-surface rounded-full transition text-white">
          <Icon name="ArrowLeft" size={24} />
        </button>
        <div className="flex-1 truncate">
           <span className="font-semibold text-sm md:text-base text-gray-300">{t('category_label')} <span className="text-white hover:underline cursor-pointer">{video.tags?.[0]?.label || 'General'}</span></span>
        </div>
        <button 
           onClick={() => setIsBlurred(!isBlurred)}
           className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border ${isBlurred ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-gray-600 hover:text-white'}`}
        >
           <Icon name={isBlurred ? "EyeOff" : "Eye"} size={14} />
           {isBlurred ? t('privacy_on') : t('privacy_off')}
        </button>
      </div>

      <div className="max-w-[1700px] mx-auto p-0 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="w-full bg-black md:rounded-xl overflow-hidden relative group aspect-video shadow-2xl shadow-black/50">
             {video.embedUrl ? (
                // External Player (Iframe)
                <iframe 
                    src={video.embedUrl} 
                    className="w-full h-full" 
                    frameBorder="0" 
                    allowFullScreen 
                    allow="autoplay; encrypted-media"
                    title={video.title}
                />
             ) : (
                // Internal Player (Direct Video)
                <>
                <video 
                    src={video.videoUrl} 
                    poster={video.thumbnail}
                    className={`w-full h-full object-cover transition-all duration-500 ${isBlurred ? 'blur-3xl opacity-50' : 'opacity-100'}`}
                    ref={videoRef}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    loop
                />
                 
                 {!isBlurred && (
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {!isPlaying && (
                      <button onClick={() => setIsPlaying(true)} className="pointer-events-auto w-20 h-20 bg-brand-gold/90 rounded-full flex items-center justify-center text-black hover:scale-110 hover:bg-brand-gold transition shadow-[0_0_30px_rgba(212,175,55,0.4)]">
                         <Icon name="Play" size={36} fill="currentColor" className="ml-1" />
                      </button>
                      )}
                   </div>
                 )}
                 
                 {/* Controls Overlay */}
                 <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/80 to-transparent px-4 flex items-center justify-between z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center gap-3">
                       <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-brand-gold"><Icon name={isPlaying ? "Pause" : "Play"} size={20} fill="currentColor" /></button>
                       <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-brand-gold"><Icon name={isMuted ? "VolumeX" : "Volume2"} size={20} /></button>
                       <div className="text-white text-xs font-mono">{formatTime(currentTime)} / {formatTime(video.duration)}</div>
                    </div>
                    <div className="flex gap-4 items-center">
                       <button className="text-white hover:text-brand-gold transition"><Icon name="Maximize" size={20} /></button>
                    </div>
                 </div>
                </>
             )}
          </div>

          <AdUnit size="banner" className="h-20 w-full rounded-none md:rounded-lg border-brand-gold/20" label={t('ad')} />

          <div className="px-4 md:px-0">
            <h1 className="text-lg md:text-2xl font-bold text-white mb-2 leading-snug">{video.title}</h1>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-4">
               <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1"><Icon name="Eye" size={16} /> {video.views.toLocaleString()}</span>
                  {video.rating !== undefined && video.rating > 0 && (
                    <span className="flex items-center gap-1 text-green-500"><Icon name="ThumbsUp" size={16} /> {video.rating}%</span>
                  )}
               </div>
               <div className="flex items-center gap-2">
                  <button onClick={toggleFav} className={`flex items-center gap-2 bg-brand-surface px-4 py-2 rounded-full transition text-sm font-medium ${isFavorite ? 'text-red-500 bg-white/10' : 'text-white hover:bg-white/10'}`}>
                    <Icon name="Heart" size={18} fill={isFavorite ? "currentColor" : "none"} /> <span className="hidden sm:inline">{t('favorites')}</span>
                  </button>
               </div>
            </div>
            
             <div className="flex items-center justify-between py-4 border-b border-brand-border">
               <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={video.creator.avatar} className="w-12 h-12 rounded-full border border-brand-border" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-brand-bg rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white hover:text-brand-gold cursor-pointer flex items-center gap-1">{video.creator.name} {video.creator.verified && <Icon name="BadgeCheck" size={14} className="text-blue-400" />}</h3>
                    <span className="text-xs text-gray-500">120K Subscribers</span>
                  </div>
               </div>
               <button 
                 onClick={toggleSubscribe}
                 className={`${isSubscribed ? 'bg-gray-600 hover:bg-gray-500' : 'bg-brand-accent hover:bg-red-600'} text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wide shadow-lg shadow-red-900/20 transition transform hover:scale-105`}
               >
                 {isSubscribed ? t('subscribed') : t('subscribe')}
               </button>
            </div>

            <div className={`bg-brand-surface/50 p-4 rounded-xl text-sm text-gray-300 mt-4 transition-all duration-300 ${isBlurred ? 'blur-md select-none opacity-50' : ''}`}>
               <p className="leading-relaxed">{video.description}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4 px-4 lg:px-0">
           <div className="flex flex-col gap-3">
              {relatedVideos.length > 0 ? relatedVideos.map((v, i) => (
                 <React.Fragment key={v.id}>
                    <VideoCard video={v} compact onClick={() => onVideoChange(v)} onCreatorClick={onCreatorClick} />
                    {i === 2 && <AdUnit size="banner" className="h-24 w-full" label={t('ad')} />}
                 </React.Fragment>
              )) : (
                  <div className="text-gray-500 text-center py-10">{t('loading_suggestions')}</div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};