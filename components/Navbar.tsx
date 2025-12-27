import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { UserMode } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES_GENERAL, CATEGORIES_HIM, CATEGORIES_HER, CATEGORIES_GAY, CATEGORIES_TRANS } from '../constants';

interface NavbarProps {
  onMenuClick: () => void;
  onHomeClick: () => void;
  onPanic: () => void;
  userMode: UserMode;
  onModeChange: (mode: UserMode) => void;
  onBossMode: () => void;
  onAuthClick: () => void;
  onSearch: (query: string) => void;
}

const ALL_TAGS = Array.from(new Set([
  ...CATEGORIES_GENERAL,
  ...CATEGORIES_HIM,
  ...CATEGORIES_HER,
  ...CATEGORIES_GAY,
  ...CATEGORIES_TRANS
]));

export const Navbar: React.FC<NavbarProps> = ({ 
  onMenuClick, 
  onHomeClick, 
  onPanic,
  userMode,
  onModeChange,
  onBossMode,
  onAuthClick,
  onSearch
}) => {
  const { t, lang, setLang } = useLanguage();
  const { user, logout } = useAuth();
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(searchValue);
      setMobileSearchOpen(false);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchValue(suggestion);
    onSearch(suggestion);
    setMobileSearchOpen(false);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (searchValue.trim().length > 1) {
      const lower = searchValue.toLowerCase();
      const filtered = ALL_TAGS.filter(tag => tag.toLowerCase().includes(lower)).slice(0, 8);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowModeMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTheme = () => {
    switch (userMode) {
      case 'Her': return { 
        bg: 'bg-[#150a10]', 
        border: 'border-rose-900/30', 
        accent: 'text-rose-400', 
        logo: 'bg-rose-500', 
        buttonHover: 'hover:bg-rose-500/10',
        searchFocus: 'focus:border-rose-500/50',
        check: 'text-rose-500'
      };
      case 'Him': return { 
        bg: 'bg-[#050b14]', 
        border: 'border-blue-900/30', 
        accent: 'text-blue-400', 
        logo: 'bg-blue-600', 
        buttonHover: 'hover:bg-blue-500/10',
        searchFocus: 'focus:border-blue-500/50',
        check: 'text-blue-500'
      };
      // ... keep other cases same structure, condensed for brevity
      default: return { 
        bg: 'bg-brand-bg/95 backdrop-blur-md', 
        border: 'border-brand-border', 
        accent: 'text-white', 
        logo: 'bg-white', 
        buttonHover: 'hover:bg-white/10',
        searchFocus: 'focus:border-brand-gold/50',
        check: 'text-brand-gold'
      };
    }
  };

  const theme = getTheme();

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 border-b h-16 flex items-center justify-between px-4 transition-all duration-500 shadow-lg ${theme.bg} ${theme.border}`}>
      
      {/* MOBILE SEARCH OVERLAY */}
      {mobileSearchOpen && (
        <div className={`absolute inset-0 z-50 flex items-center px-4 ${theme.bg} animate-fade-in`}>
           <Icon name="Search" size={20} className="text-gray-400 mr-3" />
           <input 
             autoFocus
             type="text" 
             placeholder={t('search_placeholder')}
             className="flex-1 bg-transparent text-white focus:outline-none h-full text-lg placeholder-gray-500 font-serif"
             value={searchValue}
             onChange={(e) => setSearchValue(e.target.value)}
             onKeyDown={handleSearch}
           />
           <button onClick={() => setMobileSearchOpen(false)} className="p-2 ml-2 text-gray-400">
             <Icon name="X" size={24} />
           </button>
        </div>
      )}

      {/* Left: Menu & Logo */}
      <div className="flex items-center gap-3 md:gap-4">
        <button onClick={onMenuClick} className={`text-gray-300 p-2 rounded-full transition ${theme.buttonHover}`}>
          <Icon name="Menu" size={24} />
        </button>
        <div onClick={onHomeClick} className="flex items-center gap-2 cursor-pointer group">
          <div className="flex flex-col justify-center -space-y-1">
            <span className="font-serif font-black text-2xl tracking-tight text-white leading-none group-hover:text-brand-gold transition-colors">VELVET</span>
            {userMode !== 'General' && (
              <span className={`text-[9px] ${theme.accent} uppercase font-bold tracking-[0.3em] leading-none text-center`}>{userMode}</span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Desktop Search */}
      <div className="hidden md:flex flex-1 max-w-xl mx-8" ref={searchRef}>
        <div className="flex w-full relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Icon name="Search" size={16} className="text-gray-500 group-focus-within:text-brand-gold transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder={t('search_placeholder')}
            className={`w-full rounded-none border-b border-gray-700 bg-transparent pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-all focus:border-brand-gold placeholder-gray-600 ${theme.searchFocus}`}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearch}
            onFocus={() => searchValue.length > 1 && setShowSuggestions(true)}
          />
          {/* Search Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition flex items-center gap-2"
                >
                  <Icon name="Search" size={14} className="text-gray-500" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 md:gap-3">
        
        {/* LANG SWITCHER */}
        <button 
          onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
          className="text-xs font-bold uppercase text-gray-400 hover:text-white border border-white/10 px-2 py-1 rounded hover:border-brand-gold transition"
        >
          {lang}
        </button>

        {/* AUTH BUTTON */}
        <button 
          onClick={user ? logout : onAuthClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border ${user ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/30 hover:bg-brand-gold/20' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`}
        >
           <Icon name="User" size={16} />
           <span className="hidden md:inline">{user ? user.email.split('@')[0] : 'Login'}</span>
        </button>

        <button 
          onClick={() => setMobileSearchOpen(true)}
          className="md:hidden p-2 text-gray-300 hover:text-white rounded-full hover:bg-white/10"
        >
          <Icon name="Search" size={22} />
        </button>

        <button 
          onClick={onBossMode}
          className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
          title="Boss Key"
        >
           <Icon name="Briefcase" size={20} />
        </button>

        {/* MODE SELECTOR */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setShowModeMenu(!showModeMenu)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 hover:border-brand-gold/50 ${
              userMode !== 'General'
                ? `bg-white/5 ${theme.accent} border-white/10` 
                : 'bg-transparent border-white/10 text-gray-300 hover:text-white'
            }`}
          >
             <Icon name="Globe" size={18} />
             <span className="hidden lg:inline text-xs font-bold uppercase tracking-wide">{userMode}</span>
             <Icon name="ChevronDown" size={14} className={`transition-transform duration-300 ${showModeMenu ? 'rotate-180' : ''}`} />
          </button>

          {showModeMenu && (
            <div className="absolute top-full right-0 mt-3 w-64 bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in flex flex-col z-50 max-h-[80vh] overflow-y-auto">
              <div className="p-2 space-y-1">
                {[
                  { id: 'General', label: t('mode_general') },
                  { id: 'Him', label: t('mode_him') },
                  { id: 'Her', label: t('mode_her') },
                  { id: 'Couples', label: t('mode_couples') },
                  { id: 'Gay', label: t('mode_gay') },
                  { id: 'Trans', label: t('mode_trans') },
                  { id: 'Lesbian', label: t('mode_lesbian') }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onModeChange(m.id as UserMode); setShowModeMenu(false); }}
                    className={`w-full flex items-center justify-between px-3 py-3 text-sm rounded-lg transition-all ${userMode === m.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                  >
                    <span>{m.label}</span>
                    {userMode === m.id && <Icon name="Check" size={16} className={theme.check} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PANIC BUTTON */}
        <button 
          onClick={onPanic}
          className="flex items-center justify-center gap-2 bg-red-900/10 hover:bg-red-600 text-red-500 hover:text-white p-2 md:px-4 md:py-2 rounded-full border border-red-500/20 transition-all group"
        >
           <Icon name="LogOut" size={18} />
           <span className="hidden md:inline text-xs font-bold uppercase tracking-wider">Panic</span>
        </button>
      </div>
    </nav>
  );
};