export const GeoService = {
  async getCountryCode(): Promise<string | null> {
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error('Geo fetch failed');
      const data = await response.json();
      return data.country_code; // Returns 2-letter ISO code e.g. 'RU', 'US'
    } catch (e) {
      console.warn("Geo check failed, defaulting to allow", e);
      return null; // Fail open or closed? Typically fail open for client-side to avoid blocking legit users on error.
    }
  }
};

export const CIS_COUNTRIES = ['RU', 'BY', 'KZ', 'KG', 'TJ', 'UZ', 'AM', 'AZ', 'MD', 'TM'];
