import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui';
import { useSelection } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';

/** One tap from a suspected disease to the stores and experts, filtered to the farm's province. */
export function CallExpertButton() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const { farm } = useSelection();
  return (
    <Button
      variant="outline"
      icon="phone"
      label={t('result.callExpert')}
      onPress={() => nav.navigate('Directory', { province: farm?.province ?? undefined })}
    />
  );
}
