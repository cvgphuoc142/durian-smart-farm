import { db, resetMockDb } from '@/api';
import { entry } from '@/test/scanFixtures';

import type { ModelFiles } from './modelFiles';
import { installModels, modelPath, rollbackModel, useModelTransfer } from './modelInstaller';
import { isSameModelFile, useModelStore } from './modelStore';
import { refreshModels } from './modelSync';
import { bytesToFetch, megabytes, pendingUpdates } from './updates';

const sha = (c: string) => c.repeat(64);

const model = (over: Parameters<typeof entry>[0] = {}) =>
  entry({
    artifact: { path: 'leaf-1.onnx', sha256: sha('a'), size_bytes: 1000 },
    ...over,
  });

/** What the "server" publishes: the entry as JSON. */
const publish = (...entries: ReturnType<typeof model>[]) => {
  db.models = entries;
};

/** An in-memory disk. `content` maps a downloaded url to the hash/size the file will have. */
function fakeDisk(opts: { free?: number; status?: number; fail?: boolean } = {}) {
  const files = new Map<string, { size: number; hash: string }>();
  const downloads: string[] = [];
  const served = new Map<string, { size: number; hash: string }>();
  const disk: ModelFiles = {
    freeBytes: () => opts.free ?? 1e12,
    exists: (rel) => files.has(rel),
    sizeOf: (rel) => files.get(rel)?.size ?? null,
    remove: (rel) => void files.delete(rel),
    move: (from, to) => {
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    uri: (rel) => `file:///docs/${rel}`,
    download: (url, rel, onProgress) => {
      downloads.push(url);
      return {
        done: (async () => {
          if (opts.fail) throw new Error('network');
          const body = served.get(url) ?? { size: 0, hash: '' };
          onProgress(body.size, body.size);
          files.set(rel, body);
          return opts.status ?? 200;
        })(),
        cancel: async () => undefined,
      };
    },
    sha256: async (rel) => files.get(rel)!.hash,
  };
  return {
    disk,
    files,
    downloads,
    /** The bytes behind a model's download link. */
    serve: (
      e: ReturnType<typeof model>,
      body = { size: e.artifact.size_bytes, hash: e.artifact.sha256 },
    ) => served.set(`mock://model/${e.model_id}/${e.version}`, body),
  };
}

beforeEach(() => {
  resetMockDb();
  useModelStore.setState({ installed: {}, remote: null });
  useModelTransfer.setState({ active: null, queue: [], errors: {} });
});

describe('what is offered', () => {
  it('a body part with no model, or a different file, is an update; the same file is not', () => {
    const leaf = model();
    const remote = {
      revision: 'r',
      entries: [leaf, model({ plant_part: 'fruit', model_id: 'f' })],
      needs_app_update: [],
      checked_at: 'x',
    };
    expect(pendingUpdates({}, remote).map((u) => [u.entry.plant_part, u.kind])).toEqual([
      ['leaf', 'new_part'],
      ['fruit', 'new_part'],
    ]);
    const installed = {
      leaf: { current: { entry: leaf, file: 'f', installed_at: '' }, previous: null },
    };
    expect(pendingUpdates(installed, remote).map((u) => u.entry.plant_part)).toEqual(['fruit']);
    const newer = model({
      version: '2',
      artifact: { path: 'x', sha256: sha('b'), size_bytes: 2000 },
    });
    const upd = pendingUpdates(installed, { ...remote, entries: [newer] });
    expect(upd).toMatchObject([{ kind: 'new_version', onPhone: false }]);
    expect(bytesToFetch(upd)).toBe(2000);
    expect(pendingUpdates(installed, null)).toEqual([]);
    expect(megabytes(28_400_000)).toBe('28MB');
    expect(megabytes(10)).toBe('1MB');
  });
});

describe('checking the server', () => {
  it('stores the manifest and says an update is waiting, without downloading anything', async () => {
    publish(model({ release_notes: 'Thêm 2 nhãn mới' }));
    expect(await refreshModels('1.0.0')).toBe('update_available');
    const { remote, installed } = useModelStore.getState();
    expect(remote?.entries).toHaveLength(1);
    expect(remote?.entries[0].release_notes).toBe('Thêm 2 nhãn mới');
    expect(installed).toEqual({});
  });

  it('is up to date when the phone has exactly the published file, and refreshes its words', async () => {
    const e = model({ maturity: 'beta' });
    useModelStore.getState().install({ entry: e, file: 'm', installed_at: '' });
    publish(
      model({ maturity: 'stable', limitations: 'Chỉ lá sầu riêng', release_notes: 'Hết beta' }),
    );
    expect(await refreshModels('1.0.0')).toBe('up_to_date');
    const have = useModelStore.getState().installed.leaf.current.entry;
    expect(have).toMatchObject({ maturity: 'stable', limitations: 'Chỉ lá sầu riêng' });
  });

  it('leaves out models this app is too old for and says so', async () => {
    publish(model({ plant_part: 'stem', model_id: 's', min_app_version: '2.0.0' }));
    expect(await refreshModels('1.0.0')).toBe('up_to_date');
    expect(useModelStore.getState().remote).toMatchObject({
      entries: [],
      needs_app_update: ['stem'],
    });
    expect(await refreshModels('2.0.0')).toBe('update_available');
  });

  it('a failed check keeps what was known', async () => {
    publish(model());
    await refreshModels('1.0.0');
    db.sim.offline = true;
    expect(await refreshModels('1.0.0')).toBe('failed');
    expect(useModelStore.getState().remote?.entries).toHaveLength(1);
  });
});

describe('installing', () => {
  it('downloads, checks size and sha256, then makes the model current', async () => {
    const e = model();
    publish(e);
    const d = fakeDisk();
    d.serve(e);
    await installModels([e], d.disk);
    const have = useModelStore.getState().installed.leaf;
    expect(have.current.entry.version).toBe(e.version);
    expect(have.current.file).toBe(modelPath(e));
    expect(d.files.has(modelPath(e))).toBe(true);
    expect(d.files.has(`${modelPath(e)}.part`)).toBe(false);
    expect(useModelTransfer.getState()).toMatchObject({ active: null, errors: {} });
  });

  it('refuses a file whose hash differs and keeps the model in use', async () => {
    const old = model();
    useModelStore.getState().install({ entry: old, file: 'old.onnx', installed_at: '' });
    const bad = model({
      version: '2',
      artifact: { path: 'x', sha256: sha('b'), size_bytes: 1000 },
    });
    publish(bad);
    const d = fakeDisk();
    d.serve(bad, { size: 1000, hash: sha('c') });
    await installModels([bad], d.disk);
    expect(useModelTransfer.getState().errors.leaf).toBe('hash_mismatch');
    expect(useModelStore.getState().installed.leaf.current.entry.version).toBe(old.version);
    expect(d.files.size).toBe(0); // the bad file is gone
  });

  it('refuses a file of the wrong size', async () => {
    const e = model();
    publish(e);
    const d = fakeDisk();
    d.serve(e, { size: 10, hash: e.artifact.sha256 });
    await installModels([e], d.disk);
    expect(useModelTransfer.getState().errors.leaf).toBe('size_mismatch');
    expect(useModelStore.getState().installed).toEqual({});
  });

  it('does not start without room for the file', async () => {
    const e = model();
    publish(e);
    const d = fakeDisk({ free: 100 });
    await installModels([e], d.disk);
    expect(useModelTransfer.getState().errors.leaf).toBe('no_space');
    expect(d.downloads).toEqual([]);
  });

  it('a dropped connection or a bad status is a network error and nothing is installed', async () => {
    const e = model();
    publish(e);
    await installModels([e], fakeDisk({ fail: true }).disk);
    expect(useModelTransfer.getState().errors.leaf).toBe('network');
    await installModels([e], fakeDisk({ status: 500 }).disk);
    expect(useModelTransfer.getState().errors.leaf).toBe('network');
    expect(useModelStore.getState().installed).toEqual({});
  });

  it('knows when the server moved on to another file since the last check', async () => {
    const stale = model();
    publish(model({ version: '2', artifact: { path: 'x', sha256: sha('b'), size_bytes: 1000 } }));
    await installModels([stale], fakeDisk().disk);
    expect(useModelTransfer.getState().errors.leaf).toBe('changed');
  });

  it('keeps one generation to go back to, removes older ones, and goes back and forth without downloading', async () => {
    const d = fakeDisk();
    const versions = ['1', '2', '3'].map((v, i) =>
      model({ version: v, artifact: { path: `m${v}`, sha256: sha('abc'[i]), size_bytes: 1000 } }),
    );
    for (const v of versions) {
      publish(v);
      d.serve(v);
      await installModels([v], d.disk);
    }
    const have = useModelStore.getState().installed.leaf;
    expect([have.current.entry.version, have.previous?.entry.version]).toEqual(['3', '2']);
    expect([...d.files.keys()].sort()).toEqual([modelPath(versions[1]), modelPath(versions[2])]);

    expect(rollbackModel('leaf', d.disk)).toBe(true);
    expect(useModelStore.getState().installed.leaf.current.entry.version).toBe('2');
    // Installing 3 again is a switch, not a download.
    const before = d.downloads.length;
    await installModels([versions[2]], d.disk);
    expect(d.downloads).toHaveLength(before);
    expect(useModelStore.getState().installed.leaf.current.entry.version).toBe('3');
    expect(
      isSameModelFile(useModelStore.getState().installed.leaf.previous!.entry, versions[1]),
    ).toBe(true);
  });

  it('cannot go back when there is nothing before', () => {
    expect(rollbackModel('leaf', fakeDisk().disk)).toBe(false);
  });

  it('several parts download one after the other and fail separately', async () => {
    const leaf = model();
    const fruit = model({
      plant_part: 'fruit',
      model_id: 'f',
      artifact: { path: 'f', sha256: sha('d'), size_bytes: 500 },
    });
    publish(leaf, fruit);
    const d = fakeDisk();
    d.serve(leaf);
    d.serve(fruit, { size: 500, hash: sha('e') }); // corrupt
    await installModels([leaf, fruit], d.disk);
    expect(Object.keys(useModelStore.getState().installed)).toEqual(['leaf']);
    expect(useModelTransfer.getState().errors).toEqual({ fruit: 'hash_mismatch' });
  });
});

describe('what is kept on the phone', () => {
  it('survives a restart and drops entries the schema no longer accepts', () => {
    const e = model();
    useModelStore.getState().install({ entry: e, file: 'm.onnx', installed_at: 'x' });
    useModelStore
      .getState()
      .setRemote({ revision: 'r', entries: [e], needs_app_update: [], checked_at: 'y' });
    const saved = JSON.parse(
      JSON.stringify({
        installed: useModelStore.getState().installed,
        remote: useModelStore.getState().remote,
      }),
    );
    saved.installed.bad = {
      current: { entry: { nope: true }, file: 'z', installed_at: '' },
      previous: null,
    };
    useModelStore.setState({ installed: {}, remote: null });
    const persist = useModelStore.persist.getOptions();
    const merged = persist.merge!(saved, useModelStore.getState()) as ReturnType<
      typeof useModelStore.getState
    >;
    expect(Object.keys(merged.installed)).toEqual(['leaf']);
    expect(merged.remote?.entries).toHaveLength(1);
  });
});
