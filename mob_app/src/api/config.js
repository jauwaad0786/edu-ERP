import { appConfig } from '../config/appConfig';

// Default to production backend
export const DEFAULT_API_URL = appConfig.environments.PRODUCTION.apiUrl;

export const getApiBaseUrl = () => {
  try {
    const customUrl = localStorage.getItem('custom_api_url');
    if (customUrl) return customUrl.endsWith('/') ? customUrl.slice(0, -1) : customUrl;
  } catch (e) {
    // ignore
  }
  return DEFAULT_API_URL;
};

export const setCustomApiUrl = (url) => {
  if (url) {
    localStorage.setItem('custom_api_url', url);
  } else {
    localStorage.removeItem('custom_api_url');
  }
};

// Aliases
export const getBaseUrl = getApiBaseUrl;
export const setCustomBaseUrl = setCustomApiUrl;

export default {
  DEFAULT_API_URL,
  getApiBaseUrl,
  setCustomApiUrl,
  getBaseUrl,
  setCustomBaseUrl,
};
