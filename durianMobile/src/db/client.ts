import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './migrations';

/** The slice of `expo-sqlite` the repositories use, so tests can stand in a different engine. */
export type Db = Pick<
  SQLite.SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'withTransactionAsync'
>;

export const DB_NAME = 'durian.db';

let opening: Promise<Db> | null = null;

async function migrate(db: Db) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (let n = version; n < MIGRATIONS.length; n++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[n]);
      await db.execAsync(`PRAGMA user_version = ${n + 1}`);
    });
    version = n + 1;
  }
}

/** Opens the local database once and brings its schema up to date. */
export function getDb(): Promise<Db> {
  opening ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await migrate(db);
    return db;
  })().catch((e) => {
    opening = null;
    throw e;
  });
  return opening;
}

/** Tests only: forget the open handle so the next call starts a fresh database. */
export function resetDbHandle() {
  opening = null;
}
