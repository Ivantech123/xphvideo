import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video } from '../types';
import { Icon } from './Icon';
import { AdUnit } from './AdUnit';
import { VideoCard } from './VideoCard';
import { VideoService } from '../services/videoService';
import { SubscriptionService } from '../services/subscriptionService';
import { RecommendationService } from '../services/recommendationService';
import { TicketService, TicketType } from '../services/ticketService';
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
  const watchStartRef = useRef<number>(Date.now());
  const lastTimeUpdateSecRef = useRef<number>(-1);
  const canSubscribe =
    video?.creator?.subscribable !== false &&
    !!video?.creator?.id &&
    video.creator.id !== 'unknown' &&
    !video.creator.id.startsWith('src_');

  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<TicketType>('report');
  const [reportSubject, setReportSubject] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);

  const getTagLabel = (tag: Video['tags'][number]) => (typeof tag === 'string' ? tag : tag.label);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const requestPlay = useCallback(() => {
    const el = videoRef.current;
    setIsPlaying(true);
    if (!el) return;
    el.play().catch(() => setIsPlaying(false));
  }, []);

  const requestPause = useCallback(() => {
    const el = videoRef.current;
    if (el) el.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) {
      setIsPlaying((p) => !p);
      return;
    }
    if (el.paused) requestPlay();
    else requestPause();
  }, [requestPause, requestPlay]);

  useEffect(() => {
    // Reset states when video changes to prevent leaking state from previous video
    requestPause();
    setIsSubscribed(false);
    setIsFavorite(false);
    setRelatedVideos([]);
    setCurrentTime(0);
    lastTimeUpdateSecRef.current = -1;

    // Track video view for recommendations
    RecommendationService.trackView(video);

    watchStartRef.current = Date.now();

    setReportOpen(false);
    setReportSent(false);
    setReportError(null);
    setReportType('report');
    setReportSubject(`Report: ${video.title}`);
    setReportMessage('');
    
    setIsFavorite(VideoService.isFavorite(video.id));
    if (user && canSubscribe) {
      SubscriptionService.isSubscribed(video.creator.id).then(setIsSubscribed);
    }

    // Resume Playback
    const savedTime = RecommendationService.getWatchTime(video.id);
    if (savedTime > 5 && savedTime < video.duration - 10) {
        setCurrentTime(savedTime);
        if (videoRef.current) {
            videoRef.current.currentTime = savedTime;
        }
    }
    
    const controller = new AbortController();

    const loadRelated = async () => {
      try {
        const tagQuery =
          video.tags?.slice(0, 2).map(getTagLabel).join(' ') ||
          video.title.split(' ').slice(0, 3).join(' ') ||
          'popular';

        const tasks: Array<Promise<Video[]>> = [];

        if (video.creator?.id && video.creator.subscribable !== false) {
          tasks.push(VideoService.getVideosByCreatorId(video.creator.id, 1, 'All', 'trending', 'All', controller.signal));
        }

        tasks.push(VideoService.getVideos('General', tagQuery, 1, 'All', 'trending', 'All', controller.signal));

        const results = await Promise.all(tasks.map((p) => p.catch(() => [])));
        if (controller.signal.aborted) return;

        const merged = results.flat();
        const seen = new Set<string>([video.id]);
        const out: Video[] = [];
        for (const v of merged) {
          if (!v?.id || seen.has(v.id)) continue;
          seen.add(v.id);
          out.push(v);
          if (out.length >= 12) break;
        }

        setRelatedVideos(out);
      } catch (e) {
        if (controller.signal.aborted) return;
      }
    };

    // Defer related fetch so the player opens instantly.
    let cancelSchedule: (() => void) | null = null;
    try {
      const ric = (globalThis as any).requestIdleCallback as ((cb: () => void, opts?: { timeout?: number }) => any) | undefined;
      const cic = (globalThis as any).cancelIdleCallback as ((id: any) => void) | undefined;

      if (typeof ric === 'function') {
        const id = ric(() => loadRelated(), { timeout: 800 });
        cancelSchedule = () => cic?.(id);
      } else {
        const id = setTimeout(() => loadRelated(), 60);
        cancelSchedule = () => clearTimeout(id);
      }
    } catch {
      loadRelated();
    }

    return () => {
      try {
        const directTime = videoRef.current?.currentTime;
        const approx = (Date.now() - watchStartRef.current) / 1000;
        const watched = typeof directTime === 'number' && !Number.isNaN(directTime) ? directTime : Math.max(0, approx);
        RecommendationService.trackExit(video, watched);
      } catch {}
      cancelSchedule?.();
      controller.abort();
    };
  }, [video, user, requestPause, canSubscribe]);

  const submitReport = async () => {
    setReportError(null);
    setReportSending(true);
    try {
      const { error } = await TicketService.create({
        type: reportType,
        subject: reportSubject,
        message: reportMessage,
        video,
        pageUrl: window.location.href
      });
      if (error) {
        setReportError(error);
      } else {
        setReportSent(true);
      }
    } catch (e: any) {
      setReportError(e?.message || 'Failed to send');
    } finally {
      setReportSending(false);
    }
  };

  const toggleFav = () => {
    const newVal = VideoService.toggleFavorite(video);
    setIsFavorite(newVal);
  };

  const toggleSubscribe = async () => {
    if (!canSubscribe) return;
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

  // Track watch time periodically (for direct videos) AND approximate for embeds
  useEffect(() => {
    // Start time for session duration
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      // If direct video, use actual current time
      if (videoRef.current && !videoRef.current.paused) {
         RecommendationService.trackWatchTime(video.id, videoRef.current.currentTime);
      } else if (video.embedUrl && !document.hidden) {
         // Approximation for embeds: if window active, assume watching
         // We can't know exact seek position, but we can track total engagement
         const elapsed = (Date.now() - startTime) / 1000;
         RecommendationService.trackWatchTime(video.id, elapsed);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [video.id, video.embedUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      switch(e.code) {
        case 'Space': case 'KeyK': e.preventDefault(); togglePlay(); break;
        case 'KeyM': setIsMuted(m => !m); break;
        case 'Escape': onClose(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, togglePlay]);


  return (
    <div className="fixed inset-0 z-[60] bg-brand-bg overflow-y-auto animate-fade-in custom-scrollbar">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur z-20 px-4 h-14 flex items-center gap-4 border-b border-brand-border">
        <button onClick={onClose} className="p-2 hover:bg-brand-surface rounded-full transition text-white">
          <Icon name="ArrowLeft" size={24} />
        </button>
        <div className="flex-1 truncate">
           <span className="font-semibold text-sm md:text-base text-gray-300">{t('category_label')} <span className="text-white hover:underline cursor-pointer">{video.tags?.[0] ? getTagLabel(video.tags[0]) : 'General'}</span></span>
        </div>
        <button 
           onClick={() => setIsBlurred(!isBlurred)}
           className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border ${isBlurred ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-gray-600 hover:text-white'}`}
        >
           <Icon name={isBlurred ? "EyeOff" : "Eye"} size={14} />
           {isBlurred ? t('privacy_on') : t('privacy_off')}
        </button>

        <button
          onClick={() => {
            setReportOpen(true);
            setReportSent(false);
            setReportError(null);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border bg-transparent text-gray-400 border-gray-600 hover:text-white"
          title="Report"
        >
          <Icon name="Flag" size={14} />
          Report
        </button>
      </div>

      {reportOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-brand-surface border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="text-white font-bold flex items-center gap-2">
                <Icon name="Flag" size={18} className="text-brand-gold" />
                Report / Ticket
              </div>
              <button onClick={() => setReportOpen(false)} className="text-gray-400 hover:text-white">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {!user && (
                <div className="text-sm text-yellow-200 bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3">
                  Login required to send a ticket.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Type</div>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as TicketType)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:border-brand-gold outline-none"
                  >
                    <option value="report">Report</option>
                    <option value="bug">Bug</option>
                    <option value="feedback">Feedback</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Video</div>
                  <div className="text-sm text-gray-200 bg-black/30 border border-white/10 rounded-lg px-3 py-2 line-clamp-1">{video.title}</div>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Subject</div>
                <input
                  value={reportSubject}
                  onChange={(e) => setReportSubject(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:border-brand-gold outline-none"
                  placeholder="Subject"
                />
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Message</div>
                <textarea
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  className="w-full min-h-[120px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:border-brand-gold outline-none"
                  placeholder="Describe the issue..."
                />
              </div>

              {reportError && (
                <div className="text-sm text-red-200 bg-red-900/20 border border-red-500/20 rounded-lg p-3">
                  {reportError}
                </div>
              )}
              {reportSent && (
                <div className="text-sm text-green-200 bg-green-900/20 border border-green-500/20 rounded-lg p-3">
                  Ticket sent.
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/10 flex justify-end gap-3">
              <button onClick={() => setReportOpen(false)} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition text-gray-200">Cancel</button>
              <button
                disabled={reportSending || !user}
                onClick={submitReport}
                className="px-4 py-2 rounded-lg bg-brand-gold text-black font-bold hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reportSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1700px] mx-auto p-0 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="w-full bg-black md:rounded-xl overflow-hidden relative group aspect-video shadow-2xl shadow-black/50">
             {video.embedUrl ? (
                // External Player (Iframe)
                <>
                  <iframe 
                      src={video.embedUrl} 
                      className="w-full h-full" 
                      frameBorder="0" 
                      allowFullScreen 
                      allow="autoplay; encrypted-media"
                      title={video.title}
                  />

                  {isBlurred && (
                    <div className="absolute inset-0 z-10">
                      <img
                        src={video.thumbnail}
                        alt=""
                        className="w-full h-full object-cover blur-3xl opacity-60"
                        draggable={false}
                      />
                      <div className="absolute inset-0 bg-black/50" />
                    </div>
                  )}
                </>
             ) : (
                // Internal Player (Direct Video)
                <>
                <video 
                    src={video.videoUrl} 
                    poster={video.thumbnail}
                    className={`w-full h-full object-cover transition-all duration-500 ${isBlurred ? 'blur-3xl opacity-50' : 'opacity-100'}`}
                    ref={videoRef}
                    onTimeUpdate={(e) => {
                      const t = e.currentTarget.currentTime;
                      const sec = Math.floor(t);
                      if (sec !== lastTimeUpdateSecRef.current) {
                        lastTimeUpdateSecRef.current = sec;
                        setCurrentTime(t);
                      }
                    }}
                    preload="metadata"
                    playsInline
                    muted={isMuted}
                    loop
                />
                 
                 {!isBlurred && (
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {!isPlaying && (
                      <button onClick={requestPlay} className="pointer-events-auto w-20 h-20 bg-brand-gold/90 rounded-full flex items-center justify-center text-black hover:scale-110 hover:bg-brand-gold transition shadow-[0_0_30px_rgba(212,175,55,0.4)]">
                         <Icon name="Play" size={36} fill="currentColor" className="ml-1" />
                      </button>
                      )}
                   </div>
                 )}
                 
                 {/* Controls Overlay */}
                 <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/80 to-transparent px-4 flex items-center justify-between z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center gap-3">
                       <button onClick={togglePlay} className="text-white hover:text-brand-gold"><Icon name={isPlaying ? "Pause" : "Play"} size={20} fill="currentColor" /></button>
                       <button onClick={() => setIsMuted((m) => !m)} className="text-white hover:text-brand-gold"><Icon name={isMuted ? "VolumeX" : "Volume2"} size={20} /></button>
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
                     <img
                       src={video.creator.avatar}
                       className="w-12 h-12 rounded-full border border-brand-border cursor-pointer"
                       onClick={handleCreatorClick}
                     />
                     <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-brand-bg rounded-full"></div>
                   </div>
                   <div>
                     <h3
                       onClick={handleCreatorClick}
                       className="font-bold text-base text-white hover:text-brand-gold cursor-pointer flex items-center gap-1"
                     >
                       {video.creator.name}{' '}
                       {video.creator.verified && <Icon name="BadgeCheck" size={14} className="text-blue-400" />}
                     </h3>
                     <span className="text-xs text-gray-500">120K Subscribers</span>
                   </div>
                </div>
                {canSubscribe ? (
                  <button
                    onClick={toggleSubscribe}
                    className={`${isSubscribed ? 'bg-gray-600 hover:bg-gray-500' : 'bg-brand-accent hover:bg-red-600'} text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wide shadow-lg shadow-red-900/20 transition transform hover:scale-105`}
                  >
                    {isSubscribed ? t('subscribed') : t('subscribe')}
                  </button>
                ) : (
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                    {t('source') || 'Source'}: {video.source || 'Unknown'}
                  </div>
                )}
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
