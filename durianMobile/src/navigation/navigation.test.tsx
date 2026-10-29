import { fireEvent, screen } from '@testing-library/react-native';

import { syncApi, mutation, upsert } from '@/api';
import i18n from '@/i18n';
import { SCREENS } from '@/screens';
import { useAuthStore, useContextStore } from '@/stores';
import { renderWithProviders, resetApp } from '@/test/utils';

import { RootNavigator } from './RootNavigator';

const t = (key: string) => i18n.t(key);

beforeAll(async () => {
  await i18n.changeLanguage('vi');
});

async function seedFarm() {
  await syncApi.send(
    mutation(
      upsert('farm', 'f1', { name: 'Vườn A' }, null),
      upsert('plot', 'p1', { farm_id: 'f1', name: 'Lô 1' }, null),
      upsert(
        'season',
        's1',
        { plot_id: 'p1', name: 'Vụ 2026', started_on: '2026-03-01', stage: 'fruit_growth' },
        null,
      ),
    ),
  );
  useContextStore.getState().select({ farmId: 'f1', plotId: 'p1', seasonId: 's1' });
}

describe('setup gate', () => {
  it('signed out → SC-01, sign in → SC-02, create → the tabs, all through the mock backend', async () => {
    resetApp({ signedIn: false });
    renderWithProviders(<RootNavigator />);

    await screen.findByTestId('screen-SignIn');
    fireEvent.press(screen.getByText(t('signIn.google')));

    await screen.findByTestId('screen-CreateFarm');
    expect(useAuthStore.getState().user?.id).toBe('mock-user');
    fireEvent.changeText(screen.getByLabelText(t('manage.farmName')), 'Vườn A');
    fireEvent.changeText(screen.getByLabelText(t('manage.plotName')), 'Lô 1');
    fireEvent.press(screen.getByText(t('setup.start')));

    await screen.findByTestId('screen-SeasonOverview');
    expect(useContextStore.getState().byUser['mock-user']?.farmId).toBeTruthy();
  });

  it('restores an existing account on a new phone without asking for setup (FR-X04)', async () => {
    resetApp({ signedIn: false });
    await seedFarm(); // data already on the server from an earlier phone
    useContextStore.setState({ byUser: {} });
    renderWithProviders(<RootNavigator />);

    await screen.findByTestId('screen-SignIn');
    fireEvent.press(screen.getByText(t('signIn.google')));
    await screen.findByTestId('screen-SeasonOverview');
  });
});

describe('navigation tree', () => {
  it('has the 27 screens of the brief plus the model manager, SC-01…SC-28, each once', () => {
    const codes = Object.values(SCREENS)
      .map((s) => s.code)
      .sort();
    expect(codes).toEqual(
      Array.from({ length: 28 }, (_, i) => `SC-${String(i + 1).padStart(2, '0')}`),
    );
  });
});
