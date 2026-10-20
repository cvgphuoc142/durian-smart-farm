import { useNavigation, type NavigationProp } from '@react-navigation/native';

import type { MainTabParamList, RootStackParamList } from './types';

export function useAppNavigation() {
  return useNavigation<NavigationProp<RootStackParamList>>();
}

/** Switches to one of the tabs from any screen. */
export function openTab(
  navigation: NavigationProp<RootStackParamList>,
  tab: Exclude<keyof MainTabParamList, 'ScanTab'>,
) {
  navigation.navigate('Main', { screen: tab });
}
