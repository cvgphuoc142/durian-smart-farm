import { z } from 'zod';

import { isNonNegative, isPositive } from './money';

type T = (key: string) => string;

/** Validation messages come from i18n, so schemas are built inside the screen with its `t`. */
export const requiredText = (t: T) => z.string().trim().min(1, t('form.required'));

/** Empty is fine; anything typed must be a number ≥ 0. */
export const optionalNumber = (t: T) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || isNonNegative(v), t('form.numberInvalid'));

export const positiveAmount = (t: T) =>
  z
    .string()
    .trim()
    .min(1, t('form.required'))
    .refine((v) => v === '' || isPositive(v), t('errors.amount_positive'));

/** Form text → API value: blank becomes `null`, so "not entered" is never stored as an empty string. */
export const orNull = (value: string | null | undefined): string | null => {
  const v = value?.trim();
  return v ? v : null;
};
