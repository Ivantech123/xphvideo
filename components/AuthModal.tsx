import React, { useState } from 'react';
import { Icon } from './Icon';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = isLogin 
      ? await login(email, password)
      : await register(email, password);

    setLoading(false);
    if (res) {
      setError(res);
    } else {
      if (!isLogin) {
        // Show email confirmation message after registration
        setEmailSent(true);
      } else {
        onClose();
      }
    }
  };

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Введите email');
      return;
    }
    setLoading(true);
    setError(null);
    
    try {
      // Import supabase for password reset
      const { supabase } = await import('../services/supabase');
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/#/reset-password`
        });
        if (error) {
          setError(error.message);
        } else {
          setResetEmailSent(true);
        }
      }
    } catch (err) {
      setError('Ошибка отправки письма');
    }
    setLoading(false);
  };

  // Password reset email sent screen
  if (resetEmailSent) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
        <div className="bg-brand-surface w-full max-w-md border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden text-center">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="KeyRound" size={40} className="text-blue-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Проверьте почту!</h2>
          <p className="text-gray-400 mb-2">
            Мы отправили ссылку для сброса пароля на:
          </p>
          <p className="text-brand-gold font-bold text-lg mb-6">{email}</p>
          <p className="text-gray-500 text-sm mb-6">
            Перейдите по ссылке в письме, чтобы создать новый пароль.
          </p>
          <button 
            onClick={onClose}
            className="w-full bg-brand-gold hover:bg-yellow-500 text-black font-bold py-3 rounded-lg uppercase tracking-widest transition"
          >
            Понятно
          </button>
        </div>
      </div>
    );
  }

  // Forgot password form
  if (showForgotPassword) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
        <div className="bg-brand-surface w-full max-w-md border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">
            <Icon name="X" size={24} />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white mb-2">Восстановление пароля</h2>
            <p className="text-gray-400 text-sm">Введите email для получения ссылки сброса</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-brand-gold outline-none transition"
                placeholder="you@example.com"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-brand-gold hover:bg-yellow-500 text-black font-bold py-3 rounded-lg uppercase tracking-widest transition disabled:opacity-50"
            >
              {loading ? 'Отправка...' : 'Отправить ссылку'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setShowForgotPassword(false)} 
              className="text-sm text-gray-500 hover:text-white transition"
            >
              ← Назад к входу
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Email confirmation success screen
  if (emailSent) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
        <div className="bg-brand-surface w-full max-w-md border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="Mail" size={40} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Проверьте почту!</h2>
          <p className="text-gray-400 mb-2">
            Мы отправили письмо с подтверждением на:
          </p>
          <p className="text-brand-gold font-bold text-lg mb-6">{email}</p>
          <p className="text-gray-500 text-sm mb-6">
            Перейдите по ссылке в письме, чтобы активировать аккаунт. 
            Проверьте папку "Спам", если письмо не пришло.
          </p>
          <button 
            onClick={onClose}
            className="w-full bg-brand-gold hover:bg-yellow-500 text-black font-bold py-3 rounded-lg uppercase tracking-widest transition"
          >
            Понятно
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-brand-surface w-full max-w-md border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">
          <Icon name="X" size={24} />
        </button>

        <div className="text-center mb-8">
           <h2 className="text-3xl font-black text-white mb-2">{isLogin ? 'Welcome Back' : 'Join Velvet'}</h2>
           <p className="text-gray-400 text-sm">Enter your details to access your account</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
           <div>
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
             <input 
               type="email" 
               required
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-brand-gold outline-none transition"
               placeholder="you@example.com"
             />
           </div>
           
           <div>
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Password</label>
             <input 
               type="password" 
               required
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-brand-gold outline-none transition"
               placeholder="••••••••"
             />
           </div>

           <button 
             type="submit" 
             disabled={loading}
             className="w-full bg-brand-gold hover:bg-yellow-500 text-black font-bold py-3 rounded-lg uppercase tracking-widest transition disabled:opacity-50"
           >
             {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Create Account')}
           </button>

           {isLogin && (
             <button 
               type="button"
               onClick={() => setShowForgotPassword(true)}
               className="w-full text-center text-sm text-gray-500 hover:text-brand-gold transition mt-2"
             >
               Забыли пароль?
             </button>
           )}
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
           {isLogin ? "Don't have an account? " : "Already have an account? "}
           <button onClick={() => setIsLogin(!isLogin)} className="text-white font-bold hover:underline">
             {isLogin ? 'Sign Up' : 'Log In'}
           </button>
        </div>
      </div>
    </div>
  );
};
