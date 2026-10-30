/**
 * Languages the user can pick. The app is Vietnamese only for now; the English catalog and the
 * language pickers stay in the code. To bring English back, add `'en'` here.
 */
export const ENABLED_LOCALES: readonly ('vi' | 'en')[] = ['vi'];
export const DEFAULT_LOCALE: 'vi' | 'en' = 'vi';

const PLACEHOLDER_API_URL = 'https://api.example.com';

/** Base URL of the REST API. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? PLACEHOLDER_API_URL;

/**
 * Serve the Phase 2 fixtures from an in-memory axios adapter instead of the real backend.
 * Development and tests only: a release build always talks to the real backend.
 */
export const USE_MOCK = __DEV__ && process.env.EXPO_PUBLIC_USE_MOCK !== 'false';

// A release build without a real API URL would show an app that cannot sign in. Fail at start-up
// so the broken build is caught before it reaches a store.
if (!__DEV__ && API_URL === PLACEHOLDER_API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is not set for this release build.');
}

/** Privacy policy and support pages, shown on sign-in and in Settings. Same URLs as the stores. */
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
export const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL;

/**
 * Dev-only sign-in token for a real backend running with `APP_ENV=dev`: `dev:demo` is the seeded
 * household, `dev:<anything>` a fresh empty one. Ignored in release builds.
 */
export const DEV_ID_TOKEN = process.env.EXPO_PUBLIC_DEV_ID_TOKEN;

/** Simulated network latency of the mock adapter, in ms. */
export const MOCK_LATENCY_MS = process.env.NODE_ENV === 'test' ? 0 : 250;

/** Version of the consent text for the external AI service. Raise it when the text changes. */
export const AI_CONSENT_VERSION = 1;

/** Google OAuth client IDs (Cloud Console → Google Auth Platform → Clients). The web ID is the token audience. */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  '353834200795-82pgepighrng8kf3i76ul0krbim9no0e.apps.googleusercontent.com';
