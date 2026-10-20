import type { DiseaseCase, LocalScan, Locale, Scan, ScanSyncState, Timestamp } from '@/types';

/** A scan as the lists show it, whether it came from the server, from this phone, or both. */
export interface ScanItem {
  id: string;
  season_id: string;
  case_id: string | null;
  captured_at: Timestamp;
  plant_part: string;
  outcome: Scan['outcome'];
  label: string | null;
  score: number | null;
  model_id: string;
  model_version: string;
  /** The photo on this phone. `null` on another phone: the app has no download for it. */
  photo_uri: string | null;
  sync: ScanSyncState;
  /** Why it is stuck, when `sync` is `error`. */
  error: string | null;
}

export interface CaseItem {
  id: string;
  season_id: string;
  opened_at: Timestamp;
  closed_at: Timestamp | null;
  location_note: string | null;
  note: string | null;
  /** Created on this phone with a scan the server has not acknowledged yet. */
  pending: boolean;
  /** For `expected_revision` when the farmer closes the case. `null` while pending. */
  revision: number | null;
  scans: ScanItem[];
}

const byNewest = (a: { captured_at: string }, b: { captured_at: string }) =>
  b.captured_at.localeCompare(a.captured_at);

function fromServer(s: Scan, local: LocalScan | undefined): ScanItem {
  return {
    id: s.id,
    season_id: s.season_id,
    case_id: s.case_id,
    captured_at: s.captured_at,
    plant_part: s.plant_part,
    outcome: s.outcome,
    label: s.label_snapshot,
    score: s.score,
    model_id: s.inference_metadata.model_id,
    model_version: s.inference_metadata.model_version,
    photo_uri: local?.photo_uri ?? null,
    // The data is on the server; "synced" also needs the photo, which only this phone can vouch for.
    sync: local && local.state !== 'synced' && local.state !== 'draft' ? local.state : 'synced',
    error: local?.state === 'error' ? local.last_error : null,
  };
}

function fromLocal(l: LocalScan): ScanItem {
  return {
    id: l.id,
    season_id: l.season_id!,
    case_id: l.new_case?.id ?? l.case_id,
    captured_at: l.captured_at,
    plant_part: l.plant_part,
    outcome: l.outcome as Scan['outcome'],
    label: l.label_snapshot,
    score: l.score,
    model_id: l.inference?.model_id ?? '',
    model_version: l.inference?.model_version ?? '',
    photo_uri: l.photo_uri,
    sync: l.state === 'draft' ? 'saved_on_device' : l.state,
    error: l.state === 'error' ? l.last_error : null,
  };
}

/**
 * Server scans, plus the saved scans still on this phone that the server does not have yet.
 * Drafts are not scans yet and are left out. Newest first.
 */
export function mergeScans(server: readonly Scan[], local: readonly LocalScan[]): ScanItem[] {
  const localById = new Map(local.map((l) => [l.id, l]));
  const serverIds = new Set(server.map((s) => s.id));
  const items = server.filter((s) => !s.deleted_at).map((s) => fromServer(s, localById.get(s.id)));
  for (const l of local) {
    if (l.state !== 'draft' && l.season_id && !serverIds.has(l.id)) items.push(fromLocal(l));
  }
  return items.sort(byNewest);
}

/** Server cases, plus cases made on this phone together with a scan that has not arrived yet. */
export function mergeCases(
  server: readonly DiseaseCase[],
  local: readonly LocalScan[],
  scans: readonly ScanItem[],
): CaseItem[] {
  const serverIds = new Set(server.map((c) => c.id));
  const forCase = (id: string) => scans.filter((s) => s.case_id === id);
  const items: CaseItem[] = server
    .filter((c) => !c.deleted_at)
    .map((c) => ({
      id: c.id,
      season_id: c.season_id,
      opened_at: c.opened_at,
      closed_at: c.closed_at,
      location_note: c.location_note,
      note: c.note,
      pending: false,
      revision: c.revision,
      scans: forCase(c.id),
    }));
  for (const l of local) {
    const c = l.new_case;
    if (!c || l.state === 'draft' || !l.season_id || serverIds.has(c.id)) continue;
    items.push({
      id: c.id,
      season_id: l.season_id,
      opened_at: c.opened_at,
      closed_at: null,
      location_note: c.location_note,
      note: c.note,
      pending: true,
      revision: null,
      scans: forCase(c.id),
    });
  }
  return items.sort((a, b) => b.opened_at.localeCompare(a.opened_at));
}

/** Name of a body part from the manifest; a part this build does not know shows its key. */
export function partLabel(
  entries: readonly { plant_part: string; part_labels: Record<Locale, string> }[],
  part: string,
  locale: Locale,
) {
  return entries.find((e) => e.plant_part === part)?.part_labels[locale] ?? part;
}
