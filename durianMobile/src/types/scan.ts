import type { Entity, Timestamp } from './common';

/** A body part the manifest has a complete pipeline for, e.g. `leaf`. The set comes from the manifest. */
export type PlantPart = string;

export type ScanOutcome = 'suspected' | 'healthy' | 'inconclusive';
/** What the result screen shows. `error` is UI state only; it is never saved or synced. */
export type ScanResultState = ScanOutcome | 'error';

export interface DiseaseCase extends Entity {
  season_id: string;
  opened_at: Timestamp;
  /** Set by the farmer. Inference never closes a case. */
  closed_at: Timestamp | null;
  location_note: string | null;
  note: string | null;
}

export interface Prediction {
  disease_code: string | null;
  /** Normalised to 0–1. */
  score: number;
}

export interface InferenceMetadata {
  model_id: string;
  model_version: string;
  pipeline_version: string;
  threshold_version: string;
  inference_ms: number;
}

export interface Scan extends Entity {
  season_id: string;
  case_id: string | null;
  photo_id: string;
  captured_at: Timestamp;
  plant_part: PlantPart;
  outcome: ScanOutcome;
  /** Only when the class maps to a known disease. Never invented. */
  disease_code: string | null;
  score: number | null;
  /** Name and locale at scan time, so the history does not change when labels do. */
  label_snapshot: string | null;
  label_locale: string | null;
  predictions: Prediction[];
  inference_metadata: InferenceMetadata;
}

export type MediaStatus = 'pending' | 'ready';

export interface MediaAsset extends Entity {
  owner_id: string;
  object_key: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  status: MediaStatus;
}

/** On-device state of a scan, shown by `SyncBadge` (SC-14, SC-26). */
export type ScanSyncState = 'saved_on_device' | 'sending' | 'synced' | 'error';
