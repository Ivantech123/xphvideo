import React from 'react';
import { Icon } from './Icon';

interface AdUnitProps {
  className?: string;
  size?: 'banner' | 'sidebar' | 'square';
  label?: string;
}

export const AdUnit: React.FC<AdUnitProps> = ({ className = '', size = 'banner', label = 'Реклама' }) => {
  const heightClass = 
    size === 'banner' ? 'h-24 md:h-32' : 
    size === 'sidebar' ? 'h-[400px]' : 
    'h-64';

  return (
    <div className={`relative bg-brand-surface border border-white/5 flex items-center justify-center overflow-hidden rounded-md group cursor-pointer ${heightClass} ${className}`}>
      {/* Pattern background to look simpler */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      
      <div className="z-10 text-center">
        <span className="text-gray-600 text-xs uppercase tracking-widest border border-gray-700 px-2 py-1 rounded mb-2 inline-block">
          {label}
        </span>
        <p className="text-gray-500 text-sm font-medium group-hover:text-brand-gold transition">
           Место для вашего бренда
        </p>
      </div>
    </div>
  );
};
