import React, { useEffect, useState } from 'react';
import { GeoService, CIS_COUNTRIES } from '../services/geoService';
import { Icon } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

export const GeoBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('[GeoBlock] Component rendering...');
  const { t } = useLanguage();
  const [blocked, setBlocked] = useState<boolean>(false); // Default to allowed to show UI immediately
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      console.log('[GeoBlock] Starting geo check...');
      // Check local storage first
      const cached = localStorage.getItem('velvet_geo_country');
      console.log('[GeoBlock] Cached country:', cached);
      if (cached) {
        setCountry(cached);
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
          setCountry(country);
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
        <p className="text-gray-300 max-w-xl">
          {t('geo_restricted')}
        </p>

        <ul className="text-gray-400 max-w-xl mt-4 text-left list-disc pl-6 space-y-2">
          <li>{t('geo_restricted_reason_1')}</li>
          <li>{t('geo_restricted_reason_2')}</li>
          <li>{t('geo_restricted_reason_3')}</li>
        </ul>

        {country && (
          <div className="mt-5 text-xs text-gray-500">
            {t('geo_detected_country')}: <span className="text-gray-300 font-bold">{country}</span>
          </div>
        )}

        <a
          href="/legal.html"
          className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold"
          target="_blank"
          rel="noreferrer"
        >
          {t('geo_open_policies')}
        </a>
      </div>
    );
  }

  return <>{children}</>;
};
