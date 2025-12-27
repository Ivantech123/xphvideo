import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface MoodSelectorProps {
  activeMood: string | null;
  onSelectMood: (mood: string | null) => void;
}

export const MoodSelector: React.FC<MoodSelectorProps> = ({ activeMood, onSelectMood }) => {
  const { t } = useLanguage();

  const ATMOSPHERES = [
    { id: 'Romantic', label: t('mood_romantic'), desc: t('mood_romantic_desc'), color: 'from-pink-900/50' },
    { id: 'Intense', label: t('mood_intense'), desc: t('mood_intense_desc'), color: 'from-red-900/50' },
    { id: 'Story', label: t('mood_story'), desc: t('mood_story_desc'), color: 'from-blue-900/50' },
    { id: 'Educational', label: t('mood_educational'), desc: t('mood_educational_desc'), color: 'from-emerald-900/50' },
    { id: 'Cinematic', label: t('mood_cinematic'), desc: t('mood_cinematic_desc'), color: 'from-gold-600/30' },
  ];

  return (
    <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
      <div className="flex gap-4 min-w-max">
        <button
           onClick={() => onSelectMood(null)}
           className={`group relative h-32 w-32 flex items-center justify-center border border-white/10 transition-all duration-500 ${!activeMood ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'}`}
        >
           <span className={`font-serif tracking-widest text-xs uppercase ${!activeMood ? 'text-white' : 'text-gray-500 group-hover:text-white'}`}>
             {t('mood_all')}
           </span>
        </button>

        {ATMOSPHERES.map((mood) => (
          <button
            key={mood.id}
            onClick={() => onSelectMood(activeMood === mood.id ? null : mood.id)}
            className={`group relative h-32 w-48 border transition-all duration-500 overflow-hidden flex flex-col items-center justify-center gap-2
              ${activeMood === mood.id 
                ? 'border-gold-500 bg-black' 
                : 'border-white/5 hover:border-white/20 bg-brand-surface'
              }`}
          >
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-t ${mood.color} to-transparent opacity-20 group-hover:opacity-40 transition-opacity`} />
            
            <span className={`relative z-10 font-serif text-lg tracking-widest uppercase transition-colors ${activeMood === mood.id ? 'text-gold-400' : 'text-gray-300 group-hover:text-white'}`}>
              {mood.label}
            </span>
            <span className="relative z-10 text-[10px] text-gray-500 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-300">
              {mood.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};