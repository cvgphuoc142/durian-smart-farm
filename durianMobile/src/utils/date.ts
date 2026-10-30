import type { DateString, Locale, Timestamp } from '@/types';

/** Vietnam has no daylight saving, so the zone is a fixed UTC+7. */
export const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const OFFSET_MS = 7 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar day in Vietnam for an instant (default: now). */
export function vnDate(at: Date | number = Date.now()): DateString {
  const t = new Date((at instanceof Date ? at.getTime() : at) + OFFSET_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export const today = () => vnDate();

/** A `Date` the pickers and forms use → the stored `YYYY-MM-DD` (its local calendar day). */
export function toDateString(date: Date): DateString {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` → a local `Date` at noon, so zone shifts never move the day. */
export function fromDateString(value: DateString): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * `2026-10-14` → `14/10/2026`. Accepts a `Date` (its local day) for the date picker, and a UTC
 * instant such as `opened_at` (the Vietnam day it falls on).
 */
export function formatDate(value: DateString | Timestamp | Date): string {
  const s =
    typeof value !== 'string' ? toDateString(value) : value.length > 10 ? dateOf(value) : value;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

/** UTC instant → `14/10/2026 09:30` in Asia/Ho_Chi_Minh. */
export function formatDateTime(value: Timestamp): string {
  const t = new Date(new Date(value).getTime() + OFFSET_MS);
  return `${pad(t.getUTCDate())}/${pad(t.getUTCMonth() + 1)}/${t.getUTCFullYear()} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** Instant → the Vietnam calendar day it falls on. */
export function dateOf(value: Timestamp): DateString {
  return vnDate(new Date(value));
}

/** Locale only changes words; the numbers and the day-month-year order stay the same. */
export function formatDateLong(value: DateString, _locale: Locale = 'vi'): string {
  return formatDate(value);
}
