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
      onClose();
    }
  };

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
