import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { db } from '@/api';
import { resetDbHandle, scanRepo } from '@/db';
import i18n from '@/i18n';
import { RootNavigator } from '@/navigation/RootNavigator';
import { getDraft, useAuthStore, useContextStore, useDraftStore, useSettingsStore } from '@/stores';
import { seedSeason } from '@/test/scanFixtures';
import { renderWithProviders, resetApp, TEST_USER } from '@/test/utils';

let mockOnline = true;
jest.mock('@/hooks/useIsOnline', () => ({ useIsOnline: () => mockOnline }));

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

beforeEach(async () => {
  mockOnline = true;
  resetDbHandle();
  useSettingsStore.setState({ locale: null });
  await act(async () => {
    await i18n.changeLanguage('vi');
  });
});

afterEach(() => jest.restoreAllMocks());

async function start() {
  resetApp();
  useAuthStore.setState({ user: { ...TEST_USER, id: 'mock-user' } });
  await seedSeason();
  useContextStore.getState().select({ farmId: 'f1', plotId: 'p1', seasonId: 's1' });
  renderWithProviders(<RootNavigator />);
  await screen.findByTestId('screen-SeasonOverview');
}

const press = (text: string) => fireEvent.press(screen.getAllByText(text).at(-1)!);
const shown = (text: string) =>
  waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0));

async function openMore(row?: string) {
  fireEvent.press(screen.getAllByLabelText(t('tabs.more'))[0]);
  await screen.findByTestId('screen-More').catch(() => shown(t('more.settings')));
  if (row) press(row);
}

describe('SC-01: language and sign-in', () => {
  it('picking English switches the text at once and keeps the choice', async () => {
    resetApp({ signedIn: false });
    renderWithProviders(<RootNavigator />);
    await screen.findByTestId('screen-SignIn');

    press(t('settings.en'));
    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(useSettingsStore.getState().locale).toBe('en');
    await shown('Continue with Google');
  });

  it('a failed provider keeps the screen and the language, and shows the reason', async () => {
    resetApp({ signedIn: false });
    renderWithProviders(<RootNavigator />);
    await screen.findByTestId('screen-SignIn');
    press(t('settings.en'));
    db.sim.failWith.push({ status: 503, code: 'unavailable' });

    press('Continue with Google');
    await shown(t('signIn.failed'));
    expect(useAuthStore.getState().token).toBeNull();
    expect(useSettingsStore.getState().locale).toBe('en');
  });

  it('signing in sends the chosen language to the account', async () => {
    resetApp({ signedIn: false });
    renderWithProviders(<RootNavigator />);
    await screen.findByTestId('screen-SignIn');
    press(t('settings.en'));
    press('Continue with Google');
    await screen.findByTestId('screen-CreateFarm');
    await waitFor(() => expect(db.preferences.locale).toBe('en'));
  });
});

describe('SC-22: More', () => {
  it('opens directory, scan sync, settings and account', async () => {
    await start();
    for (const [row, screenName] of [
      [t('more.directory'), 'Directory'],
      [t('more.scanSync'), 'ScanSync'],
      [t('more.settings'), 'Settings'],
      [t('more.account'), 'Account'],
    ] as const) {
      await openMore();
      press(row);
      await waitFor(() =>
        expect(screen.getAllByTestId(`screen-${screenName}`).length).toBeGreaterThan(0),
      );
      fireEvent.press(screen.getAllByLabelText(t('common.back')).at(-1)!);
    }
  });
});

describe('SC-25: settings (AC-21, AC-22)', () => {
  it('switches the language offline and keeps drafts and ids untouched', async () => {
    await start();
    mockOnline = false;
    useDraftStore.getState().saveDraft('expense', { note: 'phân NPK' });
    await openMore(t('more.settings'));
    await screen.findByTestId('screen-Settings').catch(() => undefined);

    press(t('settings.en'));
    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(getDraft('expense')).toEqual({ note: 'phân NPK' });
    expect(useContextStore.getState().byUser['mock-user']?.seasonId).toBe('s1');
  });

  it('grants and withdraws AI consent on the server', async () => {
    await start();
    await openMore(t('more.settings'));
    const toggle = await screen.findByLabelText(t('settings.aiToggle'));

    fireEvent(toggle, 'valueChange', true);
    await waitFor(() => expect(db.preferences.ai_consent_version).toBe(1));
    fireEvent(screen.getByLabelText(t('settings.aiToggle')), 'valueChange', false);
    await waitFor(() => expect(db.preferences.ai_consent_version).toBeNull());
  });

  it('offline it refuses to change consent and says why', async () => {
    await start();
    mockOnline = false;
    await openMore(t('more.settings'));
    const toggle = await screen.findByLabelText(t('settings.aiToggle'));
    fireEvent(toggle, 'valueChange', true);
    await shown(t('errors.needsNetwork'));
    expect(db.preferences.ai_consent_version).toBeNull();
  });

  it('opens the policy link', async () => {
    await start();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openMore(t('more.settings'));
    press(t('settings.policy'));
    await waitFor(() => expect(open).toHaveBeenCalled());
  });
});

describe('SC-27: account (AC-17, AC-18)', () => {
  it('signs out and returns to sign-in', async () => {
    await start();
    await openMore(t('more.account'));
    press(t('account.signOut'));
    press(t('dialogs.signOut.confirm'));
    await screen.findByTestId('screen-SignIn');
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('warns about scans not sent, and discards them only on confirmation (FR-X10)', async () => {
    await start();
    jest.spyOn(scanRepo, 'countUnsynced').mockResolvedValue(2);
    await openMore(t('more.account'));
    await shown(t('account.unsyncedWarning', { count: 2 }));
    press(t('account.signOut'));
    await shown(t('dialogs.signOut.unsynced', { count: 2 }));
    press(t('dialogs.signOut.syncFirst'));
    expect(useAuthStore.getState().token).not.toBeNull();
  });

  it('deletes the account on the server and everything on the phone', async () => {
    await start();
    useDraftStore.getState().saveDraft('expense', { note: 'x' });
    expect(db.tables.farm.size).toBe(1);
    await openMore(t('more.account'));
    press(t('account.delete'));
    await shown(t('account.deleteTitle'));
    press(t('account.deleteConfirm'));

    await screen.findByTestId('screen-SignIn');
    expect(db.tables.farm.size).toBe(0);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useContextStore.getState().byUser['mock-user']).toBeUndefined();
    expect(useDraftStore.getState().drafts['mock-user']).toBeUndefined();
  });

  it('a failed deletion removes nothing from the phone', async () => {
    await start();
    await openMore(t('more.account'));
    press(t('account.delete'));
    db.sim.failWith.push({ status: 503, code: 'unavailable' });
    press(t('account.deleteConfirm'));

    await shown(t('account.deleteFailed'));
    expect(useAuthStore.getState().token).not.toBeNull();
    expect(useContextStore.getState().byUser['mock-user']?.farmId).toBe('f1');
    expect(db.tables.farm.size).toBe(1);
  });

  it('offline it will not start a deletion', async () => {
    await start();
    mockOnline = false;
    await openMore(t('more.account'));
    press(t('account.delete'));
    await shown(t('errors.needsNetwork'));
    expect(screen.queryAllByText(t('account.deleteTitle'))).toHaveLength(0);
  });
});
