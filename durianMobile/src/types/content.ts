import type { DateString, Entity, Locale, Timestamp } from './common';

export interface Disease {
  code: string;
  /** Display names per locale. The code does not change with the language. */
  names: Partial<Record<Locale, string>>;
}

export interface Article {
  id: string;
  version_id: string;
  version_no: number;
  /** Revision of the translation shown. Citations point at this exact revision. */
  translation_revision: number;
  locale: Locale;
  /** The version has no translation for the UI language, so the source text is shown. */
  is_fallback: boolean;
  source_locale: Locale;
  title: string;
  body: string;
  category: string | null;
  disease_code: string | null;
  plant_parts: string[];
  stages: string[];
  source_links: string[];
  published_at: Timestamp;
}

export interface StandardItem {
  id: string;
  item_key: string;
  sort_order: number;
  title: string;
  body: string;
  source_link: string;
  source_checked_at: Timestamp;
}

export interface StandardVersion {
  id: string;
  profile_id: string;
  version_no: number;
  effective_on: DateString | null;
  source_locale: Locale;
  locale: Locale;
  is_fallback: boolean;
  source_links: string[];
  items: StandardItem[];
}

export interface StandardProfile {
  id: string;
  /** `CN` or `EU`. Stable codes. */
  market_code: string;
  /** `fresh` for the first build. */
  product_form_code: string;
  name: string;
  published_version_id: string | null;
}

/** One tick. Answers travel inside the `self_check` row, so one mutation saves the whole list. */
export interface SelfCheckAnswer {
  standard_item_id: string;
  checked: boolean;
  checked_at: Timestamp | null;
}

/** One checklist per season and standard version. Locale is not part of the key. */
export interface SelfCheck extends Entity {
  season_id: string;
  standard_version_id: string;
  answers: SelfCheckAnswer[];
}

export type ContactKind = 'store' | 'expert';

export interface Contact {
  id: string;
  kind: ContactKind;
  name: string;
  province: string | null;
  locality: string | null;
  address: string | null;
  phone: string | null;
  zalo: string | null;
  contact_url: string | null;
  source_link: string | null;
  verified_at: Timestamp | null;
  description: string | null;
  specialty: string | null;
}

export interface ContentManifest {
  release_no: number;
  schema_version: number;
  available_locales: Locale[];
  checksum: string;
  created_at: Timestamp;
}

/** A whole published release. Swapped in atomically; a failed download keeps the previous one. */
export interface ContentRelease extends ContentManifest {
  diseases: Disease[];
  articles: Article[];
  standard_profiles: StandardProfile[];
  standard_versions: StandardVersion[];
  contacts: Contact[];
  /** IDs removed since the last release. */
  tombstones: string[];
}
