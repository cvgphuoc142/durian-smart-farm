import type { ModelEntry } from './manifest';
import { isSameModelFile, type InstalledPart, type RemoteModels } from './modelStore';

export interface ModelUpdate {
  entry: ModelEntry;
  /** `new_part`: nothing on the phone for this body part yet. */
  kind: 'new_part' | 'new_version';
  /** The rollback copy is this very version: switching needs no download. */
  onPhone: boolean;
}

/**
 * What the server offers that the farmer has not got: a body part the phone has no model for, or a
 * different file for one it has. This is all the "new model" banner and the red dot look at, so a
 * new label, a healthy class or a new body part show up with no app release.
 */
export function pendingUpdates(
  installed: Record<string, InstalledPart>,
  remote: RemoteModels | null,
): ModelUpdate[] {
  if (!remote) return [];
  const out: ModelUpdate[] = [];
  for (const entry of remote.entries) {
    const have = installed[entry.plant_part];
    if (!have) out.push({ entry, kind: 'new_part', onPhone: false });
    else if (!isSameModelFile(have.current.entry, entry)) {
      out.push({
        entry,
        kind: 'new_version',
        onPhone: have.previous != null && isSameModelFile(have.previous.entry, entry),
      });
    }
  }
  return out;
}

/** "28MB" for the banner: whole megabytes, never "0". */
export const megabytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1_000_000))}MB`;

/** Bytes still to fetch for these updates (a version already on the phone costs nothing). */
export const bytesToFetch = (updates: readonly ModelUpdate[]) =>
  updates.reduce((n, u) => n + (u.onPhone ? 0 : u.entry.artifact.size_bytes), 0);

/** Progress text: "12.4MB". Unlike `megabytes` it can say 0, so a stalled download looks stalled. */
export const megabytesDone = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)}MB`;
