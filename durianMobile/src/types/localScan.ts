import type { Timestamp } from './common';
import type {
  InferenceMetadata,
  Prediction,
  PlantPart,
  ScanResultState,
  ScanSyncState,
} from './scan';

/** A case created together with a scan; it travels in the same mutation. */
export interface NewCase {
  id: string;
  opened_at: Timestamp;
  location_note: string | null;
  note: string | null;
}

/**
 * `draft`: result computed, not saved yet (kept so a restart or a missing season loses nothing).
 * The other four are the sync states of a saved scan (FR-X06).
 */
export type LocalScanState = 'draft' | ScanSyncState;

/** A scan on this phone. The row is the immutable result snapshot plus where it is in the sync. */
export interface LocalScan {
  /** Becomes the `scan.id` on the server. */
  id: string;
  user_id: string;
  state: LocalScanState;
  /** Becomes the `media_asset.id`; a fixed id makes an interrupted upload resume the same asset. */
  photo_id: string;
  photo_uri: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  plant_part: PlantPart;
  captured_at: Timestamp;
  /** `error` exists only on a draft: a runtime failure is a UI state and is never saved or synced. */
  outcome: ScanResultState;
  /** Set when `outcome` is `error`. */
  error_code: string | null;
  disease_code: string | null;
  score: number | null;
  label_snapshot: string | null;
  label_locale: string | null;
  predictions: Prediction[];
  inference: InferenceMetadata | null;
  season_id: string | null;
  case_id: string | null;
  new_case: NewCase | null;
  mutation_id: string | null;
  /** The photo is acknowledged by the server. */
  media_done: boolean;
  /** The scan (and its new case) is acknowledged by the server. */
  meta_done: boolean;
  attempts: number;
  last_error: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
