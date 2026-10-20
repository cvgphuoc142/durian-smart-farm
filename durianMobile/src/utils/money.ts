import { Decimal } from 'decimal.js';

import type { Expense, Kg, Locale, Sale, SalePayment, Season, Vnd } from '@/types';

/**
 * One decimal context for the whole app: half-up rounding, no floats. The backend applies the same
 * rules, so a number computed here matches the server after sync.
 */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

const VND_DP = 2;
const KG_DP = 3;

/** `null`, empty or unparsable → `null`. Never 0: "not known" and "zero" are different facts. */
export function parse(value: string | null | undefined): Dec | null {
  if (value == null || value.trim() === '') return null;
  try {
    const d = new D(value.trim().replace(/,/g, '.'));
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

const dec = (value: string | null): Dec => parse(value) ?? new D(0);

export const isMoney = (value: string | null | undefined) => parse(value) != null;
export const isPositive = (value: string | null | undefined) => parse(value)?.gt(0) ?? false;
export const isNonNegative = (value: string | null | undefined) => parse(value)?.gte(0) ?? false;

/** Rounds to 0,01 VND (half-up) and returns the JSON string form. */
export function toVnd(d: Dec): Vnd {
  return d.toDecimalPlaces(VND_DP, Decimal.ROUND_HALF_UP).toFixed(VND_DP);
}

export function toKg(d: Dec): Kg {
  return d.toDecimalPlaces(KG_DP, Decimal.ROUND_HALF_UP).toFixed(KG_DP);
}

/** Normalises a typed amount to the canonical 2-decimal string, or `null` if it is not a number. */
export function normalizeVnd(value: string | null | undefined): Vnd | null {
  const d = parse(value);
  return d ? toVnd(d) : null;
}

export function normalizeKg(value: string | null | undefined): Kg | null {
  const d = parse(value);
  return d ? toKg(d) : null;
}

export const addVnd = (a: Vnd, b: Vnd): Vnd => toVnd(dec(a).plus(dec(b)));
export const subVnd = (a: Vnd, b: Vnd): Vnd => toVnd(dec(a).minus(dec(b)));
export const sumVnd = (values: readonly Vnd[]): Vnd =>
  toVnd(values.reduce<Dec>((acc, v) => acc.plus(dec(v)), new D(0)));

/** kg × VND/kg, rounded once at the end: 1,005 kg × 1,00 = 1,01. `null` if either input is missing. */
export function lineTotal(kg: Kg | null, pricePerKg: Vnd | null): Vnd | null {
  const k = parse(kg);
  const p = parse(pricePerKg);
  return k && p ? toVnd(k.times(p)) : null;
}

const nonNeg = (d: Dec) => (d.isNegative() ? new D(0) : d);

// --- Sale balances ---------------------------------------------------------------------------

export interface SaleBalance {
  /** deposit + receipt − refund of this sale. */
  netReceipts: Vnd;
  /** Still owed by the buyer. `null` while the total is not agreed (provisional). */
  receivable: Vnd | null;
  /** Owed back to the buyer. */
  refundable: Vnd;
  /** Refunding more than this would break the rule `refund ≤ deposit + receipt`. */
  refundableLimit: Vnd;
}

/** Cash is netted per sale only; buyers are never offset against each other. */
export function saleBalance(
  sale: Pick<Sale, 'status' | 'total_vnd'>,
  payments: readonly Pick<SalePayment, 'kind' | 'amount_vnd'>[],
): SaleBalance {
  let received = new D(0);
  let refunded = new D(0);
  for (const p of payments) {
    if (p.kind === 'refund') refunded = refunded.plus(dec(p.amount_vnd));
    else received = received.plus(dec(p.amount_vnd));
  }
  const net = received.minus(refunded);

  let receivable: Dec | null;
  let refundable: Dec;
  if (sale.status === 'cancelled') {
    receivable = new D(0);
    refundable = nonNeg(net);
  } else if (sale.status === 'confirmed') {
    const total = dec(sale.total_vnd);
    receivable = nonNeg(total.minus(net));
    refundable = nonNeg(net.minus(total));
  } else {
    // Provisional: nothing agreed yet, so no debt either way. The deposit is just cash held.
    receivable = null;
    refundable = new D(0);
  }

  return {
    netReceipts: toVnd(net),
    receivable: receivable ? toVnd(receivable) : null,
    refundable: toVnd(refundable),
    refundableLimit: toVnd(received.minus(refunded)),
  };
}

/** True if adding a refund of `amount` keeps refunds within deposit + receipt of the sale. */
export function refundAllowed(
  payments: readonly Pick<SalePayment, 'kind' | 'amount_vnd'>[],
  amount: Vnd,
): boolean {
  return dec(amount).lte(
    dec(saleBalance({ status: 'provisional', total_vnd: null }, payments).refundableLimit),
  );
}

// --- Season summary --------------------------------------------------------------------------

export interface SeasonSummary {
  /** Sum of expenses. */
  spent: Vnd;
  /** Sum of `total_vnd` of confirmed sales. Deposits do not count as revenue. */
  sold: Vnd;
  /** deposit + receipt − refund over every sale of the season. */
  netReceived: Vnd;
  /** Sum of confirmed receivables. */
  receivable: Vnd;
  /** Sum of confirmed and cancelled refunds owed. */
  refundable: Vnd;
  /** sold − spent, as recorded. Not a forecast. */
  profit: Vnd;
}

export interface SeasonForecast {
  /** yield × price, rounded. `null` if either is missing. */
  revenue: Vnd | null;
  /** revenue − forecast cost. `null` if any of the three is missing. */
  profit: Vnd | null;
}

export function seasonSummary(input: {
  expenses: readonly Pick<Expense, 'amount_vnd'>[];
  sales: readonly Pick<Sale, 'id' | 'status' | 'total_vnd'>[];
  payments: readonly Pick<SalePayment, 'sale_id' | 'kind' | 'amount_vnd'>[];
}): SeasonSummary {
  const spent = new D(sumVnd(input.expenses.map((e) => e.amount_vnd)));
  let sold = new D(0);
  let net = new D(0);
  let receivable = new D(0);
  let refundable = new D(0);
  for (const sale of input.sales) {
    const balance = saleBalance(
      sale,
      input.payments.filter((p) => p.sale_id === sale.id),
    );
    if (sale.status === 'confirmed') sold = sold.plus(dec(sale.total_vnd));
    net = net.plus(dec(balance.netReceipts));
    receivable = receivable.plus(dec(balance.receivable));
    refundable = refundable.plus(dec(balance.refundable));
  }
  return {
    spent: toVnd(spent),
    sold: toVnd(sold),
    netReceived: toVnd(net),
    receivable: toVnd(receivable),
    refundable: toVnd(refundable),
    profit: toVnd(sold.minus(spent)),
  };
}

/** The three forecast numbers stand on their own; they never feed `seasonSummary`. */
export function seasonForecast(
  season: Pick<Season, 'forecast_yield_kg' | 'forecast_price_vnd_kg' | 'forecast_total_cost_vnd'>,
): SeasonForecast {
  const revenue = lineTotal(season.forecast_yield_kg, season.forecast_price_vnd_kg);
  const cost = parse(season.forecast_total_cost_vnd);
  return {
    revenue,
    profit: revenue && cost ? toVnd(dec(revenue).minus(cost)) : null,
  };
}

// --- Display ---------------------------------------------------------------------------------

function group(intPart: string, sep: string) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

const NBSP = ' ';

/**
 * `1234567.5` → `1.234.567,5 ₫` (vi) / `1,234,567.5 ₫` (en). Decimals only when there is a fraction.
 * `null` stays `null` so the screen can say "chưa có dự kiến" instead of showing 0.
 */
export function formatVND(value: Vnd | null | undefined, locale: Locale = 'vi'): string | null {
  const d = parse(value);
  if (!d) return null;
  const fixed = d.abs().toFixed(VND_DP);
  const [int, frac] = fixed.split('.');
  const [thousands, decimal] = locale === 'vi' ? ['.', ','] : [',', '.'];
  const fraction = frac === '00' ? '' : `${decimal}${frac.replace(/0$/, '')}`;
  const sign = d.isNegative() && !d.isZero() ? '−' : '';
  return `${sign}${group(int, thousands)}${fraction}${NBSP}₫`;
}

/** `1.005` → `1,005 kg`, `12` → `12 kg`. */
export function formatKg(value: Kg | null | undefined, locale: Locale = 'vi'): string | null {
  const d = parse(value);
  if (!d) return null;
  const [int, frac = ''] = d.abs().toFixed(KG_DP).split('.');
  const trimmed = frac.replace(/0+$/, '');
  const [thousands, decimal] = locale === 'vi' ? ['.', ','] : [',', '.'];
  const sign = d.isNegative() && !d.isZero() ? '−' : '';
  return `${sign}${group(int, thousands)}${trimmed ? `${decimal}${trimmed}` : ''}${NBSP}kg`;
}

// --- Input ----------------------------------------------------------------------------------

/**
 * What the user sees while typing: `1234567` → `1.234.567`, `1234,5` → `1.234,5`. The form keeps the
 * canonical raw string (`1234567`, `1234.5`), so `parse` and the backend never see separators.
 */
export function formatMoneyInput(raw: string | null | undefined): string {
  if (!raw) return '';
  const [int, frac] = raw.split('.');
  return `${group(int, '.')}${frac !== undefined ? `,${frac}` : ''}`;
}

/** Typed text → raw string. `.` is always a thousands separator, `,` the decimal mark. */
export function parseMoneyInput(text: string, maxDecimals = VND_DP): string {
  const [intPart, ...rest] = text.replace(/\./g, '').split(',');
  const int = intPart.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (rest.length === 0) return int;
  const frac = rest.join('').replace(/\D/g, '').slice(0, maxDecimals);
  return maxDecimals > 0 ? `${int || '0'}.${frac}` : int;
}
