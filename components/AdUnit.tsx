import React, { useEffect, useMemo, useRef } from 'react';

interface AdUnitProps {
  className?: string;
  size?: 'banner' | 'sidebar' | 'square';
  label?: string;
  zoneId?: number | string;
}

declare global {
  interface Window {
    AdProvider?: any[];
  }
}

const EXOCLICK_SCRIPT_SRC = 'https://a.magsrv.com/ad-provider.js';
let exoClickScriptPromise: Promise<void> | null = null;

const ensureExoClickScript = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();

  const existing = document.querySelector(`script[src="${EXOCLICK_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
  if (existing) return Promise.resolve();

  if (!exoClickScriptPromise) {
    exoClickScriptPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.async = true;
      s.type = 'application/javascript';
      s.src = EXOCLICK_SCRIPT_SRC;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }
  return exoClickScriptPromise;
};

const defaultZoneBySize: Partial<Record<NonNullable<AdUnitProps['size']>, number>> = {
  banner: 5813902,
};

export const AdUnit: React.FC<AdUnitProps> = ({ className = '', size = 'banner', label = 'Реклама', zoneId }) => {
  const heightClass = 
    size === 'banner' ? 'h-24 md:h-32' : 
    size === 'sidebar' ? 'h-[400px]' : 
    'h-64';

  const resolvedZoneId = useMemo(() => {
    if (zoneId !== undefined && zoneId !== null && String(zoneId).trim() !== '') return zoneId;
    return defaultZoneBySize[size];
  }, [size, zoneId]);

  const isActive = resolvedZoneId !== undefined && resolvedZoneId !== null && String(resolvedZoneId).trim() !== '';
  const slotRef = useRef<HTMLDivElement>(null);
  const slotKeyRef = useRef<string>('');
  if (!slotKeyRef.current) slotKeyRef.current = Math.random().toString(36).slice(2);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

    (async () => {
      await ensureExoClickScript();
      if (cancelled) return;
      const el = slotRef.current;
      if (!el) return;

      el.innerHTML = '';

      const ins = document.createElement('ins');
      ins.className = 'eas6a97888e2';
      ins.setAttribute('data-zoneid', String(resolvedZoneId));
      ins.style.display = 'block';
      ins.style.width = '100%';
      ins.style.height = '100%';
      el.appendChild(ins);

      window.AdProvider = window.AdProvider || [];
      try {
        window.AdProvider.push({ serve: {} });
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [isActive, resolvedZoneId]);

  return (
    <div className={`relative bg-brand-surface border border-white/5 flex items-center justify-center overflow-hidden rounded-md group ${!isActive ? 'cursor-pointer' : ''} ${heightClass} ${className}`}>
      {/* Pattern background to look simpler */}
      {!isActive && (
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      )}
      
      {!isActive ? (
        <div className="z-10 text-center">
          <span className="text-gray-600 text-xs uppercase tracking-widest border border-gray-700 px-2 py-1 rounded mb-2 inline-block">
            {label}
          </span>
          <p className="text-gray-500 text-sm font-medium group-hover:text-brand-gold transition">
             Место для вашего бренда
          </p>
        </div>
      ) : (
        <div key={slotKeyRef.current} ref={slotRef} className="w-full h-full" />
      )}
    </div>
  );
};
