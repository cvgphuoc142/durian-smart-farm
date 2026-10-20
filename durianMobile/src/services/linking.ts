import { Linking } from 'react-native';

/** Opens a link or a phone number in the app that handles it. `false` when nothing could. */
export async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** `0900 000 001` → `tel:0900000001`. */
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** Zalo opens a chat from the phone number the contact gave. */
export const zaloUrl = (zalo: string) => `https://zalo.me/${zalo.replace(/[^\d+]/g, '')}`;
