import type { Sale, SalePayment } from '@/types';

import {
  formatKg,
  formatVND,
  lineTotal,
  normalizeVnd,
  parse,
  refundAllowed,
  saleBalance,
  seasonForecast,
  seasonSummary,
  sumVnd,
} from './money';

const pay = (kind: SalePayment['kind'], amount: string, sale_id = 's1') =>
  ({ sale_id, kind, amount_vnd: amount }) as Pick<SalePayment, 'sale_id' | 'kind' | 'amount_vnd'>;
const sale = (status: Sale['status'], total: string | null, id = 's1') =>
  ({ id, status, total_vnd: total }) as Pick<Sale, 'id' | 'status' | 'total_vnd'>;

describe('null is not zero', () => {
  it('parses missing input to null', () => {
    expect(parse(null)).toBeNull();
    expect(parse('')).toBeNull();
    expect(parse('abc')).toBeNull();
    expect(parse('0')?.isZero()).toBe(true);
  });
  it('keeps a missing forecast unknown, and a zero forecast known', () => {
    const none = {
      forecast_yield_kg: null,
      forecast_price_vnd_kg: '10.00',
      forecast_total_cost_vnd: '0.00',
    };
    expect(seasonForecast(none)).toEqual({ revenue: null, profit: null });
    const zero = {
      forecast_yield_kg: '0.000',
      forecast_price_vnd_kg: '10.00',
      forecast_total_cost_vnd: '0.00',
    };
    expect(seasonForecast(zero)).toEqual({ revenue: '0.00', profit: '0.00' });
  });
  it('formats null as null, not 0', () => {
    expect(formatVND(null)).toBeNull();
    expect(formatVND('0')).toBe('0 ₫');
  });
});

describe('AC-05 half-up rounding', () => {
  it('1,005 kg × 1,00 VND/kg = 1,01 VND', () => {
    expect(lineTotal('1.005', '1.00')).toBe('1.01');
  });
  it('does not drift like floats (0.1 + 0.2)', () => {
    expect(sumVnd(['0.10', '0.20'])).toBe('0.30');
  });
  it('rounds 0,005 up and 0,004 down', () => {
    expect(normalizeVnd('0.005')).toBe('0.01');
    expect(normalizeVnd('0.004')).toBe('0.00');
  });
  it('accepts a decimal comma', () => {
    expect(normalizeVnd('1234,5')).toBe('1234.50');
  });
});

describe('AC-03 deposit and receipts', () => {
  const confirmed = sale('confirmed', '100.00');
  it('revenue stays 100,00 while receivable goes 80 → 50 → 0', () => {
    const steps: [SalePayment['kind'], string][] = [];
    expect(saleBalance(confirmed, [pay('deposit', '20.00')]).receivable).toBe('80.00');
    steps.push(['deposit', '20.00'], ['receipt', '30.00']);
    expect(
      saleBalance(
        confirmed,
        steps.map(([k, a]) => pay(k, a)),
      ).receivable,
    ).toBe('50.00');
    steps.push(['receipt', '50.00']);
    const final = saleBalance(
      confirmed,
      steps.map(([k, a]) => pay(k, a)),
    );
    expect(final.receivable).toBe('0.00');
    expect(final.netReceipts).toBe('100.00');
    const summary = seasonSummary({
      expenses: [],
      sales: [confirmed],
      payments: steps.map(([k, a]) => pay(k, a)),
    });
    expect(summary.sold).toBe('100.00');
  });
  it('a retried payment is the same row, so the total does not move', () => {
    const once = [pay('deposit', '20.00')];
    // The mock backend dedupes by mutation_id; the math itself only sums the rows it is given.
    expect(saleBalance(confirmed, once).receivable).toBe('80.00');
    expect(saleBalance(confirmed, once).receivable).toBe('80.00');
  });
});

describe('AC-04 deposit before confirm, low confirm, cancel and refund', () => {
  it('a deposit on a provisional sale is cash, not revenue and not a receivable', () => {
    const s = sale('provisional', null);
    const summary = seasonSummary({
      expenses: [],
      sales: [s],
      payments: [pay('deposit', '20.00')],
    });
    expect(summary).toMatchObject({
      sold: '0.00',
      netReceived: '20.00',
      receivable: '0.00',
      refundable: '0.00',
    });
    expect(saleBalance(s, [pay('deposit', '20.00')]).receivable).toBeNull();
  });
  it('confirming below the deposit leaves a refund owed, not a receivable', () => {
    const b = saleBalance(sale('confirmed', '15.00'), [pay('deposit', '20.00')]);
    expect(b).toMatchObject({ receivable: '0.00', refundable: '5.00' });
  });
  it('cancelling owes back the whole net, and a partial refund lowers it', () => {
    const cancelled = sale('cancelled', null);
    expect(saleBalance(cancelled, [pay('deposit', '20.00')])).toMatchObject({
      receivable: '0.00',
      refundable: '20.00',
    });
    const partial = [pay('deposit', '20.00'), pay('refund', '5.00')];
    expect(saleBalance(cancelled, partial)).toMatchObject({
      netReceipts: '15.00',
      refundable: '15.00',
    });
  });
  it('refund cannot exceed deposit + receipt of the same sale', () => {
    const payments = [pay('deposit', '20.00'), pay('receipt', '30.00')];
    expect(refundAllowed(payments, '50.00')).toBe(true);
    expect(refundAllowed(payments, '50.01')).toBe(false);
    expect(refundAllowed([...payments, pay('refund', '10.00')], '40.01')).toBe(false);
  });
  it('does not offset one buyer against another', () => {
    const sales = [sale('confirmed', '100.00', 'a'), sale('cancelled', null, 'b')];
    const payments = [pay('deposit', '30.00', 'a'), pay('deposit', '40.00', 'b')];
    expect(seasonSummary({ expenses: [], sales, payments })).toMatchObject({
      receivable: '70.00',
      refundable: '40.00',
      netReceived: '70.00',
    });
  });
});

describe('season summary', () => {
  it('profit is sold minus spent, as recorded', () => {
    const summary = seasonSummary({
      expenses: [{ amount_vnd: '30.00' }, { amount_vnd: '12.50' }],
      sales: [sale('confirmed', '100.00')],
      payments: [],
    });
    expect(summary).toMatchObject({ spent: '42.50', sold: '100.00', profit: '57.50' });
  });
  it('is empty and zero with no rows (a real zero, not unknown)', () => {
    expect(seasonSummary({ expenses: [], sales: [], payments: [] })).toEqual({
      spent: '0.00',
      sold: '0.00',
      netReceived: '0.00',
      receivable: '0.00',
      refundable: '0.00',
      profit: '0.00',
    });
  });
  it('a forecast above plan stays separate from actuals', () => {
    const f = seasonForecast({
      forecast_yield_kg: '1000.000',
      forecast_price_vnd_kg: '50.50',
      forecast_total_cost_vnd: '60000.00',
    });
    expect(f).toEqual({ revenue: '50500.00', profit: '-9500.00' });
  });
});

describe('display', () => {
  it('groups and trims per locale', () => {
    expect(formatVND('1234567.50')).toBe('1.234.567,5 ₫');
    expect(formatVND('1234567.50', 'en')).toBe('1,234,567.5 ₫');
    expect(formatVND('-5.00')).toBe('−5 ₫');
    expect(formatVND('100.00')).toBe('100 ₫');
  });
  it('formats kg', () => {
    expect(formatKg('1.005')).toBe('1,005 kg');
    expect(formatKg('12.000')).toBe('12 kg');
  });
});
