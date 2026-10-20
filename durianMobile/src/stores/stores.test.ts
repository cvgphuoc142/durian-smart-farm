import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from './authStore';
import { useContextStore } from './contextStore';
import { draftKey, getDraft, useDraftStore } from './draftStore';
import { useSettingsStore } from './settingsStore';

const session = (id: string) => ({
  token: `t-${id}`,
  user: { id, provider: 'google' as const, display_name: id },
});

afterEach(async () => {
  await useAuthStore.getState().signOut();
  useContextStore.setState({ byUser: {} });
  useDraftStore.setState({ drafts: {} });
});

describe('authStore', () => {
  it('keeps the token in secure storage and reads it back on hydrate', async () => {
    await useAuthStore.getState().signIn(session('u1'));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth.token', 't-u1');

    useAuthStore.setState({ token: null, hydrated: false });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState()).toMatchObject({ token: 't-u1', hydrated: true });
  });

  it('clears the session on sign out', async () => {
    await useAuthStore.getState().signIn(session('u1'));
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBeNull();
  });
});

describe('contextStore', () => {
  it('keeps one context per account', async () => {
    await useAuthStore.getState().signIn(session('u1'));
    useContextStore.getState().select({ farmId: 'f1', plotId: 'p1', seasonId: 's1' });
    await useAuthStore.getState().signIn(session('u2'));
    expect(useContextStore.getState().byUser.u2).toBeUndefined();
    useContextStore.getState().set({ seasonId: 's9' });
    expect(useContextStore.getState().byUser.u1).toEqual({
      farmId: 'f1',
      plotId: 'p1',
      seasonId: 's1',
    });
    expect(useContextStore.getState().byUser.u2).toMatchObject({ seasonId: 's9', farmId: null });
  });

  it('does nothing when nobody is signed in', () => {
    useContextStore.getState().select({ farmId: 'f1', plotId: null, seasonId: null });
    expect(useContextStore.getState().byUser).toEqual({});
  });
});

describe('draftStore', () => {
  it('saves and clears a draft per form and per account', async () => {
    await useAuthStore.getState().signIn(session('u1'));
    useDraftStore.getState().saveDraft('expense', { note: 'phân' });
    expect(getDraft('expense')).toEqual({ note: 'phân' });

    await useAuthStore.getState().signIn(session('u2'));
    expect(getDraft('expense')).toBeUndefined();

    await useAuthStore.getState().signIn(session('u1'));
    useDraftStore.getState().clearDraft('expense');
    expect(getDraft('expense')).toBeUndefined();
  });

  it('separates the draft of an edited record from a new one', () => {
    expect(draftKey('expense')).toBe('expense');
    expect(draftKey('expense', 'x1')).toBe('expense:x1');
  });
});

describe('settingsStore', () => {
  it('remembers the language', () => {
    useSettingsStore.getState().setLocale('en');
    expect(useSettingsStore.getState().locale).toBe('en');
  });
});
