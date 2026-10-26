import type { NavigatorScreenParams } from '@react-navigation/native';

import type { PaymentKind } from '@/types';

/**
 * The five tabs (brief §3). `ScanTab` has no screen of its own: the raised centre button opens
 * `Scan` on the root stack so the camera is full screen.
 */
export type MainTabParamList = {
  SeasonOverview: undefined;
  CareLogs: undefined;
  ScanTab: undefined;
  Knowledge: undefined;
  More: undefined;
};

/**
 * Every other screen sits on one root stack, so any screen can open any other by name and the tab
 * bar is hidden on all of them. Forms (SC-06, 09, 11) are modals; SC-20 is a sheet.
 */
export type RootStackParamList = {
  // Setup gate
  SignIn: undefined;
  CreateFarm: undefined;

  Main: NavigatorScreenParams<MainTabParamList> | undefined;

  // A. Farm and money
  FarmManage: undefined;
  Expenses: undefined;
  AddExpense: { expenseId?: string; careLogId?: string } | undefined;
  Sales: undefined;
  SaleDetail: { saleId: string };
  AddSale: { saleId?: string; paymentId?: string; paymentKind?: PaymentKind } | undefined;
  AddCareLog: { careLogId?: string; caseId?: string } | undefined;

  // B. Scan
  Scan: undefined;
  ScanResult: { draftId: string };
  SaveScan: { draftId: string };
  Cases: undefined;
  CaseDetail: { caseId: string };

  // C, D. Knowledge, chatbot, standards
  Article: {
    articleId: string;
    versionId?: string;
  };
  Chatbot: undefined;
  ReportAnswer: { messageId: string };
  Standards: { market?: 'CN' | 'EU' } | undefined;

  // E, X. Directory, settings, account
  Directory: undefined;
  ContactDetail: { contactId: string };
  Settings: undefined;
  ScanSync: undefined;
  Account: undefined;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
