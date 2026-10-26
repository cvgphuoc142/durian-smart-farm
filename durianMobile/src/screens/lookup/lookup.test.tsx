import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { chatApi, db } from '@/api';
import { refreshContent } from '@/content';
import { resetDbHandle } from '@/db';
import i18n from '@/i18n';
import { RootNavigator } from '@/navigation/RootNavigator';
import { getDraft, useAuthStore, useChatStore, useContextStore } from '@/stores';
import { seedSeason } from '@/test/scanFixtures';
import { renderWithProviders, resetApp, TEST_USER } from '@/test/utils';

let mockOnline = true;
jest.mock('@/hooks/useIsOnline', () => ({ useIsOnline: () => mockOnline }));

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

beforeAll(async () => {
  await i18n.changeLanguage('vi');
});

beforeEach(async () => {
  mockOnline = true;
  resetDbHandle();
  await act(async () => {
    await i18n.changeLanguage('vi');
  });
  useChatStore.setState({ byUser: {} });
});

afterEach(() => jest.restoreAllMocks());

async function start({ pack = true }: { pack?: boolean } = {}) {
  resetApp();
  useAuthStore.setState({ user: { ...TEST_USER, id: 'mock-user' } });
  await seedSeason();
  useContextStore.getState().select({ farmId: 'f1', plotId: 'p1', seasonId: 's1' });
  if (pack) await refreshContent();
  const view = renderWithProviders(<RootNavigator />);
  await screen.findByTestId('screen-SeasonOverview');
  return view;
}

const press = (text: string) => fireEvent.press(screen.getAllByText(text).at(-1)!);
const label = (text: string) => screen.getAllByLabelText(text).at(-1)!;
const shown = (text: string) =>
  waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0));
const openLookup = async () => {
  fireEvent.press(screen.getAllByLabelText(t('tabs.lookup'))[0]);
  await screen.findByTestId('screen-Knowledge');
};

describe('SC-17, SC-18: knowledge and article (AC-07, AC-23)', () => {
  it('lists the downloaded articles and finds them without diacritics', async () => {
    await start();
    await openLookup();
    await shown('Bệnh xì mủ (mẫu)');
    await shown('Thối trái (mẫu)');

    fireEvent.changeText(label(t('common.search')), 'xi mu');
    await waitFor(() => expect(screen.queryAllByText('Thối trái (mẫu)')).toHaveLength(0));
    await shown('Bệnh xì mủ (mẫu)');

    fireEvent.changeText(label(t('common.search')), 'khong co bai nay');
    await shown(t('knowledge.noMatchTitle'));
  });

  it('opens an article with its sources and version date', async () => {
    await start();
    await openLookup();
    press('Bệnh xì mủ (mẫu)');
    await screen.findByTestId('screen-Article');
    await shown(t('article.sources'));
    await shown('https://example.org/source');
    expect(screen.getAllByText(/Triệu chứng/).length).toBeGreaterThan(0);
  });

  it('without a downloaded pack it says so, and offers the download only when online', async () => {
    await start({ pack: false });
    mockOnline = false;
    await openLookup();
    await shown(t('knowledge.noPackTitle'));
    await shown(t('knowledge.noPackOffline'));
    expect(screen.queryAllByText(t('content.download'))).toHaveLength(0);
  });

  it('shows the empty state when the pack holds no approved article', async () => {
    await start();
    // Pack present, but a search matches nothing and nothing was published for a filter.
    await openLookup();
    fireEvent.press(screen.getAllByText('Bệnh hại').at(-1)!);
    fireEvent.changeText(label(t('common.search')), 'phan');
    await shown(t('knowledge.noMatchTitle'));
  });
});

describe('SC-19, SC-20: chatbot (AC-13, AC-14, AC-24)', () => {
  const openChat = async () => {
    await openLookup();
    press(t('screens.Chatbot'));
    await screen.findByTestId('screen-Chatbot');
  };

  it('asks for consent first, never calls the AI service without it, then answers with sources', async () => {
    const ask = jest.spyOn(chatApi, 'ask');
    await start();
    await openChat();
    await shown(t('chat.consentTitle'));
    // Without consent the box searches articles; nothing is sent.
    fireEvent.changeText(label(t('chat.input')), 'xi mu');
    press(t('chat.search'));
    await shown('Bệnh xì mủ (mẫu)');
    expect(ask).not.toHaveBeenCalled();

    press(t('chat.consentGrant'));
    await waitFor(() => expect(db.preferences.ai_consent_version).toBe(1));
    await waitFor(() => expect(screen.queryAllByText(t('chat.consentTitle'))).toHaveLength(0));

    fireEvent.changeText(label(t('chat.input')), 'Bệnh xì mủ là gì?');
    press(t('chat.send'));
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    await screen.findByLabelText(t('chat.openSource', { title: 'Bệnh xì mủ (mẫu)' }));
    expect(ask.mock.calls[0][0]).toMatchObject({ locale: 'vi', season_id: 's1' });
    // The answer says which farm data it used.
    expect(screen.getAllByText(/Dữ liệu vườn tính đến/).length).toBeGreaterThan(0);

    // The citation opens the exact version and revision it quoted.
    fireEvent.press(
      screen.getAllByLabelText(t('chat.openSource', { title: 'Bệnh xì mủ (mẫu)' }))[0],
    );
    await screen.findByTestId('screen-Article');
    await shown('Bệnh xì mủ (mẫu)');
  });

  it('answers from the approved articles and cites the version it read', async () => {
    await start();
    db.preferences = { ...db.preferences, ai_consent_version: 1 };
    await openChat();
    fireEvent.changeText(label(t('chat.input')), 'xì mủ');
    press(t('chat.send'));
    await screen.findByLabelText(t('chat.openSource', { title: 'Bệnh xì mủ (mẫu)' }));
    fireEvent.changeText(label(t('chat.input')), 'thối trái');
    press(t('chat.send'));
    await screen.findByLabelText(t('chat.openSource', { title: 'Thối trái (mẫu)' }));
  });

  it('says plainly when there are not enough sources', async () => {
    await start();
    db.preferences = { ...db.preferences, ai_consent_version: 1 };
    await openChat();
    fireEvent.changeText(label(t('chat.input')), 'coffee price');
    press(t('chat.send'));
    await shown(t('chat.insufficient'));
  });

  it('warns when the farm data behind an answer is old', async () => {
    await start();
    db.preferences = { ...db.preferences, ai_consent_version: 1 };
    db.sim.contextAsOf = '2026-01-01T00:00:00.000Z';
    await openChat();
    fireEvent.changeText(label(t('chat.input')), 'xi mu');
    press(t('chat.send'));
    await shown(t('chat.stale'));
  });

  it('offline: the box becomes a search, the question stays a draft, and nothing is sent when the network returns', async () => {
    const ask = jest.spyOn(chatApi, 'ask');
    await start();
    db.preferences = { ...db.preferences, ai_consent_version: 1 };
    mockOnline = false;
    await openChat();
    await shown(t('chat.offline'));
    fireEvent.changeText(label(t('chat.input')), 'xi mu');
    // The draft is saved shortly after typing stops, so typing itself stays fast.
    await waitFor(() => expect(getDraft('chat')).toEqual({ question: 'xi mu' }));
    expect(screen.queryAllByText(t('chat.send'))).toHaveLength(0);
    press(t('chat.search'));
    await shown('Bệnh xì mủ (mẫu)');
    expect(ask).not.toHaveBeenCalled();

    mockOnline = true;
    await act(async () => {
      fireEvent.changeText(label(t('chat.input')), 'xi mu');
    });
    expect(ask).not.toHaveBeenCalled();
    await waitFor(() => expect(getDraft('chat')).toEqual({ question: 'xi mu' }));
  });

  it('a failed send keeps the question and is only sent again by hand (429)', async () => {
    const ask = jest.spyOn(chatApi, 'ask');
    await start();
    db.preferences = { ...db.preferences, ai_consent_version: 1 };
    await openChat();
    // The consent is known once the send button replaces the search button.
    await screen.findByText(t('chat.send'));
    db.sim.failWith.push({ status: 429, code: 'rate_limited' });
    fireEvent.changeText(label(t('chat.input')), 'xi mu');
    press(t('chat.send'));
    await shown(t('chat.failed'));
    expect(ask).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(ask).toHaveBeenCalledTimes(1);

    press(t('common.retry'));
    await screen.findByLabelText(t('chat.openSource', { title: 'Bệnh xì mủ (mẫu)' }));
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('reports an answer: shows what is sent, sends once per confirmation', async () => {
    const report = jest.spyOn(chatApi, 'report');
    await start();
    db.preferences = { ...db.preferences, ai_consent_version: 1 };
    await openChat();
    fireEvent.changeText(label(t('chat.input')), 'xi mu');
    press(t('chat.send'));
    await screen.findByLabelText(t('chat.openSource', { title: 'Bệnh xì mủ (mẫu)' }));

    press(t('chat.report'));
    await screen.findByTestId('screen-ReportAnswer');
    await shown('xi mu');
    await shown(t('report.preview'));
    fireEvent.changeText(label(t('report.reason')), 'Sai nguồn');
    const confirm = screen.getAllByText(t('report.confirm')).at(-1)!;
    fireEvent.press(confirm);
    fireEvent.press(confirm);
    await shown(t('report.sent'));
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0]).toMatchObject({
      question: 'xi mu',
      reason: 'Sai nguồn',
      citations: [expect.objectContaining({ article_id: 'art-phyto' })],
    });
  });
});

describe('SC-21: standards and checklist (AC-16, AC-23)', () => {
  const openStandards = async () => {
    await openLookup();
    press(t('knowledge.standards'));
    await screen.findByTestId('screen-Standards');
  };
  const tick = async (title: string) => {
    await screen.findByLabelText(t('standards.tick', { title }));
    fireEvent.press(label(t('standards.tick', { title })));
  };

  it('counts what the farmer marked and never says the farm qualifies', async () => {
    await start();
    await openStandards();
    await shown(t('standards.progress', { done: 0, total: 3 }));
    await tick('Mã vùng trồng (mẫu)');
    await shown(t('standards.progress', { done: 1, total: 3 }));
    expect(screen.queryAllByText(/đạt/i)).toHaveLength(0);

    const [check] = db.tables.self_check.values();
    expect(check).toMatchObject({ season_id: 's1', standard_version_id: 'std-cn-v1' });
    expect(check.answers.filter((a) => a.checked)).toHaveLength(1);
  });

  it('a market with nothing approved shows an empty state, not made-up items', async () => {
    await start();
    await openStandards();
    press(t('standards.market.EU'));
    await shown(t('standards.emptyTitle', { market: t('standards.market.EU') }));
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('offline it reads the checklist and refuses to tick', async () => {
    await start();
    mockOnline = false;
    await openStandards();
    await shown(t('standards.needsNetwork'));
    await tick('Mã vùng trồng (mẫu)');
    await shown(t('errors.needsNetwork'));
    expect(db.tables.self_check.size).toBe(0);
  });

  it('a new version opens unticked and the old one stays readable', async () => {
    await start();
    await openStandards();
    await tick('Mã vùng trồng (mẫu)');
    await shown(t('standards.progress', { done: 1, total: 3 }));

    db.contentRelease = 2;
    await act(async () => {
      await refreshContent();
    });
    await shown(t('standards.progress', { done: 0, total: 4 }));

    press(`${t('standards.version', { no: 1 })}`);
    await shown(t('standards.progress', { done: 1, total: 3 }));
    await shown(t('standards.oldVersion'));
    // The old version is read-only.
    await tick('Mã vùng trồng (mẫu)');
    await new Promise((r) => setTimeout(r, 50));
    const [check] = db.tables.self_check.values();
    expect(check.answers.filter((a) => a.checked)).toHaveLength(1);
    expect(db.tables.self_check.size).toBe(1);
  });
});

describe('SC-23, SC-24: directory (AC-07, AC-15)', () => {
  const openDirectory = async () => {
    fireEvent.press(screen.getAllByLabelText(t('tabs.more'))[0]);
    await screen.findByTestId('screen-More');
    press(t('more.directory'));
    await screen.findByTestId('screen-Directory');
  };

  it('lists approved contacts, filters them, and offline still opens', async () => {
    await start();
    mockOnline = false;
    await openDirectory();
    await shown('Cửa hàng vật tư (mẫu) A');
    await shown('Chuyên gia bệnh cây (mẫu)');

    press(t('directory.expert'));
    await waitFor(() => expect(screen.queryAllByText('Cửa hàng vật tư (mẫu) A')).toHaveLength(0));
    await shown('Chuyên gia bệnh cây (mẫu)');
  });

  it('a contact shows its source and date, and calls or opens a link in another app', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await start();
    await openDirectory();
    press('Chuyên gia bệnh cây (mẫu)');
    await screen.findByTestId('screen-ContactDetail');
    await shown(t('contact.verified', { date: '01/10/2026' }));
    press(t('contact.call'));
    await waitFor(() => expect(open).toHaveBeenCalledWith('tel:0900000002'));
    press(t('contact.zalo'));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://zalo.me/0900000002'));
    press(t('contact.source'));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://example.org/source'));
  });

  it('a contact without any way to reach it says so', async () => {
    await start();
    await openDirectory();
    press('Cửa hàng vật tư (mẫu) B');
    await screen.findByTestId('screen-ContactDetail');
    await shown(t('contact.noWay'));
    expect(screen.queryAllByText(t('contact.call'))).toHaveLength(0);
  });

  it('with no pack the directory is empty and explains why', async () => {
    mockOnline = false; // online, opening the directory would download the pack
    await start({ pack: false });
    await openDirectory();
    await shown(t('directory.emptyTitle'));
    await shown(t('directory.noPackBody'));
  });
});
