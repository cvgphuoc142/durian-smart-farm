import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { useSettingsStore, type Locale } from '@/stores/settingsStore';

import en from './en.json';
import vi from './vi.json';

export type { Locale };

export const resources = {
  vi: { translation: vi },
  en: { translation: en },
} as const;

function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'vi';
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: useSettingsStore.getState().locale ?? deviceLocale(),
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Switches the UI language and remembers the choice. */
export function setLocale(locale: Locale) {
  useSettingsStore.getState().setLocale(locale);
  return i18n.changeLanguage(locale);
}

export default i18n;
