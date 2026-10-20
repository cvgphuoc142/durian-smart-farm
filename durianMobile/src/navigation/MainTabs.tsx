import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { CareLogs, Knowledge, More, SeasonOverview } from '@/screens';

import { queryScreenLayout } from './screenLayout';
import { TabBar } from './TabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Never rendered: the centre button opens `Scan` on the root stack instead. */
const ScanTabStub = () => null;

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      screenLayout={queryScreenLayout}
    >
      <Tab.Screen name="SeasonOverview" component={SeasonOverview} />
      <Tab.Screen name="CareLogs" component={CareLogs} />
      <Tab.Screen name="ScanTab" component={ScanTabStub} />
      <Tab.Screen name="Knowledge" component={Knowledge} />
      <Tab.Screen name="More" component={More} />
    </Tab.Navigator>
  );
}
