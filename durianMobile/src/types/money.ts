import type { DateString, Entity, Kg, Vnd } from './common';

export const EXPENSE_CATEGORIES = [
  'fertilizer',
  'plant_protection',
  'labor',
  'utilities_irrigation',
  'harvest_transport',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense extends Entity {
  season_id: string;
  /** Set when the cost was entered from a care log. Unique among live expenses. */
  care_log_id: string | null;
  occurred_on: DateString;
  category: ExpenseCategory;
  amount_vnd: Vnd;
  note: string | null;
}

export const SALE_STATUSES = ['provisional', 'confirmed', 'cancelled'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export interface Sale extends Entity {
  season_id: string;
  buyer_name: string;
  agreed_on: DateString;
  status: SaleStatus;
  /** `null` while provisional and not yet agreed. Required once confirmed. */
  total_vnd: Vnd | null;
  weight_kg: Kg | null;
  note: string | null;
}

export const PAYMENT_KINDS = ['deposit', 'receipt', 'refund'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export interface SalePayment extends Entity {
  sale_id: string;
  occurred_on: DateString;
  kind: PaymentKind;
  amount_vnd: Vnd;
  note: string | null;
}
