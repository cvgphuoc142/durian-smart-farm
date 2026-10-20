import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

type RootName = keyof RootStackParamList;
type TabName = Exclude<keyof MainTabParamList, 'ScanTab'>;
export type ScreenName = Exclude<RootName, 'Main'> | TabName;

/** A link a placeholder offers so the whole app can be walked before the real screens exist. */
export type ScreenLink = {
  [K in RootName]: { to: K; params?: RootStackParamList[K] };
}[RootName];

export type ScreenKind = 'tab' | 'stack' | 'modal' | 'sheet' | 'setup';

export interface ScreenMeta {
  code: string;
  module: 'setup' | 'overview' | 'journal' | 'scan' | 'lookup' | 'more';
  kind: ScreenKind;
  /** Phase of `plan.md` that builds it. */
  phase: 2 | 3 | 4 | 5;
  /** Needs a signed-in account and the snapshot. SC-01 and SC-02 can run before either. */
  session: boolean;
  links: ScreenLink[];
}

/**
 * The 27 screens of brief §2, with the arrows of the navigation tree in §3. The real screens
 * replace the placeholders one by one; this table stays as the map.
 */
export const SCREENS: Record<ScreenName, ScreenMeta> = {
  SignIn: { code: 'SC-01', module: 'setup', kind: 'setup', phase: 5, session: false, links: [] },
  CreateFarm: {
    code: 'SC-02',
    module: 'setup',
    kind: 'setup',
    phase: 2,
    session: false,
    links: [],
  },

  SeasonOverview: {
    code: 'SC-03',
    module: 'overview',
    kind: 'tab',
    phase: 2,
    session: true,
    links: [
      { to: 'FarmManage' },
      { to: 'Expenses' },
      { to: 'Sales' },
      { to: 'Scan' },
      { to: 'AddExpense' },
    ],
  },
  FarmManage: {
    code: 'SC-04',
    module: 'overview',
    kind: 'stack',
    phase: 2,
    session: true,
    links: [],
  },
  Expenses: {
    code: 'SC-05',
    module: 'overview',
    kind: 'stack',
    phase: 2,
    session: true,
    links: [{ to: 'AddExpense' }, { to: 'AddExpense', params: { expenseId: 'demo' } }],
  },
  AddExpense: {
    code: 'SC-06',
    module: 'overview',
    kind: 'modal',
    phase: 2,
    session: true,
    links: [],
  },
  Sales: {
    code: 'SC-07',
    module: 'overview',
    kind: 'stack',
    phase: 2,
    session: true,
    links: [{ to: 'SaleDetail', params: { saleId: 'demo' } }, { to: 'AddSale' }],
  },
  SaleDetail: {
    code: 'SC-08',
    module: 'overview',
    kind: 'stack',
    phase: 2,
    session: true,
    links: [
      { to: 'AddSale', params: { saleId: 'demo' } },
      { to: 'AddSale', params: { saleId: 'demo', paymentKind: 'receipt' } },
    ],
  },
  AddSale: { code: 'SC-09', module: 'overview', kind: 'modal', phase: 2, session: true, links: [] },

  CareLogs: {
    code: 'SC-10',
    module: 'journal',
    kind: 'tab',
    phase: 2,
    session: true,
    links: [
      { to: 'AddCareLog' },
      { to: 'AddCareLog', params: { careLogId: 'demo' } },
      { to: 'Cases' },
    ],
  },
  AddCareLog: {
    code: 'SC-11',
    module: 'journal',
    kind: 'modal',
    phase: 2,
    session: true,
    links: [],
  },

  Scan: {
    code: 'SC-12',
    module: 'scan',
    kind: 'stack',
    phase: 3,
    session: true,
    links: [{ to: 'ScanResult', params: { draftId: 'demo' } }, { to: 'Cases' }],
  },
  ScanResult: {
    code: 'SC-13',
    module: 'scan',
    kind: 'stack',
    phase: 3,
    session: true,
    links: [
      { to: 'SaveScan', params: { draftId: 'demo' } },
      { to: 'Article', params: { articleId: 'demo' } },
    ],
  },
  SaveScan: {
    code: 'SC-14',
    module: 'scan',
    kind: 'stack',
    phase: 3,
    session: true,
    links: [{ to: 'Cases' }, { to: 'CaseDetail', params: { caseId: 'demo' } }, { to: 'ScanSync' }],
  },
  Cases: {
    code: 'SC-15',
    module: 'scan',
    kind: 'stack',
    phase: 3,
    session: true,
    links: [{ to: 'CaseDetail', params: { caseId: 'demo' } }],
  },
  CaseDetail: {
    code: 'SC-16',
    module: 'scan',
    kind: 'stack',
    phase: 3,
    session: true,
    links: [{ to: 'AddCareLog', params: { caseId: 'demo' } }, { to: 'AddExpense' }],
  },

  Knowledge: {
    code: 'SC-17',
    module: 'lookup',
    kind: 'tab',
    phase: 4,
    session: true,
    links: [
      { to: 'Article', params: { articleId: 'demo' } },
      { to: 'Chatbot' },
      { to: 'Standards' },
    ],
  },
  Article: { code: 'SC-18', module: 'lookup', kind: 'stack', phase: 4, session: true, links: [] },
  Chatbot: {
    code: 'SC-19',
    module: 'lookup',
    kind: 'stack',
    phase: 4,
    session: true,
    links: [
      {
        to: 'Article',
        params: { articleId: 'demo', versionId: 'v1', translationRevision: 1, locale: 'vi' },
      },
      { to: 'ReportAnswer', params: { messageId: 'demo' } },
      { to: 'Settings' },
    ],
  },
  ReportAnswer: {
    code: 'SC-20',
    module: 'lookup',
    kind: 'sheet',
    phase: 4,
    session: true,
    links: [],
  },
  Standards: { code: 'SC-21', module: 'lookup', kind: 'stack', phase: 4, session: true, links: [] },

  More: {
    code: 'SC-22',
    module: 'more',
    kind: 'tab',
    phase: 5,
    session: true,
    links: [{ to: 'Directory' }, { to: 'Settings' }, { to: 'ScanSync' }, { to: 'Account' }],
  },
  Directory: {
    code: 'SC-23',
    module: 'more',
    kind: 'stack',
    phase: 4,
    session: true,
    links: [{ to: 'ContactDetail', params: { contactId: 'demo' } }],
  },
  ContactDetail: {
    code: 'SC-24',
    module: 'more',
    kind: 'stack',
    phase: 4,
    session: true,
    links: [],
  },
  Settings: { code: 'SC-25', module: 'more', kind: 'stack', phase: 5, session: true, links: [] },
  ScanSync: { code: 'SC-26', module: 'more', kind: 'stack', phase: 3, session: true, links: [] },
  Account: { code: 'SC-27', module: 'more', kind: 'stack', phase: 5, session: true, links: [] },
};
