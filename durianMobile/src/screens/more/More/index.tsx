import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Header, ListGroup, ListRow, Screen } from '@/components/ui';
import { useUnsyncedScanCount } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { spacing } from '@/theme';

/** SC-22: the fifth tab. A short menu to the places that are not part of the daily loop. */
export function More() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const waiting = useUnsyncedScanCount();

  return (
    <Screen
      withTabBar
      header={<Header title={t('screens.More')} />}
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}
    >
      <View testID="screen-More" style={{ gap: spacing.md }}>
        <ListGroup>
          <ListRow
            title={t('more.farm')}
            leading={{ type: 'tile', icon: 'sprout', tone: 'primary' }}
            onPress={() => nav.navigate('FarmManage')}
          />
          <ListRow
            title={t('more.directory')}
            subtitle={t('more.directoryHint')}
            leading={{ type: 'tile', icon: 'users', tone: 'info' }}
            onPress={() => nav.navigate('Directory')}
          />
        </ListGroup>
        <ListGroup>
          <ListRow
            title={t('more.settings')}
            subtitle={t('more.settingsHint')}
            leading={{ type: 'tile', icon: 'settings', tone: 'neutral' }}
            onPress={() => nav.navigate('Settings')}
          />
          <ListRow
            title={t('more.account')}
            leading={{ type: 'tile', icon: 'user', tone: 'neutral' }}
            onPress={() => nav.navigate('Account')}
          />
          <ListRow
            title={t('more.scanSync')}
            leading={{ type: 'tile', icon: 'cloud', tone: 'neutral' }}
            trailing={
              waiting > 0 ? (
                <Badge label={t('more.scanSyncWaiting', { count: waiting })} tone="warning" />
              ) : (
                <Badge label={t('more.scanSyncAllSent')} tone="primary" />
              )
            }
            onPress={() => nav.navigate('ScanSync')}
          />
        </ListGroup>
      </View>
    </Screen>
  );
}
