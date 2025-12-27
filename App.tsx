import React, { useState, useEffect } from 'react';
import { HashRouter as Router } from 'react-router-dom';
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
import { GeoBlock } from './components/GeoBlock';
import { AuthProvider } from './contexts/AuthContext';
import { AuthModal } from './components/AuthModal';

// --- NEW PAGES (Internal Components for cleaner file) ---

const ModelsGrid = ({ creators }: { creators: Creator[] }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
    {creators.map(c => (
      <div key={c.id} className="bg-brand-surface border border-white/5 rounded-xl overflow-hidden hover:border-brand-gold/50 transition group cursor-pointer">
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

const CategoryGrid = ({ categories }: { categories: string[] }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
    {categories.slice(1).map(cat => ( // Skip "All"
      <div key={cat} className="aspect-video bg-gray-800 rounded-lg relative overflow-hidden group cursor-pointer border border-white/10 hover:border-brand-gold">
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
  userMode: UserMode;
  currentView: 'home' | 'models' | 'categories' | 'favorites' | 'history';
  onOpenLegal: () => void;
}

const MainContent: React.FC<HomeProps> = ({ onVideoClick, userMode, currentView, onOpenLegal }) => {
  console.log('[MainContent] Rendering, currentView:', currentView);
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [videos, setVideos] = useState<Video[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [collections, setCollections] = useState<Collection[]>(STATIC_COLLECTIONS);
  const [loading, setLoading] = useState(true);
  
  // Dynamic Category List
  const getCategories = () => {
    switch (userMode) {
      case 'Him': return CATEGORIES_HIM;
      case 'Her': return CATEGORIES_HER;
      case 'Couples': return CATEGORIES_COUPLES;
      case 'Gay': return CATEGORIES_GAY;
      case 'Trans': return CATEGORIES_TRANS;
      case 'Lesbian': return CATEGORIES_LESBIAN;
      default: return CATEGORIES_GENERAL;
    }
  };
  const currentCategories = getCategories();

  // Load Data Effect
  useEffect(() => {
    // If search is active, use it. Otherwise use active category.
    // Reset category to first item when mode changes, unless searching.
    if (!searchQuery) {
        // Only reset category if we are not searching
        if (!currentCategories.includes(activeCategory)) {
            setActiveCategory(currentCategories[0]);
        }
    }

    const loadData = async () => {
      console.log('[MainContent] Loading data...');
      setLoading(true);
      try {
        // 1. Fetch Videos
        console.log('[MainContent] Fetching videos for', userMode, searchQuery || activeCategory);
        const query = searchQuery || activeCategory;
        const vids = await VideoService.getVideos(userMode, query);
        console.log('[MainContent] Got videos:', vids.length);
        
        // 2. Filter by View Type (History/Favs)
        if (currentView === 'favorites') {
          setVideos(VideoService.getFavorites());
        } else if (currentView === 'history') {
          setVideos(VideoService.getHistory());
        } else {
          // Normal Home / Category View
          setVideos(vids);
        }

        // 3. Fetch Creators
        if (currentView === 'models') {
          const c = await VideoService.getCreators();
          setCreators(c);
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [userMode, activeCategory, currentView, searchQuery]);

  // Expose search handler for parent to call (via props, but here we just need to react to props)
  // Actually, MainContent needs to receive the search query or handler. 
  // Let's lift the state up to App, or handle it via props.
  // Wait, MainContent is a child. App has the Navbar. 
  // We need to pass onSearch from Navbar -> App -> MainContent (or state in App).


  // Render Logic based on View
  if (currentView === 'models') {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="p-6 flex-1">
          <h2 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-2"><Icon name="Users" /> {t('models')}</h2>
          <ModelsGrid creators={creators} />
        </div>
        <Footer onOpenLegal={onOpenLegal} />
      </div>
    );
  }

  if (currentView === 'categories') {
    return (
       <div className="flex flex-col min-h-screen">
        <div className="p-6 flex-1">
          <h2 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-2"><Icon name="LayoutGrid" /> {t('categories')}</h2>
          <CategoryGrid categories={currentCategories} />
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
                {videos.map(video => <VideoCard key={video.id} video={video} onClick={() => onVideoClick(video)} />)}
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
        
        {/* Category Tabs */}
        <div className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide sticky top-16 z-20 py-2 -mx-4 px-4 md:mx-0 md:px-0 border-b border-white/5 bg-brand-bg/95 backdrop-blur-sm`}>
          {currentCategories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-none text-xs font-bold whitespace-nowrap transition border-b-2 ${activeCategory === cat ? 'border-brand-gold text-brand-gold' : 'border-transparent text-gray-400 hover:text-white'}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="relative z-10 space-y-8">
          <section>
            <h2 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-brand-gold">●</span> {t('recommended')}
            </h2>
            {loading ? (
               <div className="flex items-center justify-center h-64 text-brand-gold">
                 <Icon name="Loader2" size={48} className="animate-spin" />
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                {videos.map(video => <VideoCard key={video.id} video={video} onClick={() => onVideoClick(video)} />)}
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
                  {collection.videos.map(video => <VideoCard key={video.id} video={video} onClick={() => onVideoClick(video)} />)}
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

// --- APP ROOT ---

export default function App() {
  console.log('[App] Component mounting...');
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [userMode, setUserMode] = useState<UserMode>('General');
  const [isBossMode, setIsBossMode] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  // Navigation State
  const [currentView, setCurrentView] = useState<'home'|'models'|'categories'|'favorites'|'history'>('home');

  useEffect(() => {
    console.log('[App] Checking age verification...');
    const verified = localStorage.getItem('velvet_age_verified');
    console.log('[App] velvet_age_verified from localStorage:', verified);
    setIsVerified(verified === 'true');
    console.log('[App] isVerified set to:', verified === 'true');
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

  useEffect(() => {
    if (isVerified === false) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
  }, [isVerified]);

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
  const handlePanic = () => window.location.href = "https://www.google.com";

  // Handle Video Click (add to history)
  const handleVideoClick = (v: Video) => {
    VideoService.addToHistory(v);
    setCurrentVideo(v);
  };

  console.log('[App] Current isVerified state:', isVerified);

  if (isVerified === null) {
    console.log('[App] isVerified is null, showing loading spinner');
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30 animate-pulse">
          <span className="font-serif font-black text-2xl text-amber-500">V</span>
        </div>
      </div>
    );
  }

  console.log('[App] Rendering main app, isVerified:', isVerified);

  return (
    <LanguageProvider>
      <AuthProvider>
      <GeoBlock>
      <Router>
        <div className={`min-h-screen text-gray-200 font-sans selection:bg-brand-gold selection:text-black transition-colors duration-500 bg-brand-bg bg-grain`}>
          <BossMode isActive={isBossMode} onExit={() => setIsBossMode(false)} />
          {!isVerified && <AgeGate onVerify={handleVerification} />}
          
          {isLegalOpen && <LegalModal onClose={() => setIsLegalOpen(false)} />}
          {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}

          <div className={`transition-opacity duration-500 ${!isVerified ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
             <Navbar 
                onMenuClick={toggleSidebar} 
                onHomeClick={() => { setCurrentVideo(null); setCurrentView('home'); setSearchQuery(''); }} 
                onPanic={handlePanic}
                userMode={userMode}
                onModeChange={setUserMode}
                onBossMode={() => setIsBossMode(true)}
                onAuthClick={() => setIsAuthOpen(true)}
                onSearch={setSearchQuery}
             />
             
             <Sidebar 
               isOpen={isSidebarOpen} 
               currentView={currentView}
               onChangeView={(view) => { setCurrentView(view); setCurrentVideo(null); setSearchQuery(''); }}
             />

             <main className={`pt-16 transition-all duration-300 ${isSidebarOpen ? 'md:ml-60' : 'md:ml-20'}`}>
                {currentVideo ? (
                  <VideoPlayer 
                    video={currentVideo} 
                    onClose={() => setCurrentVideo(null)} 
                    onVideoChange={handleVideoClick}
                  />
                ) : (
                  <MainContent 
                    onVideoClick={handleVideoClick} 
                    userMode={userMode} 
                    currentView={currentView}
                    onOpenLegal={() => setIsLegalOpen(true)}
                    searchQuery={searchQuery}
                  />
                )}
             </main>
          </div>
        </div>
      </Router>
      </GeoBlock>
      </AuthProvider>
    </LanguageProvider>
  );
}