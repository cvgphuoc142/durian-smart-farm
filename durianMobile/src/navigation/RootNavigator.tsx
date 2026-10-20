import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthGate } from '@/hooks';
import {
  AddCareLog,
  AddExpense,
  AddSale,
  Account,
  Article,
  CaseDetail,
  Cases,
  Chatbot,
  ContactDetail,
  CreateFarm,
  Directory,
  Expenses,
  FarmManage,
  ReportAnswer,
  SaleDetail,
  Sales,
  SaveScan,
  Scan,
  ScanResult,
  ScanSync,
  Settings,
  SignIn,
  Standards,
} from '@/screens';
import { colors } from '@/theme';

import { MainTabs } from './MainTabs';
import { queryScreenLayout } from './screenLayout';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
  fonts: {
    regular: { fontFamily: 'BeVietnamPro_400Regular', fontWeight: '400' as const },
    medium: { fontFamily: 'BeVietnamPro_500Medium', fontWeight: '500' as const },
    bold: { fontFamily: 'BeVietnamPro_600SemiBold', fontWeight: '600' as const },
    heavy: { fontFamily: 'BeVietnamPro_700Bold', fontWeight: '700' as const },
  },
};

export function RootNavigator() {
  const gate = useAuthGate();
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }} screenLayout={queryScreenLayout}>
        {gate === 'signedOut' ? (
          <Stack.Screen name="SignIn" component={SignIn} />
        ) : gate === 'setup' ? (
          <Stack.Screen name="CreateFarm" component={CreateFarm} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />

            <Stack.Screen name="FarmManage" component={FarmManage} />
            <Stack.Screen name="Expenses" component={Expenses} />
            <Stack.Screen name="Sales" component={Sales} />
            <Stack.Screen name="SaleDetail" component={SaleDetail} />

            <Stack.Screen
              name="Scan"
              component={Scan}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="ScanResult" component={ScanResult} />
            <Stack.Screen name="SaveScan" component={SaveScan} />
            <Stack.Screen name="Cases" component={Cases} />
            <Stack.Screen name="CaseDetail" component={CaseDetail} />

            <Stack.Screen name="Article" component={Article} />
            <Stack.Screen name="Chatbot" component={Chatbot} />
            <Stack.Screen name="Standards" component={Standards} />

            <Stack.Screen name="Directory" component={Directory} />
            <Stack.Screen name="ContactDetail" component={ContactDetail} />
            <Stack.Screen name="Settings" component={Settings} />
            <Stack.Screen name="ScanSync" component={ScanSync} />
            <Stack.Screen name="Account" component={Account} />

            <Stack.Group screenOptions={{ presentation: 'modal' }}>
              <Stack.Screen name="AddExpense" component={AddExpense} />
              <Stack.Screen name="AddSale" component={AddSale} />
              <Stack.Screen name="AddCareLog" component={AddCareLog} />
            </Stack.Group>
            <Stack.Screen
              name="ReportAnswer"
              component={ReportAnswer}
              options={{ presentation: 'formSheet', sheetAllowedDetents: [0.65, 1] }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
