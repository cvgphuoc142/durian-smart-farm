/** Money in VND, `numeric(18,2)`. A decimal **string** in JSON; never a float. */
export type Vnd = string;
/** Weight in kg, `numeric(12,3)`. A decimal string. */
export type Kg = string;
/** Calendar day chosen by the farmer, `YYYY-MM-DD` (Asia/Ho_Chi_Minh). */
export type DateString = string;
/** UTC instant, ISO 8601. Shown in Asia/Ho_Chi_Minh. */
export type Timestamp = string;

/** Server-owned bookkeeping on every household row. `id` is a client-made UUID. */
export interface Entity {
  id: string;
  /** Bumped by the server on each accepted write; sent back as `expected_revision`. */
  revision: number;
  created_at: Timestamp;
  updated_at: Timestamp;
  /** Tombstone. Rows with this set are kept in the snapshot so deletes sync, and hidden in the UI. */
  deleted_at: Timestamp | null;
}

export type Locale = 'vi' | 'en';
