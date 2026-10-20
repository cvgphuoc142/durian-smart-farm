import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Header, InfoBanner, Screen } from '@/components/ui';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { spacing } from '@/theme';

/**
 * Shell of every edit form (SC-06, 09, 11): back header, sticky Save, and the 409 banner. The
 * Save button stays enabled offline; the write hook explains why nothing was sent (FR-X05).
 */
export function FormScreen({
  name,
  title,
  subtitle,
  saveLabel,
  saving,
  onSave,
  conflict,
  secondary,
  children,
}: {
  name: string;
  title: string;
  subtitle?: string;
  saveLabel?: string;
  saving?: boolean;
  onSave: () => void;
  /** The server held a newer version; the fields were reloaded from it. */
  conflict?: boolean;
  /** e.g. a Delete button under Save. */
  secondary?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  return (
    <Screen
      header={
        <Header title={title} subtitle={subtitle} variant="back" onBack={() => nav.goBack()} />
      }
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button label={saveLabel ?? t('common.save')} loading={saving} onPress={onSave} />
          {secondary}
        </View>
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, paddingTop: spacing.md }}
    >
      <View testID={`screen-${name}`}>
        {conflict ? (
          <View style={{ marginBottom: spacing.lg }}>
            <InfoBanner tone="warning" text={t('form.conflict')} />
          </View>
        ) : null}
        {children}
      </View>
    </Screen>
  );
}
