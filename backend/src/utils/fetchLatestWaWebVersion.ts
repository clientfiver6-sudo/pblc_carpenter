import axios, { AxiosRequestConfig } from 'axios';
import { fetchLatestBaileysVersion, WAVersion } from 'baileys';

export const fetchLatestWaWebVersion = async (options: AxiosRequestConfig<{}>) => {
  try {
    // Try to scrape the live client_revision from WhatsApp Web sw.js
    const { data } = await axios.get('https://web.whatsapp.com/sw.js', {
      timeout: 10000,
      responseType: 'text',
    });

    const match = data.match(/"client_revision":\s*(\d+)/) || 
                  data.match(/\\"client_revision\\":\s*(\d+)/) ||
                  data.match(/client_revision:\s*(\d+)/);

    if (match && match[1]) {
      const revision = parseInt(match[1], 10);
      return {
        version: [2, 3000, revision] as WAVersion,
        isLatest: true,
      };
    }
  } catch (err) {
    console.error('[fetchLatestWaWebVersion] Failed to scrape sw.js, trying Baileys standard fetch:', err);
  }

  try {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    return {
      version: version as WAVersion,
      isLatest,
    };
  } catch (error) {
    // Verified fresh version fallback if all lookups fail
    return {
      version: [2, 3000, 1043366525] as WAVersion,
      isLatest: false,
      error,
    };
  }
};
