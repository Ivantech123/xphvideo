import React, { useMemo, useState, useEffect } from 'react';
import { Video, Creator } from '../types';
import { VideoService } from '../services/videoService';
import { AdminService } from '../services/adminService';
import { Icon } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { VideoEditorModal } from './VideoEditorModal';
import { RecommendationService } from '../services/recommendationService';
import { TicketService, SupportTicket, TicketStatus } from '../services/ticketService';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseAnonKey } from '../services/supabase';

interface AdminDashboardProps {
  onExit: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit }) => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'creators' | 'tickets'>('videos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Pornhub' | 'Eporner' | 'XVideos' | 'Local'>('All');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | 'all'>('open');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [ticketNotes, setTicketNotes] = useState('');
  const [ticketSaving, setTicketSaving] = useState(false);

  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [catalogSyncResult, setCatalogSyncResult] = useState<any>(null);
  const [catalogSyncError, setCatalogSyncError] = useState<string | null>(null);

  const [catalogStatsLoading, setCatalogStatsLoading] = useState(false);
  const [catalogStats, setCatalogStats] = useState<any>(null);
  const [catalogStatsError, setCatalogStatsError] = useState<string | null>(null);
  
  const [editingVideo, setEditingVideo] = useState<Video | null | undefined>(undefined); // undefined = closed, null = new, object = edit

  const loadData = async (signal?: AbortSignal) => {
    if (import.meta.env.DEV) console.log('[AdminDashboard] Loading data...');
    setLoading(true);
    try {
      const [vids, creats] = await Promise.all([
        VideoService.getVideos('General', searchQuery || 'popular', 1, sourceFilter, 'trending', 'All', signal),
        VideoService.getCreators(signal)
      ]);
      if (signal?.aborted) return;
      if (import.meta.env.DEV) console.log('[AdminDashboard] Data loaded:', { videos: vids.length, creators: creats.length });
      setVideos(vids);
      setCreators(creats);
    } catch (e) {
      if (signal?.aborted) return;
      console.error('[AdminDashboard] Failed to load data:', e);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const loadCatalogStats = async () => {
    setCatalogStatsLoading(true);
    setCatalogStatsError(null);
    try {
      const { data, error } = await supabase.rpc('get_catalog_stats');
      if (error) setCatalogStatsError(error.message);
      else setCatalogStats(data);
    } catch (e: any) {
      setCatalogStatsError(e?.message || 'Failed to load catalog stats');
    } finally {
      setCatalogStatsLoading(false);
    }
  };

  useEffect(() => {
    if (!settingsOpen) return;
    loadCatalogStats();
  }, [settingsOpen]);

  const handleCatalogSync = async () => {
    setCatalogSyncing(true);
    setCatalogSyncError(null);
    setCatalogSyncResult(null);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/supabase/functions/v1/catalog-sync', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ pages: 1, per_page: 24, sources: ['Eporner', 'Pornhub'] }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`catalog-sync failed: ${res.status} ${txt}`);
      }
      const data = await res.json().catch(() => ({}));
      setCatalogSyncResult(data);
    } catch (e: any) {
      setCatalogSyncError(e?.message || 'Failed to sync catalog');
    } finally {
      setCatalogSyncing(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [sourceFilter]);

  const loadTickets = async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const { data, error } = await TicketService.list({ status: ticketStatus, q: searchQuery, limit: 200 });
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
  }, [activeTab, ticketStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'tickets') {
      loadTickets();
      return;
    }
    const controller = new AbortController();
    loadData(controller.signal);
  };

  const openTicket = (t: SupportTicket) => {
    setActiveTicket(t);
    setTicketNotes(t.admin_notes || '');
  };

  const updateTicketStatus = async (id: string, status: TicketStatus) => {
    setTicketSaving(true);
    try {
      const patch: any = { status };
      if (status === 'resolved') patch.resolved_at = new Date().toISOString();
      const { data, error } = await TicketService.update(id, patch);
      if (error) {
        setTicketsError(error);
      } else if (data) {
        setTickets(prev => prev.map(x => (x.id === id ? data : x)));
        setActiveTicket(prev => (prev && prev.id === id ? data : prev));
      }
    } finally {
      setTicketSaving(false);
    }
  };

  const saveTicketNotes = async () => {
    if (!activeTicket) return;
    setTicketSaving(true);
    try {
      const { data, error } = await TicketService.update(activeTicket.id, { admin_notes: ticketNotes });
      if (error) {
        setTicketsError(error);
      } else if (data) {
        setTickets(prev => prev.map(x => (x.id === data.id ? data : x)));
        setActiveTicket(data);
      }
    } finally {
      setTicketSaving(false);
    }
  };

  const deleteTicket = async (id: string) => {
    if (!window.confirm('Delete this ticket?')) return;
    setTicketSaving(true);
    try {
      const { error } = await TicketService.remove(id);
      if (error) {
        setTicketsError(error);
        return;
      }
      setTickets(prev => prev.filter(x => x.id !== id));
      setActiveTicket(prev => (prev?.id === id ? null : prev));
    } finally {
      setTicketSaving(false);
    }
  };

  const stats = useMemo(() => {
    const bySource: Record<string, number> = {};
    for (const v of videos) {
      const s = v.source || 'Unknown';
      bySource[s] = (bySource[s] || 0) + 1;
    }
    const manualCount = AdminService.getManualVideos().length;
    const blockedCount = AdminService.getBlockedIds().length;
    const editsCount = Object.keys(AdminService.getEdits()).length;
    const favoritesCount = VideoService.getFavorites().length;
    const historyCount = VideoService.getHistory().length;

    const sourcesLabel = [
      bySource['Pornhub'] ? 'PH' : null,
      bySource['Eporner'] ? 'EP' : null,
      bySource['XVideos'] ? 'XV' : null,
      bySource['Local'] ? 'LOCAL' : null
    ].filter(Boolean).join(' • ') || '—';

    return {
      bySource,
      manualCount,
      blockedCount,
      editsCount,
      favoritesCount,
      historyCount,
      sourcesLabel
    };
  }, [videos]);

  const handleClearRecommendations = () => {
    if (!window.confirm('Clear recommendation profile (watch history for recommendations)?')) return;
    RecommendationService.clearBehavior();
    setSettingsOpen(false);
  };

  const handleClearSearchHistory = () => {
    if (!window.confirm('Clear search history?')) return;
    localStorage.removeItem('velvet_search_history');
  };

  const handleClearFavorites = () => {
    if (!window.confirm('Clear favorites?')) return;
    localStorage.setItem('velvet_favorites', JSON.stringify([]));
  };

  const handleClearHistory = () => {
    if (!window.confirm('Clear watch history?')) return;
    localStorage.setItem('velvet_history', JSON.stringify([]));
  };

  const handleClearAdminData = () => {
    if (!window.confirm('Clear admin data (blocked list + edits + manual videos)?')) return;
    AdminService.clearBlocked();
    AdminService.clearEdits();
    AdminService.clearManualVideos();
    setVideos([]);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to block/delete this video?')) {
        AdminService.blockVideo(id);
        AdminService.deleteManualVideo(id); // Attempt to delete if manual
        setVideos(prev => prev.filter(v => v.id !== id));
    }
  };

  const handleSaveVideo = (video: Video) => {
    if (editingVideo === null) {
      // Add New
      AdminService.addManualVideo(video);
      setVideos(prev => [video, ...prev]);
    } else {
      // Edit Existing
      AdminService.updateManualVideo(video);
      // Also save as edit override if it was an external video
      if (!video.id.startsWith('manual_')) {
         AdminService.saveVideoEdit(video.id, video);
      }
      
      setVideos(prev => prev.map(v => v.id === video.id ? video : v));
    }
    setEditingVideo(undefined);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-gray-200 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Icon name="Shield" className="text-brand-gold" />
              {t('admin_dashboard')}
            </h1>
            <p className="text-gray-500 mt-1">{t('content_management')}</p>
          </div>
          <div className="flex gap-3">
             <button onClick={onExit} className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg hover:bg-white/10 transition text-gray-300">
               Exit
             </button>
             <button onClick={() => setSettingsOpen(true)} className="bg-brand-surface border border-white/10 px-4 py-2 rounded-lg hover:border-brand-gold transition flex items-center gap-2">
               <Icon name="Settings" size={18} /> {t('settings')}
             </button>
             <button onClick={() => setEditingVideo(null)} className="bg-brand-gold text-black px-4 py-2 rounded-lg font-bold hover:bg-yellow-500 transition flex items-center gap-2">
               <Icon name="Plus" size={18} /> {t('add_new')}
             </button>
          </div>
        </header>

        {settingsOpen && (
          <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-brand-surface border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Icon name="Settings" size={18} className="text-brand-gold" />
                  {t('settings')}
                </div>
                <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-white">
                  <Icon name="X" size={20} />
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Stats</div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div>Manual videos: <span className="text-white font-mono">{stats.manualCount}</span></div>
                    <div>Blocked IDs: <span className="text-white font-mono">{stats.blockedCount}</span></div>
                    <div>Edits: <span className="text-white font-mono">{stats.editsCount}</span></div>
                    <div>Favorites: <span className="text-white font-mono">{stats.favoritesCount}</span></div>
                    <div>History: <span className="text-white font-mono">{stats.historyCount}</span></div>
                  </div>
                </div>

                <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Catalog</div>
                    <button onClick={loadCatalogStats} disabled={catalogStatsLoading} className="text-xs text-gray-400 hover:text-white disabled:opacity-50">
                      {catalogStatsLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  {catalogStatsError ? (
                    <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/30 rounded-lg p-2">{catalogStatsError}</div>
                  ) : (
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>Rows (est): <span className="text-white font-mono">{catalogStats?.estimated_rows ?? '-'}</span></div>
                      <div>Rows (exact): <span className="text-white font-mono">{catalogStats?.exact_rows ?? '-'}</span></div>
                      <div>Updated 24h: <span className="text-white font-mono">{catalogStats?.updated_last_24h ?? '-'}</span></div>
                      <div>Newest: <span className="text-white font-mono">{catalogStats?.newest_updated_at ? new Date(catalogStats.newest_updated_at).toLocaleString() : '-'}</span></div>
                      <div>Oldest: <span className="text-white font-mono">{catalogStats?.oldest_updated_at ? new Date(catalogStats.oldest_updated_at).toLocaleString() : '-'}</span></div>
                      <div className="pt-2 text-xs text-gray-500">By source: <span className="text-gray-300 font-mono">{catalogStats?.by_source ? JSON.stringify(catalogStats.by_source) : '{}'}</span></div>
                      <div className="pt-2 text-xs text-gray-500">Last sync: <span className="text-gray-300 font-mono">{catalogStats?.last_run && catalogStats.last_run !== null ? `${catalogStats.last_run.status} / upserted ${catalogStats.last_run.upserted}` : '-'}</span></div>
                    </div>
                  )}
                </div>

                <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Actions</div>
                  <div className="flex flex-col gap-2">
                    <button onClick={handleCatalogSync} disabled={catalogSyncing} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition disabled:opacity-50">
                      {catalogSyncing ? 'Syncing catalog...' : 'Sync catalog (index search)'}
                    </button>
                    {catalogSyncError && (
                      <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/30 rounded-lg p-2">
                        {catalogSyncError}
                      </div>
                    )}
                    {catalogSyncResult && (
                      <div className="text-xs text-gray-300 bg-black/30 border border-white/10 rounded-lg p-2">
                        Upserted: <span className="text-white font-mono">{catalogSyncResult.upserted ?? '-'}</span> | 
                        Fetched: <span className="text-white font-mono">{catalogSyncResult.fetched ?? '-'}</span> | 
                        Errors: <span className="text-white font-mono">{(catalogSyncResult.errors || []).length}</span>
                      </div>
                    )}
                    <button onClick={handleClearRecommendations} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition">Clear recommendations profile</button>
                    <button onClick={handleClearSearchHistory} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition">Clear search history</button>
                    <button onClick={handleClearFavorites} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition">Clear favorites</button>
                    <button onClick={handleClearHistory} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-white/10 transition">Clear watch history</button>
                    <button onClick={handleClearAdminData} className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-200 hover:bg-red-900/30 transition">Clear admin data</button>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-white/10 flex justify-end gap-3">
                <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition text-gray-200">Close</button>
              </div>
            </div>
          </div>
        )}

        {editingVideo !== undefined && (
          <VideoEditorModal 
            video={editingVideo} 
            onSave={handleSaveVideo} 
            onClose={() => setEditingVideo(undefined)} 
          />
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t('fetched_videos')}</div>
              <div className="text-2xl font-mono text-white">{videos.length}</div>
           </div>
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t('active_creators')}</div>
              <div className="text-2xl font-mono text-white">{creators.length}</div>
           </div>
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t('connected_sources')}</div>
              <div className="text-lg font-bold text-brand-gold mt-1">{stats.sourcesLabel}</div>
           </div>
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Manual</div>
              <div className="text-2xl font-mono text-white">{stats.manualCount}</div>
           </div>
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Blocked</div>
              <div className="text-2xl font-mono text-white">{stats.blockedCount}</div>
           </div>
           <div className="bg-brand-surface p-4 rounded-xl border border-white/5">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t('system_status')}</div>
              <div className="text-2xl font-bold text-green-500 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> {t('online')}</div>
           </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-white/10 mb-6">
           <button 
             onClick={() => setActiveTab('videos')}
             className={`pb-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'videos' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
           >
             {t('videos')}
           </button>
           <button 
             onClick={() => setActiveTab('creators')}
             className={`pb-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'creators' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
           >
             {t('creators')}
           </button>
           <button 
             onClick={() => setActiveTab('tickets')}
             className={`pb-3 text-sm font-bold uppercase tracking-wider transition ${activeTab === 'tickets' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-gray-500 hover:text-white'}`}
           >
             Tickets
           </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
           <form onSubmit={handleSearch} className="flex-1 relative">
              <Icon name="Search" className="absolute left-3 top-3 text-gray-500" size={18} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'tickets' ? 'Search tickets...' : t('search_content')} 
                className="w-full bg-brand-surface border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-brand-gold focus:outline-none"
              />
           </form>
           {activeTab === 'tickets' ? (
             <select value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value as any)} className="bg-brand-surface border border-white/10 rounded-lg px-4 py-2 text-gray-300 focus:border-brand-gold outline-none">
               <option value="all">All</option>
               <option value="open">Open</option>
               <option value="in_progress">In progress</option>
               <option value="resolved">Resolved</option>
               <option value="closed">Closed</option>
             </select>
           ) : (
             <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as any)} className="bg-brand-surface border border-white/10 rounded-lg px-4 py-2 text-gray-300 focus:border-brand-gold outline-none">
                <option value="All">{t('all_sources')}</option>
                <option value="Pornhub">Pornhub</option>
                <option value="Eporner">Eporner</option>
                <option value="XVideos">XVideos</option>
                <option value="Local">Local / Manual</option>
             </select>
           )}
        </div>

        {/* Content Table */}
        <div className="bg-brand-surface border border-white/5 rounded-xl overflow-hidden">
           {activeTab === 'tickets' ? (
             <>
               {!isAdmin ? (
                 <div className="p-10 text-center text-gray-500">Admin only</div>
               ) : ticketsLoading ? (
                 <div className="p-12 text-center text-gray-500">
                   <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
                   {t('loading')}
                 </div>
               ) : (
                 <div className="overflow-x-auto">
                   {ticketsError && (
                     <div className="p-4 text-sm text-red-200 bg-red-900/20 border-b border-red-500/20">{ticketsError}</div>
                   )}
                   <table className="w-full text-left">
                     <thead className="bg-black/20 text-gray-500 text-xs uppercase">
                       <tr>
                         <th className="p-4">Status</th>
                         <th className="p-4">Type</th>
                         <th className="p-4">Subject</th>
                         <th className="p-4">Video</th>
                         <th className="p-4">User</th>
                         <th className="p-4">Created</th>
                         <th className="p-4">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {tickets.map(tk => (
                         <tr key={tk.id} className="hover:bg-white/5 transition">
                           <td className="p-4">
                             <span className={`text-xs px-2 py-1 rounded ${
                               tk.status === 'open' ? 'bg-red-900/30 text-red-200' :
                               tk.status === 'in_progress' ? 'bg-yellow-900/30 text-yellow-200' :
                               tk.status === 'resolved' ? 'bg-green-900/30 text-green-200' :
                               'bg-white/10 text-gray-200'
                             }`}>{tk.status}</span>
                           </td>
                           <td className="p-4 text-sm text-gray-300">{tk.type}</td>
                           <td className="p-4">
                             <div className="font-bold text-white line-clamp-1">{tk.subject || '(no subject)'}</div>
                             <div className="text-xs text-gray-500 line-clamp-1">{tk.message || ''}</div>
                           </td>
                           <td className="p-4 text-sm text-gray-300">{tk.video_title || tk.video_id || '—'}</td>
                           <td className="p-4 text-sm text-gray-400">{tk.user_email || tk.user_id || '—'}</td>
                           <td className="p-4 text-sm text-gray-400">{new Date(tk.created_at).toLocaleString()}</td>
                           <td className="p-4">
                             <button onClick={() => openTicket(tk)} className="text-gray-400 hover:text-white mr-2"><Icon name="Eye" size={16} /></button>
                             <button onClick={() => deleteTicket(tk.id)} className="text-gray-400 hover:text-red-500"><Icon name="Trash" size={16} /></button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
             </>
           ) : loading ? (
             <div className="p-12 text-center text-gray-500">
               <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
               {t('loading')}
             </div>
           ) : activeTab === 'videos' ? (
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead className="bg-black/20 text-gray-500 text-xs uppercase">
                   <tr>
                     <th className="p-4">{t('thumbnail')}</th>
                     <th className="p-4">{t('title')}</th>
                     <th className="p-4">{t('source')}</th>
                     <th className="p-4">{t('duration')}</th>
                     <th className="p-4">{t('views')}</th>
                     <th className="p-4">{t('actions')}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                   {videos.map(video => (
                     <tr key={video.id} className="hover:bg-white/5 transition">
                       <td className="p-4 w-24">
                         <div className="w-16 h-10 rounded bg-gray-800 overflow-hidden">
                           <img src={video.thumbnail} className="w-full h-full object-cover" />
                         </div>
                       </td>
                       <td className="p-4">
                         <div className="font-bold text-white line-clamp-1">{video.title}</div>
                         <div className="text-xs text-gray-500">{video.tags.slice(0, 3).map(t => t.label).join(', ')}</div>
                       </td>
                       <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded ${
                          video.source === 'Pornhub' ? 'bg-orange-900/30 text-orange-400' : 
                          video.source === 'Local' ? 'bg-green-900/30 text-green-400' :
                          'bg-red-900/30 text-red-400'
                        }`}>
                          {video.source || t('external_source')}
                        </span>
                      </td>
                       <td className="p-4 text-sm font-mono text-gray-400">
                         {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                       </td>
                       <td className="p-4 text-sm text-gray-400">
                         {video.views.toLocaleString()}
                       </td>
                       <td className="p-4">
                         <button onClick={() => setEditingVideo(video)} className="text-gray-400 hover:text-white mr-2"><Icon name="Edit" size={16} /></button>
                         <button onClick={() => handleDelete(video.id)} className="text-gray-400 hover:text-red-500"><Icon name="Trash" size={16} /></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           ) : (
             <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {creators.map(creator => (
                  <div key={creator.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-black/20">
                     <img src={creator.avatar} className="w-10 h-10 rounded-full object-cover" />
                     <div>
                        <div className="font-bold text-sm text-white">{creator.name}</div>
                        <div className="text-xs text-gray-500">{creator.tier === 'Exclusive' ? t('exclusive_tier') : creator.tier === 'Premium' ? t('premium_tag') : t('standard_tier')}</div>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        {activeTicket && (
          <div className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-brand-surface border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="text-white font-bold flex items-center gap-2">
                  <Icon name="Inbox" size={18} className="text-brand-gold" />
                  Ticket
                </div>
                <button onClick={() => setActiveTicket(null)} className="text-gray-400 hover:text-white">
                  <Icon name="X" size={20} />
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500">Meta</div>
                  <div className="text-sm text-gray-200"><span className="text-gray-500">Status:</span> {activeTicket.status}</div>
                  <div className="text-sm text-gray-200"><span className="text-gray-500">Type:</span> {activeTicket.type}</div>
                  <div className="text-sm text-gray-200"><span className="text-gray-500">User:</span> {activeTicket.user_email || activeTicket.user_id || '—'}</div>
                  <div className="text-sm text-gray-200"><span className="text-gray-500">Created:</span> {new Date(activeTicket.created_at).toLocaleString()}</div>
                  <div className="text-sm text-gray-200"><span className="text-gray-500">Page:</span> {activeTicket.page_url || '—'}</div>
                </div>

                <div className="bg-black/20 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500">Video</div>
                  <div className="text-sm text-gray-200">{activeTicket.video_title || '—'}</div>
                  <div className="text-xs text-gray-500">{activeTicket.video_id || ''}</div>
                  <div className="text-xs text-gray-500">{activeTicket.video_source || ''}</div>
                  <div className="text-xs text-gray-500">{activeTicket.video_creator_name || ''}</div>
                </div>

                <div className="md:col-span-2 bg-black/20 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500">Content</div>
                  <div className="text-lg font-bold text-white">{activeTicket.subject || '(no subject)'}</div>
                  <div className="text-sm text-gray-200 whitespace-pre-wrap">{activeTicket.message || ''}</div>
                </div>

                <div className="md:col-span-2 bg-black/20 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Admin notes</div>
                    <div className="flex items-center gap-2">
                      <select
                        value={activeTicket.status}
                        onChange={(e) => updateTicketStatus(activeTicket.id, e.target.value as TicketStatus)}
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:border-brand-gold outline-none text-sm"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button onClick={() => deleteTicket(activeTicket.id)} className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-200 hover:bg-red-900/30 transition">Delete</button>
                    </div>
                  </div>
                  <textarea
                    value={ticketNotes}
                    onChange={(e) => setTicketNotes(e.target.value)}
                    className="w-full min-h-[120px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:border-brand-gold outline-none"
                    placeholder="Internal notes..."
                  />
                  <div className="flex justify-end">
                    <button
                      disabled={ticketSaving}
                      onClick={saveTicketNotes}
                      className="px-4 py-2 rounded-lg bg-brand-gold text-black font-bold hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {ticketSaving ? 'Saving...' : 'Save notes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
