import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, ENABLED_LOCALES } from '@/config';
import { useSettingsStore, type Locale } from '@/stores/settingsStore';

import en from './en.json';
import vi from './vi.json';

export type { Locale };

export const resources = {
  vi: { translation: vi },
  en: { translation: en },
} as const;

const isEnabled = (locale: string | null | undefined): locale is Locale =>
  ENABLED_LOCALES.some((l) => l === locale);

/** A saved choice that is still enabled, else the device language if enabled, else Vietnamese. */
function initialLocale(): Locale {
  const stored = useSettingsStore.getState().locale;
  if (isEnabled(stored)) return stored;
  const device = getLocales()[0]?.languageCode;
  return isEnabled(device) && ENABLED_LOCALES.length > 1 ? device : DEFAULT_LOCALE;
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Switches the UI language and remembers the choice. */
export function setLocale(locale: Locale) {
  if (!isEnabled(locale)) return i18n.changeLanguage(DEFAULT_LOCALE);
  useSettingsStore.getState().setLocale(locale);
  return i18n.changeLanguage(locale);
}

export default i18n;
