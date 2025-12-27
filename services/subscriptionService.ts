import { supabase } from './supabase';

export interface Subscription {
  id: string;
  user_id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar?: string;
  created_at: string;
}

export const SubscriptionService = {
  async subscribe(creatorId: string, creatorName: string, creatorAvatar?: string): Promise<{ data: Subscription | null; error: string | null }> {
    if (!supabase) return { data: null, error: 'Supabase not initialized' };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'User not logged in' };

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        creator_id: creatorId,
        creator_name: creatorName,
        creator_avatar: creatorAvatar
      })
      .select()
      .single();

    if (error) {
        // If already subscribed, return success-like response or specific error
        if (error.code === '23505') { // Unique violation
            return { data: null, error: 'Already subscribed' };
        }
        return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async unsubscribe(creatorId: string): Promise<{ error: string | null }> {
    if (!supabase) return { error: 'Supabase not initialized' };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'User not logged in' };

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('creator_id: text', creatorId); // Explicit type cast might be needed sometimes, but usually simple eq works. Let's try simple eq first.
      
    // Re-trying simple eq if the above comment was just a thought.
    // Actually, let's stick to standard eq.
    const { error: deleteError } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('creator_id', creatorId);

    return { error: deleteError ? deleteError.message : null };
  },

  async getSubscriptions(): Promise<Subscription[]> {
    if (!supabase) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return [];
    }

    return data || [];
  },

  async isSubscribed(creatorId: string): Promise<boolean> {
    if (!supabase) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('creator_id', creatorId)
      .single();

    if (error || !data) return false;
    return true;
  }
};
