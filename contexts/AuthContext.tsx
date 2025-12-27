import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthService } from '../services/authService';
import { supabase } from '../services/supabase';
import { initNetlifyIdentity, getCurrentUser as getNetlifyUser, onAuthStateChange as onNetlifyAuthChange, openLogin as netlifyLogin, logout as netlifyLogout, NetlifyUser } from '../services/netlifyIdentity';

console.log('[AuthContext] Module loaded, supabase:', supabase ? 'initialized' : 'null');

// Check if running on velvet.run (use Netlify Identity) or localhost (use Supabase)
const useNetlifyAuth = typeof window !== 'undefined' && window.location.hostname.includes('velvet.run');

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<string | null>;
  register: (email: string, pass: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (useNetlifyAuth) {
      // Use Netlify Identity for velvet.run
      initNetlifyIdentity().then(() => {
        const netlifyUser = getNetlifyUser();
        if (netlifyUser) {
          const u: User = { id: netlifyUser.id, email: netlifyUser.email };
          setUser(u);
          if (u.email === 'abloko362@gmail.com') setIsAdmin(true);
        }
        setLoading(false);
      });

      onNetlifyAuthChange((netlifyUser: NetlifyUser | null) => {
        if (netlifyUser) {
          const u: User = { id: netlifyUser.id, email: netlifyUser.email };
          setUser(u);
          if (u.email === 'abloko362@gmail.com') setIsAdmin(true);
          else setIsAdmin(false);
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      });
    } else {
      // Use Supabase for localhost/other domains
      AuthService.getCurrentUser().then(u => {
        setUser(u);
        if (u && u.email === 'abloko362@gmail.com') setIsAdmin(true);
        else setIsAdmin(false);
        setLoading(false);
      });

      if (supabase) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          const u = session?.user ? { id: session.user.id, email: session.user.email || '' } : null;
          setUser(u);
          if (u && u.email === 'abloko362@gmail.com') setIsAdmin(true);
          else setIsAdmin(false);
          setLoading(false);
        });

        return () => subscription.unsubscribe();
      } else {
          setLoading(false);
      }
    }
  }, []);

  const login = async (email: string, pass: string) => {
    if (useNetlifyAuth) {
      // Open Netlify Identity modal
      netlifyLogin();
      return null;
    }
    const { user, error } = await AuthService.signIn(email, pass);
    if (user) {
       setUser(user);
       if (user.email === 'abloko362@gmail.com') setIsAdmin(true);
    }
    return error;
  };

  const register = async (email: string, pass: string) => {
    if (useNetlifyAuth) {
      // Open Netlify Identity modal (signup tab)
      netlifyLogin();
      return null;
    }
    const { user, error } = await AuthService.signUp(email, pass);
    if (user) {
       setUser(user);
       if (user.email === 'abloko362@gmail.com') setIsAdmin(true);
    }
    return error;
  };

  const logout = async () => {
    if (useNetlifyAuth) {
      netlifyLogout();
    } else {
      await AuthService.signOut();
    }
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
