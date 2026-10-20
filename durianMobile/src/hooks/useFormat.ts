import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Locale } from '@/types';
import { formatDate, formatDateTime, formatKg, formatVND, vnDate } from '@/utils';

/** Money, weight and date text in the UI language. A missing value reads "Chưa có", never 0. */
export function useFormat() {
  const { i18n, t } = useTranslation();
  const locale: Locale = i18n.language === 'en' ? 'en' : 'vi';
  return useMemo(() => {
    const unknown = t('common.unknown');
    return {
      locale,
      vnd: (v: string | null | undefined) => formatVND(v, locale) ?? unknown,
      kg: (v: string | null | undefined) => formatKg(v, locale) ?? unknown,
      date: (v: string | Date | null | undefined) => (v ? formatDate(v) : unknown),
      /** A UTC instant as the Vietnam calendar day: `14/10/2026`. */
      day: (v: string | null | undefined) => (v ? formatDate(vnDate(new Date(v))) : unknown),
      /** A UTC instant with the time, in Vietnam: `14/10/2026 09:30`. */
      dateTime: (v: string | null | undefined) => (v ? formatDateTime(v) : unknown),
    };
  }, [locale, t]);
}
