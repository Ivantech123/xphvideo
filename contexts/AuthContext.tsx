import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthService } from '../services/authService';
import { supabase } from '../services/supabase';

if (import.meta.env.DEV) console.log('[AuthContext] Module loaded, supabase:', supabase ? 'initialized' : 'null');

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLegalEditor: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<string | null>;
  register: (email: string, pass: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLegalEditor, setIsLegalEditor] = useState(false);
  const [loading, setLoading] = useState(true);

  const computeRoles = (email: string | null | undefined) => {
    const normalized = (email || '').trim().toLowerCase();
    const adminEmail = 'abloko362@gmail.com';
    const legalEditors = new Set([adminEmail, '8272@mail.ru']);
    return {
      isAdmin: normalized === adminEmail,
      isLegalEditor: legalEditors.has(normalized),
    };
  };

  useEffect(() => {
    // Use Supabase auth
    AuthService.getCurrentUser().then(u => {
      setUser(u);
      const roles = computeRoles(u?.email);
      setIsAdmin(roles.isAdmin);
      setIsLegalEditor(roles.isLegalEditor);
      setLoading(false);
    });

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user ? { id: session.user.id, email: session.user.email || '' } : null;
        setUser(u);
        const roles = computeRoles(u?.email);
        setIsAdmin(roles.isAdmin);
        setIsLegalEditor(roles.isLegalEditor);
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    } else {
        setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const { user, error } = await AuthService.signIn(email, pass);
    if (user) {
       setUser(user);
       const roles = computeRoles(user.email);
       setIsAdmin(roles.isAdmin);
       setIsLegalEditor(roles.isLegalEditor);
    }
    return error;
  };

  const register = async (email: string, pass: string) => {
    const { user, error } = await AuthService.signUp(email, pass);
    if (user) {
       setUser(user);
       const roles = computeRoles(user.email);
       setIsAdmin(roles.isAdmin);
       setIsLegalEditor(roles.isLegalEditor);
    }
    return error;
  };

  const logout = async () => {
    await AuthService.signOut();
    setUser(null);
    setIsAdmin(false);
    setIsLegalEditor(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLegalEditor, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
