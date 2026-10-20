import { DEV_ID_TOKEN, USE_MOCK } from '@/config';
import type { AuthProvider } from '@/types';

/** The farmer closed the Google/Apple sheet. Not an error to show. */
export class SignInCancelled extends Error {
  constructor() {
    super('sign_in_cancelled');
  }
}

/**
 * Asks Google or Apple for an ID token that `POST /v1/auth/session` exchanges for a session.
 *
 * Only the mock path is built. `@react-native-google-signin/google-signin` and
 * `expo-apple-authentication` are not installed because they need the app ID and OAuth client IDs,
 * which are still an open input (plan.md "Inputs needed"). Add them here and nowhere else: this
 * function is the single place the app touches a provider SDK.
 */
export async function getProviderToken(_provider: AuthProvider): Promise<string> {
  if (USE_MOCK) return 'dev';
  // Backend with APP_ENV=dev accepts `dev:<subject>[:<name>]` (`dev:demo` is the seeded household).
  if (__DEV__ && DEV_ID_TOKEN) return DEV_ID_TOKEN;
  throw new Error('auth_not_configured');
}
