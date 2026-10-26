/**
 * One entry per schema version, applied in order and never edited after release.
 * Everything is keyed by `user_id` so a second account on the same phone sees nothing of the first.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE scan_local (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    state TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    photo_uri TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    plant_part TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    outcome TEXT NOT NULL,
    error_code TEXT,
    disease_code TEXT,
    score REAL,
    label_snapshot TEXT,
    label_locale TEXT,
    predictions TEXT NOT NULL,
    inference TEXT,
    season_id TEXT,
    case_id TEXT,
    new_case TEXT,
    mutation_id TEXT,
    media_done INTEGER NOT NULL DEFAULT 0,
    meta_done INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX scan_local_user ON scan_local (user_id, created_at);

  -- The immutable mutation of a saved scan. A row leaves only when the server acknowledged it.
  CREATE TABLE outbox (
    mutation_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    scan_id TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Last farm / plot / season / open case rows the server sent, so a scan can be saved offline.
  CREATE TABLE read_cache (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  `,
  // The content pack: public text, not tied to an account. It is replaced as a whole by one
  // transaction, so a download that fails half way leaves the previous release untouched.
  `
  CREATE TABLE content_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE content_disease (
    code TEXT PRIMARY KEY NOT NULL,
    names TEXT NOT NULL
  );

  -- One row per article version, language and translation revision.
  CREATE TABLE content_article (
    rid INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    locale TEXT NOT NULL,
    translation_revision INTEGER NOT NULL,
    source_locale TEXT NOT NULL,
    is_fallback INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT,
    disease_code TEXT,
    plant_parts TEXT NOT NULL,
    stages TEXT NOT NULL,
    source_links TEXT NOT NULL,
    published_at TEXT NOT NULL,
    UNIQUE (article_id, version_id, locale, translation_revision)
  );
  CREATE INDEX content_article_id ON content_article (article_id);
  -- Text folded to lower case without diacritics; rowid = content_article.rid.
  CREATE VIRTUAL TABLE content_article_fts USING fts5(text);

  CREATE TABLE content_standard_profile (
    id TEXT PRIMARY KEY NOT NULL,
    json TEXT NOT NULL
  );
  CREATE TABLE content_standard_version (
    id TEXT NOT NULL,
    locale TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    json TEXT NOT NULL,
    PRIMARY KEY (id, locale)
  );

  CREATE TABLE content_contact (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    province TEXT,
    folded TEXT NOT NULL,
    json TEXT NOT NULL
  );

  -- Versions the farmer once ticked or was cited are kept when a release drops them.
  CREATE TABLE content_pin (
    kind TEXT NOT NULL,
    key TEXT NOT NULL,
    PRIMARY KEY (kind, key)
  );
  `,
  // Articles, standards and contacts are one text, not one per language. The pack is public and
  // re-downloadable, so the tables are rebuilt and `content_meta` cleared to force a fresh release.
  `
  DROP TABLE content_article_fts;
  DROP TABLE content_article;
  DROP TABLE content_standard_version;
  DELETE FROM content_meta;
  DELETE FROM content_pin;

  CREATE TABLE content_article (
    rid INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT,
    disease_code TEXT,
    plant_parts TEXT NOT NULL,
    stages TEXT NOT NULL,
    source_links TEXT NOT NULL,
    published_at TEXT NOT NULL,
    UNIQUE (article_id, version_id)
  );
  CREATE INDEX content_article_id ON content_article (article_id);
  -- Text folded to lower case without diacritics; rowid = content_article.rid.
  CREATE VIRTUAL TABLE content_article_fts USING fts5(text);

  CREATE TABLE content_standard_version (
    id TEXT PRIMARY KEY NOT NULL,
    profile_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    json TEXT NOT NULL
  );
  `,
];
