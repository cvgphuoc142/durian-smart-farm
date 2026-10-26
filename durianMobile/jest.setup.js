/* eslint-env jest */
// Native modules the data layer touches. Everything else is mocked by jest-expo or the library itself.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
  };
});

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// MMKV needs the Nitro native module at import time; use a Map-backed stand-in.
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map();
    return {
      getString: (k) => store.get(k),
      set: (k, v) => void store.set(k, v),
      remove: (k) => store.delete(k),
    };
  },
}));

// Native UUID generator → Node's.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

// expo-sqlite is native. Tests run the real SQL on better-sqlite3, one in-memory database per open.
jest.mock('expo-sqlite', () => {
  const Database = require('better-sqlite3');
  const args = (params) => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
  return {
    openDatabaseAsync: async () => {
      const raw = new Database(':memory:');
      return {
        execAsync: async (sql) => void raw.exec(sql),
        runAsync: async (sql, ...params) => {
          const r = raw.prepare(sql).run(...args(params));
          return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) };
        },
        getAllAsync: async (sql, ...params) => raw.prepare(sql).all(...args(params)),
        getFirstAsync: async (sql, ...params) => raw.prepare(sql).get(...args(params)) ?? null,
        withTransactionAsync: async (task) => {
          raw.exec('BEGIN');
          try {
            await task();
            raw.exec('COMMIT');
          } catch (e) {
            raw.exec('ROLLBACK');
            throw e;
          }
        },
      };
    },
  };
});

// Google sign-in is a native module; the tests use the mock API path and never reach it.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  isCancelledResponse: (r) => r?.type === 'cancelled',
  isSuccessResponse: (r) => r?.type === 'success',
}));
