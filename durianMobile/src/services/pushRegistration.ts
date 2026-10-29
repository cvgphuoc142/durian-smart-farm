import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import { Platform } from 'react-native';

import { modelsApi } from '@/api/endpoints/models';
import { mmkv } from '@/stores/storage';

/**
 * "A new scan model is out" while the app is closed (expo-notifications). The server sends it when
 * a model is published; the phone does not download anything because of it, it only opens the app
 * on the banner where the farmer taps "Tải về". Everything here is best effort: no permission, no
 * project id (a build not yet linked to EAS) or no network just means no push.
 */
type Notifications = typeof NotificationsType;

/**
 * expo-notifications has native code. A build made before it was added (an old development
 * client) does not have it and importing it throws, so it is loaded on first use and its absence
 * only means no push.
 */
let loaded: Notifications | null | undefined;
function notifications(): Notifications | null {
  if (loaded === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = require('expo-notifications') as Notifications;
    } catch {
      loaded = null;
    }
  }
  return loaded;
}

const TOKEN_KEY = 'push.token';
const ASKED_KEY = 'push.asked';

/** Shown as a banner even while the app is open. */
export function installNotificationHandler() {
  try {
    notifications()?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // No native module in this build.
  }
}

const projectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;

/**
 * Registers this phone's push token with the server when notifications are allowed. With
 * `ask: true` it first shows the system prompt, once per install; otherwise it never prompts.
 */
export async function registerForModelPush({ ask = false }: { ask?: boolean } = {}) {
  try {
    const Notifications = notifications();
    if (!Notifications) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Thông báo',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain && !mmkv.getString(ASKED_KEY)) {
      mmkv.set(ASKED_KEY, '1');
      perm = await Notifications.requestPermissionsAsync();
    }
    const id = projectId();
    if (!perm.granted || !id) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await modelsApi.registerPush(token, Platform.OS === 'ios' ? 'ios' : 'android');
    mmkv.set(TOKEN_KEY, token);
  } catch {
    // No push is not an error the farmer can act on.
  }
}

/** On sign-out: stop telling this phone about models. Needs the session, so call it before. */
export async function unregisterModelPush() {
  const token = mmkv.getString(TOKEN_KEY);
  if (!token) return;
  try {
    await modelsApi.unregisterPush(token);
    mmkv.remove(TOKEN_KEY);
  } catch {
    // The token stays; the server drops it when Expo reports it dead.
  }
}

/** Calls `onOpen` when the farmer taps a "new model" notification. */
export function onModelNotificationOpened(onOpen: () => void) {
  try {
    const sub = notifications()?.addNotificationResponseReceivedListener((r) => {
      if (r.notification.request.content.data?.type === 'model_update') onOpen();
    });
    return () => sub?.remove();
  } catch {
    return () => undefined;
  }
}
