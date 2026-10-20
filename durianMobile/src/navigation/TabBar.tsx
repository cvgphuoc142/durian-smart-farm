import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Text, type IconName } from '@/components/ui';
import { colors, shadows, sizes } from '@/theme';

import type { MainTabParamList } from './types';

const tabs: Record<keyof MainTabParamList, { icon: IconName; label: string }> = {
  SeasonOverview: { icon: 'home', label: 'tabs.overview' },
  CareLogs: { icon: 'file', label: 'tabs.journal' },
  ScanTab: { icon: 'scan', label: 'tabs.scan' },
  Knowledge: { icon: 'search', label: 'tabs.lookup' },
  More: { icon: 'menu', label: 'tabs.more' },
};

const RAISE = 30;
const RING = 4;

/** Design tab bar: 5 items, the centre Scan button raised 30px in a 62px circle with a 4px ring. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.bar, { height: sizes.tabBar + insets.bottom, paddingBottom: insets.bottom }]}
    >
      {state.routes.map((route, index) => {
        const tab = tabs[route.name as keyof MainTabParamList];
        const isFocused = state.index === index;
        const isScan = route.name === 'ScanTab';
        const color = isFocused && !isScan ? 'primary' : 'iconMuted';

        const onPress = () => {
          if (isScan) {
            navigation.getParent()?.navigate('Scan');
            return;
          }
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            style={styles.item}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={t(tab.label)}
          >
            {isScan ? (
              <View style={styles.scanButton}>
                <Icon name={tab.icon} size={28} color="white" />
              </View>
            ) : (
              <Icon name={tab.icon} size={24} color={color} />
            )}
            <Text
              variant="tabLabel"
              color={isScan ? 'primary' : color}
              style={[isFocused && !isScan && styles.active, isScan && styles.scanLabel]}
            >
              {t(tab.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    minHeight: sizes.tabItem,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  active: { fontWeight: '700' },
  scanButton: {
    width: sizes.scanButton,
    height: sizes.scanButton,
    borderRadius: sizes.scanButton / 2,
    backgroundColor: colors.primary,
    borderWidth: RING,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -RAISE,
    ...shadows.scan,
  },
  scanLabel: { fontWeight: '700' },
});
