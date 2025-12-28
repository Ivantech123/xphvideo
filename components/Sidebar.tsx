import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionService, Subscription } from '../services/subscriptionService';
import { AdUnit } from './AdUnit';

type ViewType = 'home' | 'models' | 'categories' | 'favorites' | 'history' | 'admin';

interface SidebarProps {
  isOpen: boolean;
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
  onOpenLegal?: () => void;
  onCreatorClick?: (creator: any) => void;
  onSearch: (query: string) => void;
  searchQuery?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentView, onChangeView, onOpenLegal, onCreatorClick, onSearch, searchQuery = '' }) => {
  const { t } = useLanguage();
  const { user, isAdmin } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  
  useEffect(() => {
    if (user) {
      SubscriptionService.getSubscriptions().then(setSubscriptions);
    } else {
      setSubscriptions([]);
    }
  }, [user, isOpen]); // Refresh when sidebar opens or user changes

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
        </div>

        <div className="h-px bg-brand-border mx-3 my-2" />

        {/* Main Menu */}
        <div className="px-2 space-y-1">
          {MENU_ITEMS.map((item) => {
            let isActive = false;
            if (item.id === 'home') isActive = currentView === 'home' && !searchQuery;
            else if (item.id === 'trending') isActive = currentView === 'home' && searchQuery === 'trending';
            else if (item.id === 'new') isActive = currentView === 'home' && searchQuery === 'new';
            else if (item.id === 'shorts') isActive = currentView === 'shorts' || (currentView === 'home' && searchQuery === 'shorts');

            return (
            <button 
              key={item.id} 
              onClick={() => {
                // Map menu items to views/categories
                if (item.id === 'home') {
                    onChangeView('home');
                    onSearch(''); // Clear search on home
                } else if (item.id === 'trending') {
                    onChangeView('home');
                    onSearch('trending');
                } else if (item.id === 'new') {
                    onChangeView('home');
                    onSearch('new');
                } else if (item.id === 'shorts') {
                    onChangeView('shorts'); // Treat shorts as a separate view for TikTok style UI
                    onSearch('');
                }
              }} 
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-brand-surface transition ${isActive ? 'bg-brand-surface text-white' : 'text-gray-400'}`}
            >
              <Icon name={item.icon as any} size={22} className={isActive ? 'text-white' : 'text-gray-400'} />
              <span className={`text-sm font-medium ${!isOpen && 'md:hidden'}`}>{item.label}</span>
            </button>
            );
          })}
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

        {/* Ad Unit */}
        <div className="px-2 py-2">
           <AdUnit size="sidebar" className="w-full" label={t('ad')} />
        </div>

        <div className="h-px bg-brand-border mx-3 my-2" />

        {/* Subscriptions */}
        {isOpen && user && (
          <div className="px-4 py-2">
             <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">{t('subscriptions')}</h3>
             <div className="space-y-3">
                {subscriptions.length > 0 ? subscriptions.map(sub => (
                  <div 
                    key={sub.id} 
                    className="flex items-center gap-3 cursor-pointer hover:text-white text-gray-400 group"
                    onClick={() => {
                        if (onCreatorClick) {
                            onCreatorClick({
                                id: sub.creator_id,
                                name: sub.creator_name,
                                avatar: sub.creator_avatar || '',
                                verified: true,
                                tier: 'Standard'
                            });
                        }
                    }}
                  >
                    {sub.creator_avatar ? (
                      <img src={sub.creator_avatar} className="w-6 h-6 rounded-full object-cover border border-transparent group-hover:border-brand-gold transition-colors" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-700 border border-transparent group-hover:border-brand-gold transition-colors" />
                    )}
                    <span className="text-sm truncate">{sub.creator_name}</span>
                  </div>
                )) : (
                  <div className="text-xs text-gray-600 italic">No subscriptions yet</div>
                )}
             </div>
          </div>
        )}
      </div>
    </aside>
  );
};