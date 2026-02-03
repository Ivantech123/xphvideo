import React from 'react';
import { Video } from '../types';
import { Icon } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

interface VideoCardProps {
  video: Video;
  compact?: boolean; // For sidebar lists
  onClick?: () => void;
  onCreatorClick?: (creator: any) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, compact = false, onClick, onCreatorClick }) => {
  const { t } = useLanguage();

  const handleCreatorClick = (e: React.MouseEvent) => {
    if (onCreatorClick) {
        e.stopPropagation();
        onCreatorClick(video.creator);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(0)}K`;
    return views;
  };

  if (compact) {
    return (
      <div onClick={onClick} className="flex gap-2 cursor-pointer group hover:bg-brand-surface p-2 rounded transition">
        <div className="relative w-40 h-24 flex-shrink-0 overflow-hidden rounded-md bg-gray-800">
           <img
             src={video.thumbnail}
             className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
             alt={video.title}
             loading="lazy"
             decoding="async"
             draggable={false}
           />
           <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1 rounded">
             {formatTime(video.duration)}
           </span>
        </div>
        <div className="flex flex-col gap-1 overflow-hidden">
          <h4 className="text-sm font-medium text-white line-clamp-2 leading-tight group-hover:text-brand-gold transition" title={video.title}>
            {video.title}
          </h4>
          <span className="text-xs text-gray-400 truncate">{video.creator?.name || video.source || 'Unknown'}</span>
          <span className="text-[10px] text-gray-500">{formatViews(video.views)} {t('views')}</span>
        </div>
      </div>
    )
  }

  return (
    <div 
      onClick={onClick} 
      className="flex flex-col gap-2 cursor-pointer group relative"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-900 border border-white/5 group-hover:border-brand-gold/30 transition-colors">
        <img 
          src={video.thumbnail} 
          alt={video.title} 
          className="w-full h-full object-cover transition duration-500 ease-out opacity-100 scale-100 group-hover:scale-105 group-hover:opacity-60"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        
        {/* Play Icon on Hover - Strong CTA */}
        <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 opacity-0 group-hover:opacity-100">
           <Icon name="PlayCircle" size={48} className="text-white drop-shadow-lg" fill="rgba(0,0,0,0.5)" />
        </div>

        {/* Badges - Critical for "Quality" perception */}
        <div className="absolute top-2 right-2 flex gap-1">
           {video.quality === '4K' && (
             <span className="bg-brand-gold text-black px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">4K</span>
           )}
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-xs font-medium text-white font-mono">
          {formatTime(video.duration)}
        </div>
        
        {/* Hover Progress Bar Simulation - Classic "Tube" feature */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800/50">
          <div 
            className="h-full bg-brand-gold transition-all duration-[2000ms] ease-linear w-0 group-hover:w-full"
          />
        </div>
      </div>

      {/* Info Section */}
      <div className="flex gap-3 items-start pr-2">
        {video.creator && (
          <div className="flex-shrink-0 relative cursor-pointer" onClick={handleCreatorClick}>
            <img src={video.creator.avatar} className="w-10 h-10 rounded-full object-cover border border-white/10 hover:border-brand-gold transition-colors" alt="Avatar" />
            {video.creator.verified && (
               <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 border border-black">
                 <Icon name="Check" size={8} className="text-white" />
               </div>
            )}
          </div>
        )}
        
        <div className="flex flex-col min-w-0">
          <h3 className="text-white font-medium text-sm leading-tight line-clamp-2 mb-1 group-hover:text-brand-gold transition">
            {video.title}
          </h3>
          {video.creator && (
            <div className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition cursor-pointer w-fit" onClick={handleCreatorClick}>
              <span>{video.creator.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 font-medium">
            <span>{formatViews(video.views)} {t('views')}</span>
            <span>•</span>
            {video.rating ? (
              <span>{video.rating}% <Icon name="ThumbsUp" size={10} className="inline mb-0.5" /></span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
