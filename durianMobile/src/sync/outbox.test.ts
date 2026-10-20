import { db, mediaApi, mutation, newId, resetMockDb, syncApi, upsert } from '@/api';
import { getDb, resetDbHandle, scanRepo } from '@/db';
import { makeDraft, seedSeason, USER } from '@/test/scanFixtures';
import type { LocalScan, MutationRow } from '@/types';

import { buildScanMutation, hashPayload } from './buildMutation';
import { runOutbox, type OutboxDeps } from './outbox';
import { saveScan } from './scanFlow';

beforeEach(async () => {
  resetMockDb();
  resetDbHandle();
  await seedSeason();
});

function deps(over: Partial<OutboxDeps> = {}) {
  const calls = { prepare: 0, upload: 0, complete: 0, send: 0 };
  const d: OutboxDeps = {
    send: (m) => {
      calls.send++;
      return syncApi.send(m);
    },
    prepareMedia: (b) => {
      calls.prepare++;
      return mediaApi.prepare(b);
    },
    completeMedia: (id) => {
      calls.complete++;
      return mediaApi.complete(id);
    },
    upload: async () => {
      calls.upload++;
    },
    fileExists: () => true,
    ...over,
  };
  return { d, calls };
}

const scansOnServer = () => [...db.tables.scan.values()];
const casesOnServer = () => [...db.tables.disease_case.values()];
const state = async (id: string) => (await scanRepo.getScan(USER, id))!.state;

describe('saving a scan', () => {
  it('writes the target and the immutable mutation together; the draft is no longer a draft', async () => {
    const id = await makeDraft();
    const saved = await saveScan(USER, id, 's1', { kind: 'none' });
    expect(saved).toMatchObject({ state: 'saved_on_device', season_id: 's1', meta_done: false });
    expect(saved.mutation_id).toBeTruthy();
    const [item] = await scanRepo.pendingOutbox(USER);
    expect(item.mutation.mutation_id).toBe(saved.mutation_id);
    expect(item.mutation.ops).toHaveLength(1);
    expect(await scanRepo.outboxHash(USER, id)).toBe(hashPayload(item.mutation.ops));
  });

  it('a failed model run can be neither saved nor sent', async () => {
    const id = await makeDraft({
      outcome: 'error',
      error_code: 'run',
      inference: null,
      disease_code: null,
      score: null,
      label_snapshot: null,
    });
    await expect(saveScan(USER, id, 's1', { kind: 'none' })).rejects.toThrow();
    expect(await scanRepo.pendingOutbox(USER)).toEqual([]);
    expect((await runOutbox(USER, deps().d)).synced).toBe(0);
    expect(scansOnServer()).toHaveLength(0);
  });

  it('a new case travels in the same mutation, before its scan', async () => {
    const id = await makeDraft();
    const saved = await saveScan(USER, id, 's1', { kind: 'new', locationNote: 'Lô 1', note: null });
    const [item] = await scanRepo.pendingOutbox(USER);
    expect(item.mutation.ops.map((o) => o.entity)).toEqual(['disease_case', 'scan']);
    expect(item.mutation.ops[1].data).toMatchObject({ case_id: saved.new_case!.id });
  });

  it('is only possible once: a saved scan cannot be queued again', async () => {
    const id = await makeDraft();
    await saveScan(USER, id, 's1', { kind: 'none' });
    await expect(saveScan(USER, id, 's1', { kind: 'none' })).rejects.toThrow();
  });
});

describe('sync (FR-X06, FR-B10, AC-08, AC-09)', () => {
  it('sends the photo then the scan, and ends "synced" with both acknowledged', async () => {
    const id = await makeDraft();
    await saveScan(USER, id, 's1', { kind: 'new', locationNote: null, note: 'Lá vàng' });
    const { d, calls } = deps();
    const rows: MutationRow[] = [];
    const summary = await runOutbox(USER, { ...d, onAcknowledged: (r) => rows.push(...r) });

    expect(summary).toEqual({ synced: 1, failed: 0, stopped: null });
    expect(calls).toEqual({ prepare: 1, upload: 1, complete: 1, send: 1 });
    const local = (await scanRepo.getScan(USER, id))!;
    expect(local).toMatchObject({ state: 'synced', media_done: true, meta_done: true });
    expect(await scanRepo.pendingOutbox(USER)).toEqual([]);
    expect(scansOnServer()).toHaveLength(1);
    expect(casesOnServer()).toHaveLength(1);
    expect(scansOnServer()[0]).toMatchObject({
      id,
      case_id: local.new_case!.id,
      outcome: 'suspected',
    });
    expect(db.media.get(local.photo_id)?.status).toBe('ready');
    expect(rows.map((r) => r.entity)).toEqual(['disease_case', 'scan']);
  });

  it('offline: stays "saved on device", nothing is lost, and the next run sends it (AC-08)', async () => {
    const id = await makeDraft();
    await saveScan(USER, id, 's1', { kind: 'none' });
    db.sim.offline = true;
    const first = await runOutbox(USER, deps().d);
    expect(first).toMatchObject({ synced: 0, stopped: 'offline' });
    expect(await state(id)).toBe('saved_on_device');
    expect(scansOnServer()).toHaveLength(0);

    // The app is killed and reopened: a row left "sending" goes back to waiting.
    await scanRepo.markSending(USER, id);
    await scanRepo.resetSending(USER);
    expect(await state(id)).toBe('saved_on_device');

    db.sim.offline = false;
    expect(await runOutbox(USER, deps().d)).toMatchObject({ synced: 1 });
    expect(scansOnServer()).toHaveLength(1);
  });

  it('a lost acknowledgement is retried with the same mutation id and writes once (AC-09)', async () => {
    const id = await makeDraft();
    const saved = await saveScan(USER, id, 's1', { kind: 'new', locationNote: null, note: null });
    db.sim.dropNextResponse = false;
    const lostAck = deps({
      send: async (m) => {
        db.sim.dropNextResponse = true; // the server commits, the answer never arrives
        return syncApi.send(m);
      },
    });
    const first = await runOutbox(USER, lostAck.d);
    expect(first.stopped).toBe('offline');
    expect(scansOnServer()).toHaveLength(1); // already written
    expect((await scanRepo.getScan(USER, id))!.meta_done).toBe(false); // but not acknowledged here

    const again = deps();
    expect(await runOutbox(USER, again.d)).toMatchObject({ synced: 1 });
    expect(scansOnServer()).toHaveLength(1);
    expect(casesOnServer()).toHaveLength(1);
    expect(db.receipts.has(saved.mutation_id!)).toBe(true);
    expect(again.calls.prepare).toBe(0); // the photo was already done
    expect(await state(id)).toBe('synced');
  });

  it('an interrupted upload resumes with the same asset id and is not uploaded twice', async () => {
    const id = await makeDraft();
    await saveScan(USER, id, 's1', { kind: 'none' });
    const local = (await scanRepo.getScan(USER, id))!;
    const broken = deps({
      upload: async () => {
        throw Object.assign(new Error('x'), {});
      },
    });
    // A network failure in the middle of the upload.
    db.sim.offline = false;
    const failing = deps({
      upload: async () => {
        db.sim.offline = true;
        await mediaApi.complete(local.photo_id).catch(() => undefined);
      },
    });
    void broken;
    await runOutbox(USER, failing.d);
    expect(await state(id)).toBe('saved_on_device');
    expect(db.media.get(local.photo_id)?.status).toBe('pending');

    db.sim.offline = false;
    const resume = deps();
    await runOutbox(USER, resume.d);
    expect([...db.media.keys()]).toEqual([local.photo_id]);
    expect(resume.calls.upload).toBe(1);
    expect(await state(id)).toBe('synced');
  });

  it('a definite refusal marks that scan "error", the next one still goes, and retry works', async () => {
    const addSeason = (id: string) =>
      syncApi.send(
        mutation(
          upsert('plot', `plot-${id}`, { farm_id: 'f1', name: id }, null),
          upsert(
            'season',
            id,
            { plot_id: `plot-${id}`, name: id, started_on: '2026-03-02', stage: 'recovery' },
            null,
          ),
        ),
      );
    await addSeason('gone');
    const bad = await makeDraft();
    await saveScan(USER, bad, 'gone', { kind: 'none' });
    const good = await makeDraft();
    await saveScan(USER, good, 's1', { kind: 'none' });
    const goneSeason = db.tables.season.get('gone')!;
    db.tables.season.delete('gone'); // removed on the server before the scan arrives

    const summary = await runOutbox(USER, deps().d);
    expect(summary).toMatchObject({ synced: 1, failed: 1 });
    expect(await state(bad)).toBe('error');
    expect((await scanRepo.getScan(USER, bad))!.last_error).toBe('parent_missing');
    expect(await state(good)).toBe('synced');
    // An error is not retried by itself.
    expect((await runOutbox(USER, deps().d)).failed).toBe(0);

    db.tables.season.set('gone', goneSeason);
    await scanRepo.requeue(USER, bad);
    expect(await runOutbox(USER, deps().d)).toMatchObject({ synced: 1, failed: 0 });
    expect(scansOnServer()).toHaveLength(2);
  });

  it('a scan that attaches to a case still waiting in the outbox goes after it', async () => {
    const first = await makeDraft();
    const saved = await saveScan(USER, first, 's1', {
      kind: 'new',
      locationNote: null,
      note: null,
    });
    const second = await makeDraft({ captured_at: new Date(Date.now() + 1000).toISOString() });
    await saveScan(USER, second, 's1', { kind: 'existing', caseId: saved.new_case!.id });

    expect(await runOutbox(USER, deps().d)).toMatchObject({ synced: 2 });
    expect(casesOnServer()).toHaveLength(1);
    expect(scansOnServer().map((s) => s.case_id)).toEqual([saved.new_case!.id, saved.new_case!.id]);
  });

  it('if the case it needs is refused, the dependent scan is not sent', async () => {
    const first = await makeDraft();
    const saved = await saveScan(USER, first, 's1', {
      kind: 'new',
      locationNote: null,
      note: null,
    });
    const second = await makeDraft();
    await saveScan(USER, second, 's1', { kind: 'existing', caseId: saved.new_case!.id });
    db.tables.season.clear();
    await runOutbox(USER, deps().d);
    expect(await state(first)).toBe('error');
    expect(await state(second)).toBe('error');
    expect((await scanRepo.getScan(USER, second))!.last_error).toBe('case_not_synced');
  });

  it('a missing photo file is an error for that scan, not a crash', async () => {
    const id = await makeDraft();
    await saveScan(USER, id, 's1', { kind: 'none' });
    const summary = await runOutbox(USER, deps({ fileExists: () => false }).d);
    expect(summary.failed).toBe(1);
    expect((await scanRepo.getScan(USER, id))!.last_error).toBe('photo_missing');
  });

  it('a busy server (503) keeps the scan queued and stops the run', async () => {
    const a = await makeDraft();
    await saveScan(USER, a, 's1', { kind: 'none' });
    db.sim.failWith.push({ status: 503, code: 'unavailable' });
    const summary = await runOutbox(USER, deps().d);
    expect(summary.stopped).toBe('busy');
    expect(await state(a)).toBe('saved_on_device');
  });

  it('two runs at once are one run', async () => {
    const id = await makeDraft();
    await saveScan(USER, id, 's1', { kind: 'none' });
    const { d, calls } = deps();
    const [a, b] = await Promise.all([runOutbox(USER, d), runOutbox(USER, d)]);
    expect(a).toBe(b);
    expect(calls.send).toBe(1);
  });

  it('a payload changed on disk is refused instead of sent', async () => {
    const id = await makeDraft();
    await saveScan(USER, id, 's1', { kind: 'none' });
    const database = await getDb();
    await database.runAsync(
      "UPDATE outbox SET payload_hash = 'deadbeef00000000' WHERE scan_id = ?",
      id,
    );
    await runOutbox(USER, deps().d);
    expect((await scanRepo.getScan(USER, id))!.last_error).toBe('outbox_damaged');
    expect(scansOnServer()).toHaveLength(0);
  });
});

describe('accounts', () => {
  it('one account never sees or sends another one’s scans', async () => {
    const mine = await makeDraft();
    await saveScan(USER, mine, 's1', { kind: 'none' });
    const theirs = await makeDraft({ user_id: 'other-user' });

    expect((await scanRepo.listScans('other-user')).map((s) => s.id)).toEqual([theirs]);
    expect(await scanRepo.getScan('other-user', mine)).toBeNull();
    expect(await scanRepo.pendingOutbox('other-user')).toEqual([]);
    expect(await scanRepo.countUnsynced(USER)).toBe(1);
    expect(await scanRepo.countUnsynced('other-user')).toBe(1); // their draft
  });

  it('clearing an account removes its scans, outbox and cache', async () => {
    const id = await makeDraft();
    await saveScan(USER, id, 's1', { kind: 'none' });
    await scanRepo.clearUser(USER);
    expect(await scanRepo.listScans(USER)).toEqual([]);
    expect(await scanRepo.pendingOutbox(USER)).toEqual([]);
  });
});

describe('buildScanMutation', () => {
  it('is the same payload every time for the same input apart from the mutation id', () => {
    const scan = {
      id: 's',
      photo_id: 'p',
      captured_at: 't',
      plant_part: 'leaf',
      outcome: 'healthy' as const,
      disease_code: null,
      score: 0.9,
      label_snapshot: 'Khỏe',
      label_locale: 'vi',
      predictions: [],
      inference: {
        model_id: 'm',
        model_version: '1',
        pipeline_version: 'p',
        threshold_version: 't',
        inference_ms: 1,
      },
    };
    const target = { season_id: 's1', case_id: null, new_case: null };
    const a = buildScanMutation(scan, target);
    const b = buildScanMutation(scan, target);
    expect(a.mutation_id).not.toBe(b.mutation_id);
    expect(hashPayload(a.ops)).toBe(hashPayload(b.ops));
    expect(newId()).toBeTruthy();
  });
});

export type { LocalScan };
