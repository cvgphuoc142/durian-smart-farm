/** Base URL of the REST API. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.example.com';

/** Serve the Phase 2 fixtures from an in-memory axios adapter instead of the real backend. */
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';

/**
 * Dev-only sign-in token for a real backend running with `APP_ENV=dev`: `dev:demo` is the seeded
 * household, `dev:<anything>` a fresh empty one. Ignored in release builds.
 */
export const DEV_ID_TOKEN = process.env.EXPO_PUBLIC_DEV_ID_TOKEN;

/** Simulated network latency of the mock adapter, in ms. */
export const MOCK_LATENCY_MS = process.env.NODE_ENV === 'test' ? 0 : 250;

/** Version of the consent text for the external AI service. Raise it when the text changes. */
export const AI_CONSENT_VERSION = 1;

/** Pages the store listing and the settings screen point to. Set the real ones before release. */
export const POLICY_URL = process.env.EXPO_PUBLIC_POLICY_URL ?? 'https://example.com/privacy';
export const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://example.com/support';
/** Where a farmer who cannot open the app asks for the account to be deleted (FR-X09). */
export const DELETION_REQUEST_URL =
  process.env.EXPO_PUBLIC_DELETION_URL ?? 'https://example.com/delete-account';
