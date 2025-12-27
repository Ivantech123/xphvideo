import React from 'react';
import { Icon } from './Icon';
import { AdUnit } from './AdUnit';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

type ViewType = 'home' | 'models' | 'categories' | 'favorites' | 'history' | 'admin';

interface SidebarProps {
  isOpen: boolean;
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
  onOpenCharts?: () => void;
  onOpenLegal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentView, onChangeView, onOpenCharts, onOpenLegal }) => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  
  const sidebarClass = isOpen 
    ? "w-60 translate-x-0" 
    : "w-0 -translate-x-full md:w-20 md:translate-x-0";

  const MENU_ITEMS = [
    { id: 'home', icon: 'Home', label: t('home') },
    { id: 'trending', icon: 'Flame', label: t('trending') },
    { id: 'new', icon: 'Video', label: t('new') },
    { id: 'shorts', icon: 'Zap', label: t('shorts') },
  ];

  const SECONDARY_ITEMS = [
    { id: 'categories', icon: 'LayoutGrid', label: t('categories') },
    { id: 'models', icon: 'Users', label: t('models') },
    { id: 'favorites', icon: 'Heart', label: t('favorites') },
    { id: 'history', icon: 'History', label: t('history') },
  ];

  if (isAdmin) {
    SECONDARY_ITEMS.push({ id: 'admin', icon: 'Shield', label: t('admin') });
  }

  const SUBSCRIPTIONS = ['Sweet Fox', 'Elena Visuals', 'Noir Collective', 'Eva Life'];

  return (
    <aside className={`fixed left-0 top-16 bottom-0 bg-brand-bg z-40 overflow-y-auto transition-all duration-300 border-r border-brand-border ${sidebarClass} scrollbar-hide`}>
      <div className="flex flex-col h-full">
        
        {/* High Value Items */}
        <div className="p-2 space-y-1">
          <button className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-lg bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 transition group`}>
             <div className="relative">
                <Icon name="Radio" size={22} className="text-brand-accent animate-pulse" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-brand-accent rounded-full animate-ping" />
             </div>
             <span className={`text-sm font-bold uppercase tracking-wide ${!isOpen && 'md:hidden'}`}>{t('live_cam')}</span>
          </button>
          
          <button 
             onClick={onOpenCharts}
             className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-lg text-yellow-300 hover:bg-white/5 transition group`}
          >
             <Icon name="Trophy" size={22} className="text-yellow-500" />
             <div className={`text-left ${!isOpen && 'md:hidden'}`}>
                <span className="block text-sm font-bold uppercase tracking-wide">{t('charts')}</span>
             </div>
          </button>
        </div>

        <div className="h-px bg-brand-border mx-3 my-2" />

        {/* Main Menu */}
        <div className="px-2 space-y-1">
          {MENU_ITEMS.map((item) => (
            <button 
              key={item.id} 
              onClick={() => onChangeView('home')} // For now, trending/new link to home w/ sort (mock)
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-brand-surface transition ${currentView === 'home' && item.id === 'home' ? 'bg-brand-surface text-white' : 'text-gray-400'}`}
            >
              <Icon name={item.icon as any} size={22} className={currentView === 'home' && item.id === 'home' ? 'text-white' : 'text-gray-400'} />
              <span className={`text-sm font-medium ${!isOpen && 'md:hidden'}`}>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="h-px bg-brand-border mx-3 my-2" />

        {/* Secondary Menu */}
        <div className="px-2 space-y-1">
          {SECONDARY_ITEMS.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button 
                key={item.id} 
                onClick={() => onChangeView(item.id as ViewType)}
                className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-brand-surface transition ${isActive ? 'bg-brand-surface text-white' : 'text-gray-400'}`}
              >
                <Icon name={item.icon as any} size={22} className={isActive ? 'text-brand-gold' : ''} />
                <span className={`text-sm font-medium ${!isOpen && 'md:hidden'}`}>{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className="h-px bg-brand-border mx-3 my-2" />

        {/* Subscriptions */}
        {isOpen && (
          <div className="px-4 py-2">
             <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">{t('subscriptions')}</h3>
             <div className="space-y-3">
                {SUBSCRIPTIONS.map(sub => (
                  <div key={sub} className="flex items-center gap-3 cursor-pointer hover:text-white text-gray-400 group">
                    <div className="w-6 h-6 rounded-full bg-gray-700 border border-transparent group-hover:border-brand-gold transition-colors" />
                    <span className="text-sm truncate">{sub}</span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Sidebar Ad - Bottom */}
        <div className="mt-auto px-4 pb-6 pt-4">
           {isOpen ? (
             <AdUnit size="square" label={t('ad')} className="h-48" />
           ) : (
             <div className="hidden md:flex w-full aspect-square bg-brand-surface rounded items-center justify-center text-[10px] text-gray-600 border border-white/5">
                {t('ad_label')}
             </div>
           )}
        </div>
      </div>
    </aside>
  );
};