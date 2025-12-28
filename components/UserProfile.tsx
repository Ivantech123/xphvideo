import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionService, Subscription } from '../services/subscriptionService';
import { VideoService } from '../services/videoService';
import { Video } from '../types';
import { supabase } from '../services/supabase';
import { TicketService, SupportTicket } from '../services/ticketService';

interface UserProfileProps {
  onClose: () => void;
  onVideoClick: (video: Video) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose, onVideoClick }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'favorites' | 'history' | 'subscriptions' | 'tickets' | 'settings'>('favorites');
  const [favorites, setFavorites] = useState<Video[]>([]);
  const [history, setHistory] = useState<Video[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  
  // Settings state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load user data
    setFavorites(VideoService.getFavorites());
    setHistory(VideoService.getHistory());
    SubscriptionService.getSubscriptions().then(setSubscriptions);
  }, []);

  const ticketsSeenKey = user?.id ? `velvet_tickets_last_seen_${user.id}` : null;

  const markTicketsSeen = () => {
    if (!ticketsSeenKey) return;
    localStorage.setItem(ticketsSeenKey, String(Date.now()));
    window.dispatchEvent(new Event('velvet_tickets_seen'));
  };

  const loadTickets = async () => {
    if (!user) return;
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const { data, error } = await TicketService.listMine({ limit: 200 });
      if (error) {
        setTicketsError(error);
        setTickets([]);
      } else {
        setTickets(data);
      }
    } catch (e: any) {
      setTicketsError(e?.message || 'Failed to load tickets');
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'tickets') return;
    loadTickets();
    markTicketsSeen();
  }, [activeTab, user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = TicketService.subscribeMine(user.id, () => {
      if (activeTab === 'tickets') {
        loadTickets();
        markTicketsSeen();
      }
    });
    return () => {
      try { ch?.unsubscribe(); } catch {}
    };
  }, [user?.id, activeTab]);

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setLoading(true);
    setSettingsMessage(null);

    if (supabase) {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) {
            setSettingsMessage({ type: 'error', text: error.message });
        } else {
            setSettingsMessage({ type: 'success', text: 'Проверьте новую почту для подтверждения смены.' });
            setNewEmail('');
        }
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    setLoading(true);
    setSettingsMessage(null);

    if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            setSettingsMessage({ type: 'error', text: error.message });
        } else {
            setSettingsMessage({ type: 'success', text: 'Пароль успешно обновлен.' });
            setNewPassword('');
        }
    }
    setLoading(false);
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
        <div className="flex border-b border-white/10 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'favorites' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
          >
            <Icon name="Heart" size={16} className="inline mr-2" />
            Избранное
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'history' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
          >
            <Icon name="Clock" size={16} className="inline mr-2" />
            История
          </button>
          <button 
            onClick={() => setActiveTab('subscriptions')}
            className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'subscriptions' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
          >
            <Icon name="Users" size={16} className="inline mr-2" />
            Подписки
          </button>
          <button 
            onClick={() => setActiveTab('tickets')}
            className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'tickets' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
          >
            <Icon name="Inbox" size={16} className="inline mr-2" />
            Тикеты
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'settings' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
          >
            <Icon name="Settings" size={16} className="inline mr-2" />
            Настройки
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

          {activeTab === 'tickets' && (
            <div className="space-y-3">
              {ticketsLoading ? (
                <div className="text-center py-12 text-gray-500">
                  <Icon name="Loader2" size={48} className="mx-auto mb-4 opacity-60 animate-spin" />
                  Загрузка тикетов...
                </div>
              ) : ticketsError ? (
                <div className="p-4 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/30">
                  {ticketsError}
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Icon name="Inbox" size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Тикетов пока нет</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">Всего: {tickets.length}</div>
                    <button onClick={loadTickets} className="text-xs text-gray-400 hover:text-white">Обновить</button>
                  </div>
                  <div className="space-y-2">
                    {tickets.map(tk => (
                      <button
                        key={tk.id}
                        onClick={() => setActiveTicket(tk)}
                        className="w-full text-left p-3 rounded-lg border border-white/10 bg-black/20 hover:bg-white/5 transition"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-white font-bold text-sm line-clamp-1">{tk.subject || '(без темы)'}</div>
                            <div className="text-xs text-gray-500 line-clamp-1">{tk.video_title || tk.video_id || ''}</div>
                          </div>
                          <span className={`text-[11px] px-2 py-1 rounded whitespace-nowrap ${
                            tk.status === 'open' ? 'bg-red-500/10 text-red-300 border border-red-500/20' :
                            tk.status === 'in_progress' ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20' :
                            tk.status === 'resolved' ? 'bg-green-500/10 text-green-300 border border-green-500/20' :
                            'bg-white/5 text-gray-300 border border-white/10'
                          }`}>{tk.status}</span>
                        </div>
                        <div className="text-[11px] text-gray-600 mt-2">Обновлено: {new Date(tk.updated_at).toLocaleString('ru')}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeTicket && (
                <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="w-full max-w-2xl bg-brand-surface border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/10 flex items-center justify-between">
                      <div className="text-white font-bold flex items-center gap-2">
                        <Icon name="Inbox" size={18} className="text-brand-gold" />
                        Тикет
                      </div>
                      <button onClick={() => setActiveTicket(null)} className="text-gray-400 hover:text-white">
                        <Icon name="X" size={20} />
                      </button>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-white">{activeTicket.subject || '(без темы)'}</div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          activeTicket.status === 'open' ? 'bg-red-900/30 text-red-200' :
                          activeTicket.status === 'in_progress' ? 'bg-yellow-900/30 text-yellow-200' :
                          activeTicket.status === 'resolved' ? 'bg-green-900/30 text-green-200' :
                          'bg-white/10 text-gray-200'
                        }`}>{activeTicket.status}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Видео: {activeTicket.video_title || activeTicket.video_id || '—'}
                      </div>
                      <div className="text-sm text-gray-200 whitespace-pre-wrap">{activeTicket.message || ''}</div>
                      {activeTicket.admin_notes && (
                        <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Ответ поддержки</div>
                          <div className="text-sm text-gray-200 whitespace-pre-wrap">{activeTicket.admin_notes}</div>
                        </div>
                      )}
                      <div className="text-[11px] text-gray-600">Создано: {new Date(activeTicket.created_at).toLocaleString('ru')}</div>
                      <div className="text-[11px] text-gray-600">Обновлено: {new Date(activeTicket.updated_at).toLocaleString('ru')}</div>
                    </div>
                    <div className="p-5 border-t border-white/10 flex justify-end">
                      <button onClick={() => setActiveTicket(null)} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition text-gray-200">Закрыть</button>
                    </div>
                  </div>
                </div>
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

          {activeTab === 'settings' && (
            <div className="space-y-8 max-w-md mx-auto py-4">
              {settingsMessage && (
                <div className={`p-4 rounded-lg text-sm ${settingsMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                  {settingsMessage.text}
                </div>
              )}

              <form onSubmit={handleUpdateEmail} className="space-y-4">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Icon name="Mail" size={20} />
                  Смена Email
                </h3>
                <div className="space-y-2">
                  <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Новый email"
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-brand-gold outline-none transition"
                  />
                  <button 
                    type="submit" 
                    disabled={loading || !newEmail}
                    className="px-4 py-2 bg-white/10 hover:bg-brand-gold hover:text-black text-white rounded font-medium transition disabled:opacity-50 text-sm"
                  >
                    Обновить Email
                  </button>
                </div>
              </form>

              <div className="border-t border-white/10 pt-8">
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <Icon name="Lock" size={20} />
                    Смена Пароля
                  </h3>
                  <div className="space-y-2">
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Новый пароль"
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-brand-gold outline-none transition"
                    />
                    <button 
                      type="submit" 
                      disabled={loading || !newPassword}
                      className="px-4 py-2 bg-white/10 hover:bg-brand-gold hover:text-black text-white rounded font-medium transition disabled:opacity-50 text-sm"
                    >
                      Обновить Пароль
                    </button>
                  </div>
                </form>
              </div>
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
