import React, { useEffect, useState, useRef } from 'react';
import { Video, UserMode } from '../types';
import { VideoService } from '../services/videoService';
import { Icon } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

interface ShortsViewProps {
  userMode: UserMode;
  onVideoClick: (video: Video) => void;
  onCreatorClick: (creator: any) => void;
}

export const ShortsView: React.FC<ShortsViewProps> = ({ userMode, onVideoClick, onCreatorClick }) => {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadShorts = async () => {
      setLoading(true);
      try {
        // Fetch shorts using the special query 'shorts' which the service handles
        const results = await VideoService.getVideos(userMode, 'shorts', 1, 'All', 'trending', 'All', controller.signal);
        if (controller.signal.aborted) return;
        setVideos(results);
        if (results.length > 0) {
            setActiveVideoId(results[0].id);
        }
      } catch (e) {
        if (!controller.signal.aborted) console.error("Failed to load shorts", e);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadShorts();
    return () => controller.abort();
  }, [userMode]);

  useEffect(() => {
    // Setup intersection observer to auto-play/pause videos
    const options = {
      root: containerRef.current,
      threshold: 0.6
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const videoId = entry.target.getAttribute('data-id');
          if (videoId) setActiveVideoId(videoId);
        }
      });
    }, options);

    const videoElements = document.querySelectorAll('.shorts-video-container');
    videoElements.forEach(el => observerRef.current?.observe(el));

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [videos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <Icon name="Loader2" size={48} className="text-brand-gold animate-spin" />
      </div>
    );
  }

  return (
    <div 
        ref={containerRef}
        className="h-[calc(100vh-4rem)] overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-black"
    >
      {videos.map((video) => (
        <div 
            key={video.id} 
            data-id={video.id}
            className="shorts-video-container w-full h-full snap-start relative flex items-center justify-center bg-black border-b border-gray-900"
        >
          {/* Video Player / Embed */}
          <div className="relative w-full h-full md:w-[500px] bg-black">
            {activeVideoId === video.id ? (
               <iframe 
                 src={video.embedUrl} 
                 className="w-full h-full object-cover" 
                 frameBorder="0" 
                 allowFullScreen
                 allow="autoplay; encrypted-media"
               />
            ) : (
               <div className="w-full h-full relative">
                 <img src={video.thumbnail} className="w-full h-full object-cover opacity-50 blur-sm" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Icon name="Play" size={64} className="text-white/80" />
                 </div>
               </div>
            )}

            {/* Overlay UI */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
                <div className="flex justify-between items-end">
                    <div className="pointer-events-auto">
                        <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">{video.title}</h3>
                        <div className="flex items-center gap-2" onClick={() => video.creator && onCreatorClick(video.creator)}>
                             {video.creator?.avatar && <img src={video.creator.avatar} className="w-8 h-8 rounded-full border border-white" />}
                             <span className="text-white font-medium text-sm hover:underline cursor-pointer">{video.creator?.name || 'Unknown'}</span>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-4 pointer-events-auto">
                        <button className="flex flex-col items-center gap-1 text-white hover:text-brand-gold">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                <Icon name="Heart" size={20} />
                            </div>
                            <span className="text-xs font-bold">{video.rating}%</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-white hover:text-brand-gold">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                <Icon name="MessageCircle" size={20} />
                            </div>
                            <span className="text-xs font-bold">0</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-white hover:text-brand-gold">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                <Icon name="Share2" size={20} />
                            </div>
                            <span className="text-xs font-bold">Share</span>
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>
      ))}
      
      {videos.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-500">
              <p>No shorts found in this category.</p>
          </div>
      )}
    </div>
  );
};
