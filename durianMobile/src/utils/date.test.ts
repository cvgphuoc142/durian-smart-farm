import { dateOf, formatDate, formatDateTime, fromDateString, toDateString, vnDate } from './date';

describe('Asia/Ho_Chi_Minh dates', () => {
  it('moves the day at 17:00 UTC, not at midnight UTC', () => {
    expect(vnDate(Date.UTC(2026, 9, 14, 16, 59))).toBe('2026-10-14');
    expect(vnDate(Date.UTC(2026, 9, 14, 17, 0))).toBe('2026-10-15');
  });
  it('shows an instant in local time', () => {
    expect(formatDateTime('2026-10-14T17:30:00Z')).toBe('15/10/2026 00:30');
    expect(dateOf('2026-10-14T17:30:00Z')).toBe('2026-10-15');
  });
  it('round-trips a day through a Date', () => {
    expect(toDateString(fromDateString('2026-01-31'))).toBe('2026-01-31');
    expect(formatDate('2026-01-31')).toBe('31/01/2026');
  });
});
