import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Header, type HeaderProps } from '@/components/ui';
import { useSeasonData } from '@/hooks';

import { ContextPickerSheet } from './ContextPickerSheet';

/** A header whose subtitle "Lô A · Vụ 2026 ▾" switches the season from right here. */
export function SeasonHeader(props: Omit<HeaderProps, 'subtitle' | 'onSubtitlePress'>) {
  const { t } = useTranslation();
  const { plot, season } = useSeasonData();
  const [picking, setPicking] = useState(false);
  const subtitle = season ? [plot?.name, season.name].filter(Boolean).join(' · ') : undefined;
  return (
    <>
      <Header
        {...props}
        subtitle={subtitle}
        subtitleLabel={t('context.title')}
        onSubtitlePress={() => setPicking(true)}
      />
      <ContextPickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        selectedSeasonId={season?.id ?? null}
      />
    </>
  );
}
