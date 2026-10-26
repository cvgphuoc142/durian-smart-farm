import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { stubEngine } from '@/ai/stub';
import { db, mutation, newId, syncApi, upsert } from '@/api';
import { getDb, resetDbHandle, scanRepo, writeRefs, refsFromSnapshot } from '@/db';
import { useScanTargets } from '@/hooks';
import i18n from '@/i18n';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore, useContextStore } from '@/stores';
import { defaultDeps, runOutbox, saveScan } from '@/sync';
import { makeDraft, seedSeason } from '@/test/scanFixtures';
import { createTestQueryClient, renderWithProviders, resetApp, TEST_USER } from '@/test/utils';

let mockOnline = true;
jest.mock('@/hooks/useIsOnline', () => ({ useIsOnline: () => mockOnline }));

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const CameraView = React.forwardRef(function CameraView(
    props: { onCameraReady?: () => void },
    ref: unknown,
  ) {
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: async () => ({ uri: 'file:///cam.jpg', width: 3000, height: 4000 }),
    }));
    React.useEffect(() => props.onCameraReady?.(), []); // eslint-disable-line react-hooks/exhaustive-deps
    return React.createElement(View, { testID: 'camera' });
  });
  return {
    CameraView,
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn(), jest.fn()],
  };
});

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///pick.jpg', width: 800, height: 600 }],
  })),
}));

// The photo steps touch the file system; the rest of the flow is real.
jest.mock('@/services', () => ({
  stageImage: async (_src: string, photoId: string) => ({
    uri: `file:///scans/${photoId}.jpg`,
    mime_type: 'image/jpeg',
    size_bytes: 100,
    sha256: 'a'.repeat(64),
  }),
  fileExists: () => true,
  removeImage: jest.fn(),
  uploadPhoto: async () => {},
  sha256OfFile: async () => 'a'.repeat(64),
}));

// The scan flow is tested against the dev stub, which only shows when no real model covers a part.
jest.mock('@/ai/bundled', () => ({
  bundledArtifacts: {},
  bundledManifest: { schema_version: 1, entries: [] },
  hasBundledArtifact: () => false,
  loadBundledManifest: () => ({ entries: [], rejected: [] }),
}));

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
const USER = 'mock-user';

beforeAll(async () => {
  await i18n.changeLanguage('vi');
});

beforeEach(async () => {
  mockOnline = true;
  resetDbHandle();
  jest.spyOn(stubEngine, 'classify').mockResolvedValue([0, 5, 0]);
});

afterEach(() => jest.restoreAllMocks());

async function start({ closedSeason = false } = {}) {
  resetApp();
  useAuthStore.setState({ user: { ...TEST_USER, id: USER } });
  await seedSeason();
  if (closedSeason)
    await syncApi.send(mutation(upsert('season', 's1', { closed_on: '2026-10-01' }, 1)));
  useContextStore.getState().select({ farmId: 'f1', plotId: 'p1', seasonId: 's1' });
  const view = renderWithProviders(<RootNavigator />);
  await screen.findByTestId('screen-SeasonOverview');
  return view;
}

const press = (text: string) => fireEvent.press(screen.getAllByText(text).at(-1)!);
const openScan = async () => {
  fireEvent.press(screen.getAllByLabelText(t('tabs.scan'))[0]);
  await screen.findByTestId('screen-Scan');
};

/** Scan tab → library photo → body part → run → the result screen. */
async function scanAPhoto() {
  await openScan();
  press(t('scan.pickLibrary'));
  await screen.findByLabelText(t('scan.photoPicked'));
  press('Lá');
  press(t('scan.run'));
  await screen.findByTestId('screen-ScanResult');
}

describe('SC-12…14: scan, result, save (AC-07, AC-08)', () => {
  it('a photo from the library gives a "suspected" answer with the disclaimer, and no shop', async () => {
    await start();
    await scanAPhoto();
    await screen.findByText(t('result.suspectedTitle', { label: 'Bệnh thử nghiệm' }));
    expect(screen.getAllByText(t('result.disclaimer')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t('result.noRelated')).length).toBeGreaterThan(0);
    // The test model announces itself.
    expect(screen.getAllByText(t('scan.stub')).length).toBeGreaterThan(0);
    const [draft] = await scanRepo.listScans(USER);
    expect(draft).toMatchObject({
      state: 'draft',
      outcome: 'suspected',
      disease_code: 'dev_stub_disease',
    });
  });

  it('Run stays disabled until there is a photo and a body part', async () => {
    await start();
    await openScan();
    press('Lá');
    fireEvent.press(screen.getAllByText(t('scan.run')).at(-1)!);
    expect(screen.queryAllByTestId('screen-ScanResult')).toHaveLength(0);
    expect(await scanRepo.listScans(USER)).toEqual([]);
  });

  it('saving writes to the phone first, opens a case, and the outbox then delivers it once', async () => {
    await start();
    await scanAPhoto();
    press(t('result.save'));
    await screen.findByTestId('screen-SaveScan');
    press(t('saveScan.saveButton'));
    await screen.findByTestId('screen-Cases');

    const [saved] = await scanRepo.listScans(USER);
    expect(saved).toMatchObject({ state: 'saved_on_device', season_id: 's1' });
    expect(saved.new_case).not.toBeNull();
    expect(db.tables.scan.size).toBe(0); // nothing sent yet
    await screen.findByText(new RegExp(t('cases.pending')));

    expect(await runOutbox(USER, defaultDeps)).toMatchObject({ synced: 1, failed: 0 });
    expect(db.tables.scan.size).toBe(1);
    expect(db.tables.disease_case.size).toBe(1);
    expect(await runOutbox(USER, defaultDeps)).toMatchObject({ synced: 0 });
    expect(db.tables.scan.size).toBe(1);
  });

  it('offline: the whole flow still saves on the phone, then sends when the network is back (AC-08)', async () => {
    await start();
    mockOnline = false;
    db.sim.offline = true;
    await scanAPhoto();
    press(t('result.save'));
    await screen.findByTestId('screen-SaveScan');
    press(t('saveScan.saveButton'));
    await screen.findByTestId('screen-ScanSync');
    await screen.findByText(t('sync.saved_on_device'));
    expect(db.tables.scan.size).toBe(0);

    // Still there for the next time the app is opened.
    expect((await scanRepo.listScans(USER)).map((s) => s.state)).toEqual(['saved_on_device']);

    mockOnline = true;
    db.sim.offline = false;
    expect(await runOutbox(USER, defaultDeps)).toMatchObject({ synced: 1 });
    expect(db.tables.scan.size).toBe(1);
  });

  it('a model failure shows the error state, offers no Save, and retry can recover', async () => {
    await start();
    jest.spyOn(stubEngine, 'classify').mockRejectedValue(new Error('native crash'));
    await scanAPhoto();
    await screen.findByText(t('result.errorTitle'));
    expect(screen.queryAllByText(t('result.save'))).toHaveLength(0);
    const [draft] = await scanRepo.listScans(USER);
    expect(draft).toMatchObject({ outcome: 'error', error_code: 'run' });
    await expect(saveScan(USER, draft.id, 's1', { kind: 'none' })).rejects.toThrow();

    jest.spyOn(stubEngine, 'classify').mockResolvedValue([5, 0, 0]);
    press(t('result.retry'));
    await screen.findByText(t('result.healthyTitle'));
    expect(screen.getAllByText(t('result.save')).length).toBeGreaterThan(0);
  });

  it('a healthy result does not force a case', async () => {
    await start();
    jest.spyOn(stubEngine, 'classify').mockResolvedValue([5, 0, 0]);
    await scanAPhoto();
    press(t('result.save'));
    await screen.findByTestId('screen-SaveScan');
    press(t('saveScan.saveButton'));
    await screen.findByTestId('screen-Cases');
    const [saved] = await scanRepo.listScans(USER);
    expect(saved.new_case).toBeNull();
    expect(saved.case_id).toBeNull();
  });

  it('with no open season the scan is kept as a draft and the farmer is told how to open one', async () => {
    await start({ closedSeason: true });
    await scanAPhoto();
    press(t('result.save'));
    await screen.findByText(t('saveScan.noSeasonTitle'));
    expect(screen.getAllByText(t('saveScan.noSeasonOnline')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(t('saveScan.saveButton'))).toHaveLength(0);
    expect((await scanRepo.listScans(USER)).map((s) => s.state)).toEqual(['draft']);
  });
});

describe('SC-26 scan sync status', () => {
  it('shows the stuck scan with its reason, retries it, and deletes only after confirmation', async () => {
    await start();
    const id = await makeDraft();
    await saveScan(USER, id, 's1', { kind: 'none' });
    await scanRepo.markError(USER, id, 'photo_missing');

    // CareLogs header → cases → sync status
    fireEvent.press(screen.getAllByLabelText(t('tabs.journal'))[0]);
    await screen.findByTestId('screen-CareLogs');
    fireEvent.press(screen.getAllByLabelText(t('screens.Cases')).at(-1)!);
    await screen.findByTestId('screen-Cases');
    fireEvent.press(screen.getAllByLabelText(t('cases.syncStatus')).at(-1)!);
    await screen.findByTestId('screen-ScanSync');

    await screen.findByText(t('errors.photo_missing'));
    press(t('scanSync.delete'));
    press(t('scanSync.delete')); // the confirmation dialog
    await waitFor(async () => expect(await scanRepo.listScans(USER)).toEqual([]));
  });

  it('a draft can be continued or discarded', async () => {
    await start();
    await makeDraft();
    fireEvent.press(screen.getAllByLabelText(t('tabs.journal'))[0]);
    await screen.findByTestId('screen-CareLogs');
    fireEvent.press(screen.getAllByLabelText(t('screens.Cases')).at(-1)!);
    await screen.findByTestId('screen-Cases');
    fireEvent.press(screen.getAllByLabelText(t('cases.syncStatus')).at(-1)!);
    await screen.findByText(t('scanSync.drafts'));
    press(t('scanSync.discard'));
    press(t('scanSync.discard'));
    await waitFor(async () => expect(await scanRepo.listScans(USER)).toEqual([]));
  });
});

describe('SC-16 case detail', () => {
  it('only the farmer closes a case: confirm, then closed_at is written against the right revision', async () => {
    const { client } = await start();
    const caseId = newId();
    await syncApi.send(
      mutation(
        upsert(
          'disease_case',
          caseId,
          { season_id: 's1', opened_at: '2026-10-10T03:00:00.000Z' },
          null,
        ),
        upsert(
          'scan',
          newId(),
          {
            season_id: 's1',
            case_id: caseId,
            photo_id: newId(),
            captured_at: '2026-10-10T03:00:00.000Z',
            plant_part: 'leaf',
            outcome: 'suspected',
            disease_code: 'x',
            score: 0.9,
            label_snapshot: 'Thán thư',
            label_locale: 'vi',
            predictions: [],
            inference_metadata: {
              model_id: 'm',
              model_version: '1',
              pipeline_version: 'p',
              threshold_version: 't',
              inference_ms: 1,
            },
          },
          null,
        ),
      ),
    );
    await client.invalidateQueries();
    fireEvent.press(screen.getAllByLabelText(t('tabs.journal'))[0]);
    await screen.findByTestId('screen-CareLogs');
    fireEvent.press(screen.getAllByLabelText(t('screens.Cases')).at(-1)!);
    await screen.findByTestId('screen-Cases');
    await screen.findByText(new RegExp(t('cases.caseTitle', { date: '' }).trim()));
    fireEvent.press(screen.getAllByText(new RegExp('Ca ngày')).at(-1)!);
    await screen.findByTestId('screen-CaseDetail');
    expect(
      screen.getAllByText(t('result.suspectedTitle', { label: 'Thán thư' })).length,
    ).toBeGreaterThan(0);

    press(t('caseDetail.closeCase'));
    expect(db.tables.disease_case.get(caseId)!.closed_at).toBeNull(); // not before the farmer confirms
    // The dialog's button comes before the footer button in the tree.
    fireEvent.press(screen.getAllByText(t('caseDetail.closeCase'))[0]);
    await waitFor(() => expect(db.tables.disease_case.get(caseId)!.closed_at).not.toBeNull());
    expect(db.tables.disease_case.get(caseId)!.revision).toBe(2);
    await screen.findByText(t('caseDetail.reopen'));
  });
});

describe('useScanTargets', () => {
  it('falls back to the copy kept on the phone when the snapshot cannot be loaded', async () => {
    resetApp();
    useAuthStore.setState({ user: { ...TEST_USER, id: USER } });
    await seedSeason();
    await writeRefs(USER, refsFromSnapshot(await syncApi.snapshot()));
    db.sim.offline = true;
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useScanTargets(), { wrapper });
    await waitFor(() => expect(result.current.refs?.seasons).toHaveLength(1));
    expect(result.current.fromCache).toBe(true);
    void getDb;
  });
});
