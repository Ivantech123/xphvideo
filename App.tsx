import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter as Router, useSearchParams } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { VideoCard } from './components/VideoCard';
import { VideoPlayer } from './components/VideoPlayer';
import { AgeGate } from './components/AgeGate';
import { BossMode } from './components/BossMode';
import { Footer } from './components/Footer';
import { LegalModal } from './components/LegalModal';
import { Icon } from './components/Icon';
import { COLLECTIONS as STATIC_COLLECTIONS, CATEGORIES_GENERAL, CATEGORIES_HIM, CATEGORIES_HER, CATEGORIES_COUPLES, CATEGORIES_GAY, CATEGORIES_TRANS, CATEGORIES_LESBIAN } from './constants';
import { Video, UserMode, Creator, Collection } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { VideoService } from './services/videoService';
import { SearchService } from './services/searchService';
import { GeoBlock } from './components/GeoBlock';
import { AuthProvider } from './contexts/AuthContext';
import { AuthModal } from './components/AuthModal';
import { ProfileView } from './components/ProfileView';
import { UserProfile } from './components/UserProfile';
import { AdUnit } from './components/AdUnit';
import { ShortsView } from './components/ShortsView';
import { AdminDashboard } from './components/AdminDashboard';

// --- NEW PAGES (Internal Components for cleaner file) ---

const ModelsGrid = ({ creators, onCreatorClick }: { creators: Creator[], onCreatorClick: (c: Creator) => void }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
    {creators.map(c => (
      <div key={c.id} onClick={() => onCreatorClick(c)} className="bg-brand-surface border border-white/5 rounded-xl overflow-hidden hover:border-brand-gold/50 transition group cursor-pointer">
        <div className="aspect-square bg-gray-800 relative">
          <img src={c.avatar} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
          {c.tier === 'Exclusive' && <div className="absolute top-2 right-2 bg-brand-gold text-black text-[10px] font-bold px-2 py-0.5 rounded">VIP</div>}
        </div>
        <div className="p-4 text-center">
          <h3 className="font-bold text-white flex items-center justify-center gap-1">
             {c.name} {c.verified && <Icon name="BadgeCheck" size={14} className="text-blue-500" />}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {c.stats ? `${c.stats.videos} Videos • ${(c.stats.views / 1000000).toFixed(1)}M Views` : '24 Videos • 1.2M Views'}
          </p>
          <button className="mt-3 w-full py-1.5 rounded bg-white/5 hover:bg-brand-gold hover:text-black text-xs font-bold transition">View Profile</button>
        </div>
      </div>
    ))}
  </div>
);

const CategoryGrid = ({ categories, onSelectCategory }: { categories: string[], onSelectCategory: (cat: string) => void }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
    {categories.slice(1).map(cat => ( // Skip "All"
      <div key={cat} onClick={() => onSelectCategory(cat)} className="aspect-video bg-gray-800 rounded-lg relative overflow-hidden group cursor-pointer border border-white/10 hover:border-brand-gold">
         <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition"></div>
         {/* Mock gradient instead of real image for category */}
         <div className="absolute inset-0 bg-gradient-to-tr from-brand-accent/20 to-transparent"></div>
         <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif font-bold text-white text-lg tracking-wider group-hover:scale-110 transition">{cat}</span>
         </div>
      </div>
    ))}
  </div>
);

// --- MAIN CONTENT WRAPPER ---
interface HomeProps {
  onVideoClick: (v: Video) => void;
  onCreatorClick: (c: Creator) => void;
  userMode: UserMode;
  currentView: 'home' | 'models' | 'categories' | 'favorites' | 'history' | 'shorts' | 'admin';
  onOpenLegal: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (c: string) => void;
  activeCategory: string;
}

 const MainContent: React.FC<HomeProps> = ({ onVideoClick, onCreatorClick, userMode, currentView, onOpenLegal, searchQuery, setSearchQuery, setActiveCategory, activeCategory }) => {
  if (import.meta.env.DEV) console.log('[MainContent] Rendering, currentView:', currentView);
  const { t } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [collections, setCollections] = useState<Collection[]>(STATIC_COLLECTIONS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeSource, setActiveSource] = useState('All');
  const [activeSort, setActiveSort] = useState<'trending' | 'new' | 'best'>('trending');
  const [activeDuration, setActiveDuration] = useState('All');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  
  // Dynamic Category List
  const currentCategories = useMemo(() => {
    switch (userMode) {
      case 'Him': return CATEGORIES_HIM;
      case 'Her': return CATEGORIES_HER;
      case 'Couples': return CATEGORIES_COUPLES;
      case 'Gay': return CATEGORIES_GAY;
      case 'Trans': return CATEGORIES_TRANS;
      case 'Lesbian': return CATEGORIES_LESBIAN;
      default: return CATEGORIES_GENERAL;
    }
  }, [userMode]);

  // Reset page and videos when filters change (home view only)
  useEffect(() => {
    if (currentView !== 'home') return;
    if (import.meta.env.DEV) console.log('[MainContent] Filter changed, resetting...', { userMode, activeCategory, searchQuery, activeSource, activeSort, activeDuration });
    setPage(1);
    setVideos([]);
    setHasMore(true);
  }, [userMode, activeCategory, searchQuery, activeSource, activeSort, activeDuration, currentView]);

  // Local-only views (no network)
  useEffect(() => {
    abortRef.current?.abort();
    requestIdRef.current += 1;
    if (currentView === 'favorites') {
      setLoading(false);
      setHasMore(false);
      setVideos(VideoService.getFavorites());
      return;
    }
    if (currentView === 'history') {
      setLoading(false);
      setHasMore(false);
      setVideos(VideoService.getHistory());
      return;
    }
    if (currentView === 'categories' || currentView === 'admin' || currentView === 'shorts') {
      setLoading(false);
      return;
    }
  }, [currentView]);

  // Fetch creators for Models view
  useEffect(() => {
    if (currentView !== 'models') return;

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    VideoService.getCreators(controller.signal)
      .then((c) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setCreators(c);
      })
      .finally(() => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [currentView]);

  // Load videos for Home view
  useEffect(() => {
    if (currentView !== 'home') return;

    // When query context changes, reset pagination and clear seen-set to avoid repeats
    setPage(1);
    setHasMore(true);
    seenIdsRef.current = new Set();
  }, [currentView, userMode, searchQuery, activeCategory, activeSource, activeSort, activeDuration]);

  // Load videos for Home view
  useEffect(() => {
    if (currentView !== 'home') return;

    if (!searchQuery && !currentCategories.includes(activeCategory)) {
      setActiveCategory(currentCategories[0]);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    const query = searchQuery || activeCategory;
    if (import.meta.env.DEV) console.log(`[MainContent] Loading videos - page: ${page}, query: "${query}", userMode: ${userMode}`);
    setLoading(true);

    (async () => {
      const limit = 24;

      // If user typed a search query, prefer indexed search via Supabase.
      if (searchQuery) {
        try {
          const { data: indexed, error } = await SearchService.searchVideos(searchQuery, {
            limit,
            offset: (page - 1) * limit,
          });

          if (controller.signal.aborted || requestId !== requestIdRef.current) return;

          // If catalog isn't ready (RPC missing) or empty results, fallback to legacy fetch.
          if (!error && indexed.length > 0) {
            if (indexed.length < limit) setHasMore(false);
            const filtered = indexed.filter(v => {
              const id = v.id;
              if (!id) return false;
              if (seenIdsRef.current.has(id)) return false;
              seenIdsRef.current.add(id);
              return true;
            });
            if (page === 1) setVideos(filtered);
            else setVideos((prev) => [...prev, ...filtered]);
            return;
          }
        } catch {
          // fallthrough to legacy fetch
        }
      }

      try {
        const vids = await VideoService.getVideos(userMode, query, page, activeSource, activeSort, activeDuration, controller.signal);
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        if (vids.length === 0) setHasMore(false);
        const filtered = vids.filter(v => {
          const id = v.id;
          if (!id) return false;
          if (seenIdsRef.current.has(id)) return false;
          seenIdsRef.current.add(id);
          return true;
        });
        if (page === 1) setVideos(filtered);
        else setVideos((prev) => [...prev, ...filtered]);
      } catch {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setHasMore(false);
      } finally {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [userMode, activeCategory, currentView, searchQuery, page, activeSource, activeSort, activeDuration, currentCategories, setActiveCategory]);

  // Render Logic based on View
  if (currentView === 'shorts') {
    return (
        <div className="flex flex-col min-h-screen bg-black">
            <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Icon name="Loader2" className="animate-spin text-brand-gold" /></div>}>
                <ShortsView 
                    userMode={userMode} 
                    onVideoClick={onVideoClick} 
                    onCreatorClick={onCreatorClick} 
                />
            </React.Suspense>
        </div>
    );
  }

  if (currentView === 'admin') {
      return (
        <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Icon name="Loader2" className="animate-spin text-brand-gold" /></div>}>
            <AdminDashboard onExit={() => window.location.reload()} />
        </React.Suspense>
      );
  }

  if (currentView === 'models') {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="p-6 flex-1">
          <h2 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-2"><Icon name="Users" /> {t('models')}</h2>
          <ModelsGrid creators={creators} onCreatorClick={onCreatorClick} />
        </div>
        <Footer onOpenLegal={onOpenLegal} />
      </div>
    );
  }

  if (currentView === 'categories') {
    if (import.meta.env.DEV) console.log('[MainContent] Rendering categories view, categories:', currentCategories);
    return (
       <div className="flex flex-col min-h-screen">
        <div className="p-6 flex-1">
          <h2 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-2"><Icon name="LayoutGrid" /> {t('categories')}</h2>
          <CategoryGrid 
            categories={currentCategories} 
            onSelectCategory={(cat) => {
                if (import.meta.env.DEV) console.log('[MainContent] Category selected:', cat);
                // setActiveCategory wrapper in App.tsx will also switch to 'home' view
                setActiveCategory(cat);
                setSearchQuery('');
            }} 
          />
        </div>
        <Footer onOpenLegal={onOpenLegal} />
      </div>
    );
  }

  if (currentView === 'favorites' || currentView === 'history') {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="p-6 flex-1">
           <h2 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-2">
             <Icon name={currentView === 'favorites' ? 'Heart' : 'History'} className="text-brand-gold" /> 
             {t(currentView)}
           </h2>
           {videos.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-gray-500">
               <Icon name="Ghost" size={48} className="mb-4 opacity-50" />
               <p>{currentView === 'favorites' ? t('no_favorites') : t('no_history')}</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {videos.map(video => <VideoCard key={video.id} video={video} onClick={() => onVideoClick(video)} onCreatorClick={onCreatorClick} />)}
             </div>
           )}
        </div>
        <Footer onOpenLegal={onOpenLegal} />
      </div>
    );
  }

  // DEFAULT HOME VIEW
  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 md:p-6 space-y-8 pb-20 flex-1">
        
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center sticky top-16 z-20 bg-brand-bg/95 backdrop-blur-sm py-2 -mx-4 px-4 md:mx-0 md:px-0 border-b border-white/5 transition-all">
          
          {/* Category Tabs / Grid Toggle */}
          <div className="flex-1 w-full relative">
             <div className={`flex gap-2 items-center w-full ${showAllCategories ? 'flex-wrap' : 'overflow-x-auto pb-2 md:pb-0 scrollbar-hide'}`}>
                <button 
                   onClick={() => setShowAllCategories(!showAllCategories)}
                   className={`px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition flex-shrink-0 border border-white/5 ${showAllCategories ? 'bg-brand-gold text-black border-brand-gold' : ''}`}
                   title={showAllCategories ? t('collapse') : t('show_all')}
                >
                   <Icon name={showAllCategories ? "ChevronUp" : "Grid"} size={16} />
                </button>
                <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0"></div>
                {currentCategories.map(cat => (
                  <button key={cat} onClick={() => { setActiveCategory(cat); setSearchQuery(''); setShowAllCategories(false); }} className={`px-4 py-1.5 rounded-none text-xs font-bold whitespace-nowrap transition border-b-2 flex-shrink-0 ${activeCategory === cat ? 'border-brand-gold text-brand-gold' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    {cat}
                  </button>
                ))}
             </div>
             {/* Overlay backdrop when expanded */}
             {showAllCategories && <div className="fixed inset-0 top-32 z-[-1] bg-black/50 backdrop-blur-sm" onClick={() => setShowAllCategories(false)}></div>}
          </div>

          {/* Filters: Source, Sort, Duration */}
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap justify-end">
             
             {/* Sort */}
             <div className="flex items-center gap-2">
               <span className="text-xs text-gray-500 font-bold uppercase hidden xl:inline">{t('sort') || 'Sort'}:</span>
               <select 
                 value={activeSort} 
                 onChange={(e) => setActiveSort(e.target.value as any)}
                 className="bg-black/40 text-white text-xs font-bold px-3 py-1.5 rounded border border-white/10 focus:border-brand-gold outline-none cursor-pointer"
               >
                 <option value="trending">{t('trending') || 'Trending'}</option>
                 <option value="new">{t('new') || 'Newest'}</option>
                 <option value="best">{t('best') || 'Top Rated'}</option>
               </select>
             </div>

             {/* Duration */}
             <div className="flex items-center gap-2">
               <span className="text-xs text-gray-500 font-bold uppercase hidden xl:inline">{t('duration') || 'Time'}:</span>
               <select 
                 value={activeDuration} 
                 onChange={(e) => setActiveDuration(e.target.value)}
                 className="bg-black/40 text-white text-xs font-bold px-3 py-1.5 rounded border border-white/10 focus:border-brand-gold outline-none cursor-pointer"
               >
                 <option value="All">{t('any') || 'Any'}</option>
                 <option value="Short">Short (&lt;10m)</option>
                 <option value="Medium">Medium (10-20m)</option>
                 <option value="Long">Long (&gt;20m)</option>
               </select>
             </div>

             {/* Source */}
             <div className="flex items-center gap-2">
               <span className="text-xs text-gray-500 font-bold uppercase hidden xl:inline">{t('source') || 'Source'}:</span>
               <select 
                 value={activeSource} 
                 onChange={(e) => setActiveSource(e.target.value)}
                 className="bg-black/40 text-white text-xs font-bold px-3 py-1.5 rounded border border-white/10 focus:border-brand-gold outline-none cursor-pointer"
               >
                 <option value="All">All Sources</option>
                 <option value="Pornhub">Pornhub</option>
                 <option value="Eporner">Eporner</option>
                 <option value="XVideos">XVideos</option>
               </select>
             </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-brand-gold">●</span> 
              {searchQuery === 'trending' ? t('trending') : 
               searchQuery === 'new' ? t('new') : 
               searchQuery ? `${t('results_for')} "${searchQuery}"` : 
               activeCategory !== 'All' ? activeCategory :
               t('recommended')}
            </h2>
            
            {/* Skeleton loading state */}
            {loading && videos.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-video bg-white/10 rounded-lg mb-3"></div>
                    <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-white/5 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            )}

            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 ${loading && videos.length === 0 ? 'hidden' : ''}`}>
              {videos.map((video, index) => (
                <React.Fragment key={video.id}>
                  <VideoCard video={video} onClick={() => onVideoClick(video)} onCreatorClick={onCreatorClick} />
                  {/* Insert Ad every 12 videos */}
                  {(index + 1) % 12 === 0 && (
                    <div className="col-span-full py-4">
                      <AdUnit size="banner" label={t('ad')} className="w-full" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {loading && (
               <div className="flex items-center justify-center h-24 text-brand-gold mt-8">
                 <Icon name="Loader2" size={32} className="animate-spin" />
               </div>
            )}

            {!loading && hasMore && videos.length > 0 && (
               <div className="flex justify-center mt-12">
                 <button 
                   onClick={() => setPage(p => p + 1)}
                   className="bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-full font-bold text-sm transition border border-white/10 hover:border-brand-gold/50"
                 >
                   {t('load_more') || 'Load More'}
                 </button>
               </div>
            )}
          </section>
          
          {userMode === 'General' && collections.map(collection => (
            collection.videos.length > 0 && (
            <section key={collection.id} className="border-t border-brand-border pt-8">
              <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                      {collection.id === 'col2' && <Icon name="Lock" size={20} className="text-brand-gold" />}
                      {collection.title}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-serif italic">{collection.description}</p>
                  </div>
                  <button className="text-brand-gold text-xs font-bold uppercase tracking-widest hover:underline">{t('view_all')}</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {collection.videos.map(video => <VideoCard key={video.id} video={video} onClick={() => onVideoClick(video)} onCreatorClick={onCreatorClick} />)}
              </div>
            </section>
            )
          ))}
        </div>
      </div>
      
      {/* Footer */}
      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
};

// --- APP WRAPPER ---

const VelvetApp = () => {
  if (import.meta.env.DEV) console.log('[VelvetApp] Component mounting...');
  const [searchParams, setSearchParams] = useSearchParams();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [isSidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia('(max-width: 768px)').matches);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [currentCreator, setCurrentCreator] = useState<Creator | null>(null);
  const [userMode, setUserMode] = useState<UserMode>('General');
  const [isBossMode, setIsBossMode] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Navigation State
  const [currentView, setCurrentView] = useState<'home'|'models'|'categories'|'favorites'|'history'|'shorts'|'admin'>('home');

  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      const nextIsMobile = !!mql.matches;
      setIsMobile(nextIsMobile);
      if (nextIsMobile) {
        sidebarHistoryPushedRef.current = false;
        setSidebarOpen(false);
      }
    };
    apply();
    mql.addEventListener?.('change', apply);
    return () => mql.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    const videoId = searchParams.get('v');
    const creatorId = searchParams.get('c');
    const query = searchParams.get('q');

    if (!videoId && currentVideo) setCurrentVideo(null);
    if (videoId && currentVideo?.id !== videoId) {
      VideoService.getVideoById(videoId).then(v => {
        if (v) setCurrentVideo(v);
      });
    }

    if (!creatorId && currentCreator) setCurrentCreator(null);
    if (creatorId && currentCreator?.id !== creatorId) {
      VideoService.getCreatorById(creatorId).then(c => {
        if (c) setCurrentCreator(c);
      });
    }

    if (!query && searchQuery) setSearchQuery('');
    if (query && searchQuery !== query) setSearchQuery(query);
  }, [searchParamsKey, currentVideo, currentCreator, searchQuery]);

  // Update URL when state changes
  useEffect(() => {
    const params: any = {};
    if (currentVideo) params.v = currentVideo.id;
    if (currentCreator) params.c = currentCreator.id;
    if (searchQuery) params.q = searchQuery;
    setSearchParams(params);
  }, [currentVideo, currentCreator, searchQuery]);

  useEffect(() => {
    const verified = localStorage.getItem('velvet_age_verified');
    setIsVerified(verified === 'true');
  }, []);

  const handleVerification = () => {
    localStorage.setItem('velvet_age_verified', 'true');
    setIsVerified(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'b') setIsBossMode(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sidebarHistoryPushedRef = useRef(false);

  useEffect(() => {
    if (isVerified === false || (isVerified === true && isMobile && isSidebarOpen)) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
  }, [isVerified, isMobile, isSidebarOpen]);

  const openSidebar = () => {
    if (!isSidebarOpen) {
      setSidebarOpen(true);
      if (isMobile && !sidebarHistoryPushedRef.current) {
        window.history.pushState({ velvetOverlay: 'sidebar' }, '');
        sidebarHistoryPushedRef.current = true;
      }
    }
  };

  const closeSidebar = () => {
    if (isSidebarOpen) {
      if (isMobile && sidebarHistoryPushedRef.current) {
        // Close immediately to avoid hiding content while waiting for popstate
        setSidebarOpen(false);
        sidebarHistoryPushedRef.current = false;
        window.history.back();
      } else {
        setSidebarOpen(false);
      }
    }
  };

  const toggleSidebar = () => {
    if (isSidebarOpen) closeSidebar();
    else openSidebar();
  };

  useEffect(() => {
    const onPop = () => {
      if (sidebarHistoryPushedRef.current && isSidebarOpen) {
        sidebarHistoryPushedRef.current = false;
        setSidebarOpen(false);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isMobile || isVerified !== true) return;

    let sx = 0;
    let sy = 0;
    let active = false;

    const onStart = (e: TouchEvent) => {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      active = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < 70) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.8) return;

      if (!isSidebarOpen && sx < 20 && dx > 70) openSidebar();
      if (isSidebarOpen && dx < -70) closeSidebar();
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isMobile, isVerified, isSidebarOpen]);

  const handlePanic = () => window.location.href = "https://www.google.com";

  // Handle Video Click (add to history)
  const handleVideoClick = (v: Video) => {
    VideoService.addToHistory(v);
    setCurrentVideo(v);
  };

  // Handle Creator Click
  const handleCreatorClick = (c: Creator) => {
    setCurrentCreator(c);
    setCurrentVideo(null); // Close video if open
  };

  if (isVerified === null) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30 animate-pulse">
          <span className="font-serif font-black text-2xl text-amber-500">V</span>
        </div>
      </div>
    );
  }

  return (
        <div className={`min-h-screen text-gray-200 font-sans selection:bg-brand-gold selection:text-black transition-colors duration-500 bg-brand-bg bg-grain`}>
          <BossMode isActive={isBossMode} onExit={() => setIsBossMode(false)} />
          {!isVerified && <AgeGate onVerify={handleVerification} />}
          
          {isLegalOpen && <LegalModal onClose={() => setIsLegalOpen(false)} />}
          {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
          {isProfileOpen && <UserProfile onClose={() => setIsProfileOpen(false)} onVideoClick={(v) => { setCurrentVideo(v); setIsProfileOpen(false); }} />}

          <div className={`transition-opacity duration-500 ${!isVerified ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
             <Navbar 
                onMenuClick={toggleSidebar} 
                onHomeClick={() => { setCurrentVideo(null); setCurrentCreator(null); setCurrentView('home'); setSearchQuery(''); }} 
                onPanic={handlePanic}
                userMode={userMode}
                onModeChange={setUserMode}
                onBossMode={() => setIsBossMode(true)}
                onAuthClick={() => setIsAuthOpen(true)}
                onProfileClick={() => setIsProfileOpen(true)}
                onSearch={setSearchQuery}
             />
             
             <Sidebar 
               isOpen={isSidebarOpen} 
               isMobile={isMobile}
               onRequestClose={closeSidebar}
               currentView={currentView}
               onChangeView={(view) => { 
                 if (import.meta.env.DEV) console.log('[App] onChangeView called with:', view);
                 setCurrentView(view); 
                 setCurrentVideo(null); 
                 setCurrentCreator(null); 
                 setSearchQuery(''); 
               }}
               onSearch={setSearchQuery}
               searchQuery={searchQuery}
             />

             <main className={`pt-16 transition-all duration-300 ${isSidebarOpen ? 'md:ml-60' : 'md:ml-20'}`}>
                {currentVideo ? (
                  <VideoPlayer 
                    video={currentVideo} 
                    onClose={() => setCurrentVideo(null)} 
                    onVideoChange={handleVideoClick}
                    onCreatorClick={handleCreatorClick}
                  />
                ) : currentCreator ? (
                  <ProfileView 
                    creator={currentCreator} 
                    onVideoClick={handleVideoClick} 
                    onBack={() => setCurrentCreator(null)} 
                  />
                ) : (
                  <MainContent 
                    onVideoClick={handleVideoClick}
                    onCreatorClick={handleCreatorClick}
                    userMode={userMode} 
                    currentView={currentView}
                    onOpenLegal={() => setIsLegalOpen(true)}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    activeCategory={activeCategory}
                    setActiveCategory={(cat) => {
                        setActiveCategory(cat);
                        if (currentView === 'categories') {
                            setCurrentView('home');
                            setSearchQuery('');
                        }
                    }}
                  />
                )}
             </main>
          </div>
        </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
      <GeoBlock>
      <Router>
        <VelvetApp />
      </Router>
      </GeoBlock>
      </AuthProvider>
    </LanguageProvider>
  );
}