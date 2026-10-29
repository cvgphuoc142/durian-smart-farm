import NetInfo from '@react-native-community/netinfo';
import { Directory, File, Paths } from 'expo-file-system';
import * as Legacy from 'expo-file-system/legacy';

import { Sha256 } from '@/utils/sha256';

/**
 * The only module that touches the phone's disk for model files. Paths are relative to the
 * document folder; `modelInstaller` works through this interface so it can be tested without a phone.
 */
export interface ModelFiles {
  freeBytes(): number;
  exists(rel: string): boolean;
  sizeOf(rel: string): number | null;
  remove(rel: string): void;
  /** Moves `from` onto `to`, replacing it. */
  move(from: string, to: string): void;
  download(
    url: string,
    rel: string,
    onProgress: (received: number, total: number) => void,
  ): { done: Promise<number>; cancel: () => Promise<void> };
  sha256(rel: string, onProgress: (done: number, total: number) => void): Promise<string>;
  uri(rel: string): string;
}

const CHUNK = 1 << 20;
/** Let the UI draw between chunks; hashing 100 MB in JS must not freeze the screen. */
const YIELD_EVERY = 4;
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const file = (rel: string) => new File(Paths.document, rel);

function ensureParent(rel: string) {
  const parts = rel.split('/').slice(0, -1);
  if (parts.length)
    new Directory(Paths.document, ...parts).create({ intermediates: true, idempotent: true });
}

export const modelFiles: ModelFiles = {
  freeBytes: () => Paths.availableDiskSpace,
  exists: (rel) => file(rel).exists,
  sizeOf: (rel) => {
    const f = file(rel);
    return f.exists ? f.size : null;
  },
  remove: (rel) => {
    const f = file(rel);
    if (f.exists) f.delete();
  },
  move: (from, to) => {
    ensureParent(to);
    file(from).move(file(to));
  },
  uri: (rel) => file(rel).uri,

  download(url, rel, onProgress) {
    ensureParent(rel);
    let last = 0;
    const task = Legacy.createDownloadResumable(url, file(rel).uri, {}, (p) => {
      const now = Date.now();
      if (now - last < 250 && p.totalBytesWritten < p.totalBytesExpectedToWrite) return;
      last = now;
      onProgress(p.totalBytesWritten, p.totalBytesExpectedToWrite);
    });
    return {
      done: task.downloadAsync().then((r) => {
        if (!r) throw new Error('cancelled');
        return r.status;
      }),
      cancel: () => task.cancelAsync(),
    };
  },

  async sha256(rel, onProgress) {
    const handle = file(rel).open();
    try {
      const total = handle.size ?? 0;
      const hash = new Sha256();
      let done = 0;
      for (let n = 0; done < total; n++) {
        const chunk = handle.readBytes(Math.min(CHUNK, total - done));
        if (chunk.length === 0) break;
        hash.update(chunk);
        done += chunk.length;
        if (n % YIELD_EVERY === 0) {
          onProgress(done, total);
          await tick();
        }
      }
      onProgress(total, total);
      return hash.digest();
    } finally {
      handle.close();
    }
  },
};

/** True on mobile data; the farmer is asked before a model is fetched there. */
export async function isOnCellular(): Promise<boolean> {
  try {
    return (await NetInfo.fetch()).type === 'cellular';
  } catch {
    return false;
  }
}
