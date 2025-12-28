import { supabase } from './supabase';
import type { Video } from '../types';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketType = 'report' | 'bug' | 'feedback' | 'other';

export interface SupportTicket {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  user_email: string | null;
  status: TicketStatus;
  type: TicketType;
  subject: string | null;
  message: string | null;
  video_id: string | null;
  video_title: string | null;
  video_source: string | null;
  video_creator_id: string | null;
  video_creator_name: string | null;
  page_url: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
}

export interface CreateTicketInput {
  type: TicketType;
  subject?: string;
  message?: string;
  pageUrl?: string;
  video?: Video;
}

const toVideoPayload = (video?: Video) => {
  if (!video) return {};
  return {
    video_id: video.id,
    video_title: video.title,
    video_source: video.source || null,
    video_creator_id: video.creator?.id || null,
    video_creator_name: video.creator?.name || null
  };
};

export const TicketService = {
  async create(input: CreateTicketInput): Promise<{ data: SupportTicket | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Supabase not initialized' };

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return { data: null, error: 'User not logged in' };

    const payload: any = {
      user_id: user.id,
      user_email: user.email || null,
      status: 'open',
      type: input.type,
      subject: input.subject || null,
      message: input.message || null,
      page_url: input.pageUrl || window.location.href,
      ...toVideoPayload(input.video)
    };

    const { data, error } = await supabase
      .from('support_tickets')
      .insert(payload)
      .select('*')
      .single();

    if (error) return { data: null, error: error.message };

    // Best-effort email notification (Edge Function)
    try {
      await supabase.functions.invoke('ticket-notify', {
        body: { event: 'created', ticketId: (data as any)?.id }
      });
    } catch {}
    return { data: data as SupportTicket, error: null };
  },

  async list(params?: {
    status?: TicketStatus | 'all';
    q?: string;
    limit?: number;
  }): Promise<{ data: SupportTicket[]; error: string | null }> {
    if (!supabase) return { data: [], error: 'Supabase not initialized' };

    const limit = params?.limit ?? 100;
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (params?.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    // Basic search (subject/message/video_title/user_email)
    if (params?.q && params.q.trim()) {
      const q = params.q.trim().replace(/%/g, '');
      query = query.or(
        `subject.ilike.%${q}%,message.ilike.%${q}%,video_title.ilike.%${q}%,user_email.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: (data as SupportTicket[]) || [], error: null };
  },

  async listMine(params?: {
    limit?: number;
  }): Promise<{ data: SupportTicket[]; error: string | null }> {
    if (!supabase) return { data: [], error: 'Supabase not initialized' };
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return { data: [], error: 'User not logged in' };

    const limit = params?.limit ?? 100;
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) return { data: [], error: error.message };
    return { data: (data as SupportTicket[]) || [], error: null };
  },

  subscribeMine(userId: string, onEvent: (payload: any) => void) {
    if (!supabase) return null;
    const channel = supabase
      .channel(`support_tickets_user_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${userId}` },
        (payload) => {
          try { onEvent(payload); } catch {}
        }
      )
      .subscribe();

    return channel;
  },

  async update(id: string, patch: Partial<Pick<SupportTicket, 'status' | 'admin_notes' | 'resolved_at'>>): Promise<{ data: SupportTicket | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Supabase not initialized' };

    const payload: any = { ...patch };
    if (patch.status === 'resolved' && !patch.resolved_at) {
      payload.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return { data: null, error: error.message };

    // Best-effort email notification (Edge Function)
    try {
      await supabase.functions.invoke('ticket-notify', {
        body: { event: 'updated', ticketId: (data as any)?.id }
      });
    } catch {}
    return { data: data as SupportTicket, error: null };
  },

  async remove(id: string): Promise<{ error: string | null }> {
    if (!supabase) return { error: 'Supabase not initialized' };
    const { error } = await supabase.from('support_tickets').delete().eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  }
};
