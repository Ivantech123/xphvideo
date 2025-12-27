import React, { useEffect, useState } from 'react';
import { GeoService, CIS_COUNTRIES } from '../services/geoService';
import { Icon } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

export const GeoBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('[GeoBlock] Component rendering...');
  const { t } = useLanguage();
  const [blocked, setBlocked] = useState<boolean>(false); // Default to allowed to show UI immediately

  useEffect(() => {
    const check = async () => {
      console.log('[GeoBlock] Starting geo check...');
      // Check local storage first
      const cached = localStorage.getItem('velvet_geo_country');
      console.log('[GeoBlock] Cached country:', cached);
      if (cached) {
        if (CIS_COUNTRIES.includes(cached)) {
          console.log('[GeoBlock] CIS country detected from cache, blocking');
          setBlocked(true);
        } else {
          console.log('[GeoBlock] Non-CIS country from cache, allowing');
        }
        return;
      }

      try {
        console.log('[GeoBlock] Fetching country from API...');
        const country = await GeoService.getCountryCode();
        console.log('[GeoBlock] API returned country:', country);
        if (country) {
          localStorage.setItem('velvet_geo_country', country);
          if (CIS_COUNTRIES.includes(country)) {
            console.log('[GeoBlock] CIS country detected, blocking');
            setBlocked(true);
          } else {
            console.log('[GeoBlock] Non-CIS country, allowing');
          }
        }
      } catch (e) {
        // Fail open if check fails
        console.error("[GeoBlock] Geo check error", e);
      }
    };
    check();
  }, []);

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center p-6 text-center text-white animate-fade-in">
        <Icon name="ShieldAlert" size={64} className="text-red-600 mb-6" />
        <h1 className="text-3xl font-bold mb-4">{t('access_denied')}</h1>
        <p className="text-gray-400 max-w-md">
          {t('geo_restricted')}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
