import { Preferences } from '@capacitor/preferences';

export const storage = {
  async get(key) {
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) return value;
    } catch (e) {
      // fallback
    }
    return localStorage.getItem(key);
  },

  async set(key, value) {
    try {
      await Preferences.set({ key, value: String(value) });
    } catch (e) {
      // fallback
    }
    localStorage.setItem(key, String(value));
  },

  async remove(key) {
    try {
      await Preferences.remove({ key });
    } catch (e) {
      // fallback
    }
    localStorage.removeItem(key);
  },

  async clear() {
    try {
      await Preferences.clear();
    } catch (e) {
      // fallback
    }
    localStorage.clear();
  }
};
