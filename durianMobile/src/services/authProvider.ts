import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

import { DEV_ID_TOKEN, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, USE_MOCK } from '@/config';
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
 * Google uses `@react-native-google-signin/google-signin` and Apple `expo-apple-authentication`
 * (iOS only). Both need a dev build, not Expo Go. This function is the single place the app
 * touches a provider SDK.
 */
export async function getProviderToken(provider: AuthProvider): Promise<string> {
  if (USE_MOCK) return 'dev';
  if (provider === 'apple') return getAppleToken();
  if (provider === 'google' && GOOGLE_WEB_CLIENT_ID) return getGoogleToken(GOOGLE_WEB_CLIENT_ID);
  // Backend with APP_ENV=dev accepts `dev:<subject>[:<name>]` (`dev:demo` is the seeded household).
  if (__DEV__ && DEV_ID_TOKEN) return DEV_ID_TOKEN;
  throw new Error('auth_not_configured');
}

async function getGoogleToken(webClientId: string): Promise<string> {
  GoogleSignin.configure({ webClientId, iosClientId: GOOGLE_IOS_CLIENT_ID });
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) throw new SignInCancelled();
  if (isSuccessResponse(response) && response.data.idToken) return response.data.idToken;
  throw new Error('auth_failed');
}

async function getAppleToken(): Promise<string> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (credential.identityToken) return credential.identityToken;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw e;
  }
  throw new Error('auth_failed');
}

/** Sign in with Apple exists only on iOS 13+; elsewhere the button stays hidden. */
export function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}
