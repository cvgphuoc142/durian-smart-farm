import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { mutation, syncApi, upsert } from '@/api';
import i18n from '@/i18n';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore, useContextStore } from '@/stores';
import { renderWithProviders, resetApp, TEST_USER } from '@/test/utils';

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

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

async function start() {
  resetApp();
  useAuthStore.setState({ user: { ...TEST_USER, id: 'mock-user' } });
  await seedFarm();
  renderWithProviders(<RootNavigator />);
  await screen.findByTestId('screen-SeasonOverview');
}

/** The top-most copy of a screen's text: native-stack keeps the screens below mounted. */
const press = (text: string) => fireEvent.press(screen.getAllByText(text).at(-1)!);
const type = (label: string, value: string) =>
  fireEvent.changeText(screen.getAllByLabelText(label).at(-1)!, value);
const overviewShows = (text: string) =>
  waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0));

describe('money flow on the mock backend (AC-03…05)', () => {
  it('an expense adds to "Đã chi" and shows in the ledger', async () => {
    await start();
    press(t('overview.addExpense'));
    await screen.findByTestId('screen-AddExpense');
    type(t('expense.amount'), '1500000');
    press(t('common.save'));
    await overviewShows('1.500.000 ₫');
    await waitFor(() => expect(screen.queryAllByTestId('screen-AddExpense')).toHaveLength(0));
  });

  it('refuses a zero amount and keeps the form', async () => {
    await start();
    press(t('overview.addExpense'));
    await screen.findByTestId('screen-AddExpense');
    type(t('expense.amount'), '0');
    press(t('common.save'));
    await screen.findByText(t('errors.amount_positive'));
  });

  it('a confirmed sale with a deposit shows what is still owed; a refund beyond the cash is refused', async () => {
    await start();
    press(t('overview.addSale'));
    await screen.findByTestId('screen-AddSale');
    type(t('sale.buyer'), 'Anh Ba');
    press(t('saleStatus.confirmed'));
    type(t('sale.total'), '10000000');
    type(t('sale.deposit'), '2000000');
    press(t('common.save'));
    await waitFor(() => expect(screen.queryAllByTestId('screen-AddSale')).toHaveLength(0));
    // Overview: sold 10 M, received 2 M, owed 8 M.
    await overviewShows('10.000.000 ₫');
    await overviewShows('8.000.000 ₫');

    press(t('screens.Sales'));
    await screen.findByTestId('screen-Sales');
    press('Anh Ba');
    await screen.findByTestId('screen-SaleDetail');
    press(t('sale.addPayment'));
    await screen.findByTestId('screen-AddSale');
    press(t('paymentKinds.refund'));
    type(t('expense.amount'), '3000000');
    press(t('common.save'));
    await screen.findByText(t('errors.refund_exceeds_received'));
  });
});

describe('care log', () => {
  it('fertilizing needs an input; with a cost it creates one linked expense, and deleting removes both', async () => {
    await start();
    fireEvent.press(screen.getAllByLabelText(t('tabs.journal'))[0]);
    await screen.findByTestId('screen-CareLogs');
    press(t('care.add'));
    await screen.findByTestId('screen-AddCareLog');

    press(t('common.save'));
    await screen.findByText(t('errors.input_required'));

    type(t('care.product'), 'NPK 16-16-8');
    fireEvent(screen.getAllByRole('switch').at(-1)!, 'valueChange', true);
    type(t('expense.amount'), '800000');
    press(t('common.save'));

    await waitFor(() => expect(screen.queryAllByTestId('screen-AddCareLog')).toHaveLength(0));
    const snap = await syncApi.snapshot();
    expect(snap.care_logs).toHaveLength(1);
    expect(snap.expenses).toHaveLength(1);
    expect(snap.expenses[0].care_log_id).toBe(snap.care_logs[0].id);
    expect(snap.expenses[0].amount_vnd).toBe('800000.00');

    // Open it again and delete: the dialog names the cost and removes both in one mutation.
    fireEvent.press(screen.getAllByText(/NPK 16-16-8/).at(-1)!);
    await screen.findByTestId('screen-AddCareLog');
    press(t('common.delete'));
    press(t('dialogs.deleteCareLog.confirmBoth'));
    await waitFor(async () => {
      const after = await syncApi.snapshot();
      expect(after.care_logs.every((l) => l.deleted_at)).toBe(true);
      expect(after.expenses.every((e) => e.deleted_at)).toBe(true);
    });
  });
});
