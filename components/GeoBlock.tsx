import React, { useEffect, useState } from 'react';
import { GeoService, CIS_COUNTRIES } from '../services/geoService';
import { Icon } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

export const GeoBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  const [blocked, setBlocked] = useState<boolean>(false); // Default to allowed to show UI immediately

  useEffect(() => {
    const check = async () => {
      // Check local storage first
      const cached = localStorage.getItem('velvet_geo_country');
      if (cached) {
        if (CIS_COUNTRIES.includes(cached)) {
          setBlocked(true);
        }
        return;
      }

      try {
        const country = await GeoService.getCountryCode();
        if (country) {
          localStorage.setItem('velvet_geo_country', country);
          if (CIS_COUNTRIES.includes(country)) {
            setBlocked(true);
          }
        }
      } catch (e) {
        // Fail open if check fails
        console.error("Geo check error", e);
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
