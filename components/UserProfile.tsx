import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionService, Subscription } from '../services/subscriptionService';
import { VideoService } from '../services/videoService';
import { Video } from '../types';

interface UserProfileProps {
  onClose: () => void;
  onVideoClick: (video: Video) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose, onVideoClick }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'favorites' | 'history' | 'subscriptions'>('favorites');
  const [favorites, setFavorites] = useState<Video[]>([]);
  const [history, setHistory] = useState<Video[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    // Load user data
    setFavorites(VideoService.getFavorites());
    setHistory(VideoService.getHistory());
    SubscriptionService.getSubscriptions().then(setSubscriptions);
  }, []);

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const clearHistory = () => {
    localStorage.removeItem('velvet_history');
    setHistory([]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-brand-surface w-full max-w-2xl max-h-[90vh] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-brand-gold/20 rounded-full flex items-center justify-center">
              <Icon name="User" size={32} className="text-brand-gold" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{user?.email?.split('@')[0] || 'User'}</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition p-2">
            <Icon name="X" size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'favorites' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
          >
            <Icon name="Heart" size={16} className="inline mr-2" />
            Избранное ({favorites.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'history' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
          >
            <Icon name="Clock" size={16} className="inline mr-2" />
            История ({history.length})
          </button>
          <button 
            onClick={() => setActiveTab('subscriptions')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'subscriptions' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
          >
            <Icon name="Users" size={16} className="inline mr-2" />
            Подписки ({subscriptions.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'favorites' && (
            <div className="space-y-2">
              {favorites.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Icon name="Heart" size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Нет избранных видео</p>
                </div>
              ) : (
                favorites.map(video => (
                  <div 
                    key={video.id} 
                    onClick={() => { onVideoClick(video); onClose(); }}
                    className="flex gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition"
                  >
                    <img src={video.thumbnail} className="w-32 h-20 object-cover rounded" alt="" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-sm font-medium line-clamp-2">{video.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">{formatTime(video.duration)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {history.length > 0 && (
                <button 
                  onClick={clearHistory}
                  className="text-xs text-red-400 hover:text-red-300 mb-4"
                >
                  Очистить историю
                </button>
              )}
              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Icon name="Clock" size={48} className="mx-auto mb-4 opacity-30" />
                  <p>История просмотров пуста</p>
                </div>
              ) : (
                history.map(video => (
                  <div 
                    key={video.id} 
                    onClick={() => { onVideoClick(video); onClose(); }}
                    className="flex gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition"
                  >
                    <img src={video.thumbnail} className="w-32 h-20 object-cover rounded" alt="" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-sm font-medium line-clamp-2">{video.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">{formatTime(video.duration)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="space-y-2">
              {subscriptions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Icon name="Users" size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Нет подписок</p>
                </div>
              ) : (
                subscriptions.map(sub => (
                  <div 
                    key={sub.id} 
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition"
                  >
                    <img 
                      src={sub.creator_avatar || 'https://via.placeholder.com/40'} 
                      className="w-12 h-12 rounded-full object-cover" 
                      alt="" 
                    />
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{sub.creator_name}</h4>
                      <p className="text-xs text-gray-500">Подписка с {new Date(sub.created_at).toLocaleDateString('ru')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-3 rounded-lg font-bold transition"
          >
            <Icon name="LogOut" size={18} />
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
};
