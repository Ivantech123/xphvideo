import { supabase } from './supabase';

export interface User {
  id: string;
  email: string;
}

export const AuthService = {
  async signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    if (!supabase) return { user: null, error: 'Supabase not configured. Check .env' };
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) return { user: null, error: error.message };
    
    return { 
      user: data.user ? { id: data.user.id, email: data.user.email || '' } : null, 
      error: null 
    };
  },

  async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    if (!supabase) return { user: null, error: 'Supabase not configured. Check .env' };

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { user: null, error: error.message };

    return { 
      user: data.user ? { id: data.user.id, email: data.user.email || '' } : null, 
      error: null 
    };
  },

  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  async getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;
    
    const { data: { user } } = await supabase.auth.getUser();
    return user ? { id: user.id, email: user.email || '' } : null;
  }
};
