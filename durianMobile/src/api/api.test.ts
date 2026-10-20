import {
  ApiRequestError,
  mutation,
  newId,
  remove,
  resetMockDb,
  rowOf,
  syncApi,
  upsert,
  db,
} from '@/api';
import type { CareLog, Expense, Sale, SalePayment, Season } from '@/types';

beforeEach(() => resetMockDb());

const ctx = { farm: newId(), plot: newId(), season: newId() };

async function seed() {
  await syncApi.send(
    mutation(
      upsert('farm', ctx.farm, { name: 'Vườn A' }, null),
      upsert('plot', ctx.plot, { farm_id: ctx.farm, name: 'Lô 1' }, null),
      upsert(
        'season',
        ctx.season,
        { plot_id: ctx.plot, name: 'Vụ 2026', started_on: '2026-03-01', stage: 'fruit_growth' },
        null,
      ),
    ),
  );
}

const expense = (over: Partial<Expense> = {}) => ({
  season_id: ctx.season,
  occurred_on: '2026-10-01',
  category: 'labor' as const,
  amount_vnd: '100',
  ...over,
});

async function code(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e instanceof ApiRequestError
      ? `${e.status}:${e.code}${e.field ? `@${e.field}` : ''}`
      : 'other';
  }
  return 'ok';
}

describe('envelope: revision and 409', () => {
  it('creates at revision 1, updates with the right revision, and canonicalises money', async () => {
    await seed();
    const id = newId();
    const rows = await syncApi.send(
      mutation(upsert('expense', id, expense({ amount_vnd: '1.005' }), null)),
    );
    const created = rowOf(rows, 'expense', id)!;
    expect(created).toMatchObject({ revision: 1, amount_vnd: '1.01', deleted_at: null });

    const next = await syncApi.send(mutation(upsert('expense', id, { amount_vnd: '250' }, 1)));
    expect(rowOf(next, 'expense', id)).toMatchObject({ revision: 2, amount_vnd: '250.00' });
  });

  it('a stale edit gets 409 with the server row, and nothing is written', async () => {
    await seed();
    const id = newId();
    await syncApi.send(mutation(upsert('expense', id, expense(), null)));
    await syncApi.send(mutation(upsert('expense', id, { amount_vnd: '200' }, 1)));

    const err = (await syncApi
      .send(mutation(upsert('expense', id, { amount_vnd: '300' }, 1)))
      .catch((e: unknown) => e)) as ApiRequestError;
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err.status).toBe(409);
    expect(err.isConflict).toBe(true);
    expect(err.serverRow('expense', id)).toMatchObject({ revision: 2, amount_vnd: '200.00' });
    expect(db.tables.expense.get(id)?.amount_vnd).toBe('200.00');
  });

  it('a delete leaves a tombstone in the snapshot', async () => {
    await seed();
    const id = newId();
    await syncApi.send(mutation(upsert('expense', id, expense(), null)));
    await syncApi.send(mutation(remove('expense', id, 1)));
    const snap = await syncApi.snapshot();
    expect(snap.expenses).toHaveLength(1);
    expect(snap.expenses[0].deleted_at).not.toBeNull();
  });
});

describe('idempotency', () => {
  it('a retry after a lost ack returns the first answer and writes nothing twice', async () => {
    await seed();
    const m = mutation(upsert('expense', newId(), expense(), null));
    db.sim.dropNextResponse = true;
    await expect(syncApi.send(m)).rejects.toMatchObject({ code: 'network', retryable: true });
    expect(db.tables.expense.size).toBe(1); // committed on the server

    const rows = await syncApi.send(m); // the user taps Save again with the same mutation
    expect(rows).toHaveLength(1);
    expect(db.tables.expense.size).toBe(1);
    expect([...db.tables.expense.values()][0].revision).toBe(1);
  });

  it('does not add a payment twice on retry (AC-03)', async () => {
    await seed();
    const sale = newId();
    await syncApi.send(
      mutation(
        upsert(
          'sale',
          sale,
          {
            season_id: ctx.season,
            buyer_name: 'A',
            agreed_on: '2026-10-01',
            status: 'confirmed',
            total_vnd: '100',
          } as Partial<Sale>,
          null,
        ),
      ),
    );
    const pay = mutation(
      upsert(
        'sale_payment',
        newId(),
        {
          sale_id: sale,
          occurred_on: '2026-10-02',
          kind: 'deposit',
          amount_vnd: '20',
        } as Partial<SalePayment>,
        null,
      ),
    );
    await syncApi.send(pay);
    await syncApi.send(pay);
    await syncApi.send(pay);
    expect(db.tables.sale_payment.size).toBe(1);
  });

  it('refuses the same mutation id with a different payload', async () => {
    await seed();
    const id = newId();
    const m = mutation(upsert('expense', id, expense({ amount_vnd: '100' }), null));
    await syncApi.send(m);
    const reused = {
      mutation_id: m.mutation_id,
      ops: [upsert('expense', id, expense({ amount_vnd: '999' }), null)],
    };
    expect(await code(syncApi.send(reused))).toBe('422:mutation_id_reused');
  });
});

describe('atomic mutations', () => {
  it('rolls everything back if one op breaks a rule', async () => {
    await seed();
    const good = newId();
    const bad = newId();
    const m = mutation(
      upsert('expense', good, expense(), null),
      upsert('expense', bad, expense({ amount_vnd: '0' }), null),
    );
    expect(await code(syncApi.send(m))).toBe('422:amount_positive@amount_vnd');
    expect(db.tables.expense.size).toBe(0);
  });

  it('creates a care log and its one expense together, and deletes both in one mutation (AC-02)', async () => {
    await seed();
    const log = newId();
    const exp = newId();
    const logData: Partial<CareLog> = {
      season_id: ctx.season,
      occurred_on: '2026-10-03',
      kind: 'fertilizing',
      inputs: [
        { id: newId(), product_name: 'NPK', amount: '5', unit: 'kg', active_ingredient: null },
      ],
    };
    await syncApi.send(
      mutation(
        upsert('care_log', log, logData, null),
        upsert('expense', exp, expense({ care_log_id: log, category: 'fertilizer' }), null),
      ),
    );
    // A second expense for the same log is refused.
    expect(
      await code(
        syncApi.send(mutation(upsert('expense', newId(), expense({ care_log_id: log }), null))),
      ),
    ).toBe('422:care_log_has_expense@care_log_id');
    // Deleting only the log is refused; deleting both works.
    expect(await code(syncApi.send(mutation(remove('care_log', log, 1))))).toBe(
      '422:linked_expense_exists@care_log_id',
    );
    await syncApi.send(mutation(remove('care_log', log, 1), remove('expense', exp, 1)));
    expect([...db.tables.expense.values()].every((e) => e.deleted_at)).toBe(true);
    expect([...db.tables.care_log.values()].every((l) => l.deleted_at)).toBe(true);
  });
});

describe('invariants', () => {
  it('allows one open season per plot, and a new one after closing', async () => {
    await seed();
    const second = {
      plot_id: ctx.plot,
      name: 'Vụ 2027',
      started_on: '2027-03-01',
      stage: 'recovery' as const,
    } satisfies Partial<Season>;
    expect(await code(syncApi.send(mutation(upsert('season', newId(), second, null))))).toBe(
      '422:season_already_open@plot_id',
    );
    await syncApi.send(mutation(upsert('season', ctx.season, { closed_on: '2026-12-01' }, 1)));
    expect(await code(syncApi.send(mutation(upsert('season', newId(), second, null))))).toBe('ok');
  });

  it('a closed season still accepts a payment (AC-06)', async () => {
    await seed();
    const sale = newId();
    await syncApi.send(
      mutation(
        upsert(
          'sale',
          sale,
          {
            season_id: ctx.season,
            buyer_name: 'A',
            agreed_on: '2026-10-01',
            status: 'confirmed',
            total_vnd: '100',
          } as Partial<Sale>,
          null,
        ),
      ),
    );
    await syncApi.send(mutation(upsert('season', ctx.season, { closed_on: '2026-12-01' }, 1)));
    const pay = upsert(
      'sale_payment',
      newId(),
      {
        sale_id: sale,
        occurred_on: '2026-12-02',
        kind: 'receipt',
        amount_vnd: '30',
      } as Partial<SalePayment>,
      null,
    );
    expect(await code(syncApi.send(mutation(pay)))).toBe('ok');
  });

  it('refund cannot exceed deposit + receipt, also after deleting a deposit (AC-04)', async () => {
    await seed();
    const sale = newId();
    const dep = newId();
    await syncApi.send(
      mutation(
        upsert(
          'sale',
          sale,
          {
            season_id: ctx.season,
            buyer_name: 'A',
            agreed_on: '2026-10-01',
            status: 'provisional',
          } as Partial<Sale>,
          null,
        ),
      ),
    );
    const payment = (id: string, kind: SalePayment['kind'], amount: string) =>
      upsert(
        'sale_payment',
        id,
        {
          sale_id: sale,
          occurred_on: '2026-10-02',
          kind,
          amount_vnd: amount,
        } as Partial<SalePayment>,
        null,
      );
    await syncApi.send(mutation(payment(dep, 'deposit', '20')));
    expect(await code(syncApi.send(mutation(payment(newId(), 'refund', '20.01'))))).toBe(
      '422:refund_exceeds_received@amount_vnd',
    );
    await syncApi.send(mutation(payment(newId(), 'refund', '5')));
    expect(await code(syncApi.send(mutation(remove('sale_payment', dep, 1))))).toBe(
      '422:refund_exceeds_received@amount_vnd',
    );
  });

  it('does not silently delete a sale that has payments', async () => {
    await seed();
    const sale = newId();
    await syncApi.send(
      mutation(
        upsert(
          'sale',
          sale,
          {
            season_id: ctx.season,
            buyer_name: 'A',
            agreed_on: '2026-10-01',
            status: 'provisional',
          } as Partial<Sale>,
          null,
        ),
      ),
    );
    await syncApi.send(
      mutation(
        upsert(
          'sale_payment',
          newId(),
          {
            sale_id: sale,
            occurred_on: '2026-10-02',
            kind: 'deposit',
            amount_vnd: '10',
          } as Partial<SalePayment>,
          null,
        ),
      ),
    );
    expect(await code(syncApi.send(mutation(remove('sale', sale, 1))))).toBe(
      '422:sale_has_payments@id',
    );
  });

  it('a confirmed sale needs a total; a plot name is unique per farm; fertilizing needs a product', async () => {
    await seed();
    expect(
      await code(
        syncApi.send(
          mutation(
            upsert(
              'sale',
              newId(),
              {
                season_id: ctx.season,
                buyer_name: 'A',
                agreed_on: '2026-10-01',
                status: 'confirmed',
              } as Partial<Sale>,
              null,
            ),
          ),
        ),
      ),
    ).toBe('422:total_required@total_vnd');
    expect(
      await code(
        syncApi.send(
          mutation(upsert('plot', newId(), { farm_id: ctx.farm, name: ' lô 1 ' }, null)),
        ),
      ),
    ).toBe('422:plot_name_taken@name');
    expect(
      await code(
        syncApi.send(
          mutation(
            upsert(
              'care_log',
              newId(),
              { season_id: ctx.season, occurred_on: '2026-10-01', kind: 'spraying', inputs: [] },
              null,
            ),
          ),
        ),
      ),
    ).toBe('422:input_required@inputs');
  });

  it('keeps the data of another season out of reach: a case must share the season', async () => {
    await seed();
    const plot2 = newId();
    const season2 = newId();
    const caseId = newId();
    await syncApi.send(
      mutation(
        upsert('plot', plot2, { farm_id: ctx.farm, name: 'Lô 2' }, null),
        upsert(
          'season',
          season2,
          { plot_id: plot2, name: 'Vụ B', started_on: '2026-03-01', stage: 'recovery' },
          null,
        ),
        upsert(
          'disease_case',
          caseId,
          { season_id: season2, opened_at: '2026-10-01T00:00:00Z' },
          null,
        ),
      ),
    );
    expect(
      await code(
        syncApi.send(
          mutation(
            upsert(
              'care_log',
              newId(),
              { season_id: ctx.season, case_id: caseId, occurred_on: '2026-10-01', kind: 'other' },
              null,
            ),
          ),
        ),
      ),
    ).toBe('422:different_season@case_id');
  });
});

describe('errors', () => {
  it('maps status codes to kinds', async () => {
    for (const [status, kind] of [
      [401, 'unauthorized'],
      [403, 'forbidden'],
      [429, 'rate_limited'],
      [503, 'unavailable'],
    ] as const) {
      db.sim.failWith.push({ status, code: 'x' });
      const err = await syncApi.snapshot().catch((e: ApiRequestError) => e);
      expect(err).toMatchObject({ kind, status });
    }
  });

  it('503 and 429 are retryable; offline is a network error', async () => {
    db.sim.failWith.push({ status: 503, code: 'busy' });
    expect(await syncApi.snapshot().catch((e: ApiRequestError) => e)).toMatchObject({
      retryable: true,
      request_id: expect.any(String),
    });
    db.sim.offline = true;
    expect(await syncApi.snapshot().catch((e: ApiRequestError) => e)).toMatchObject({
      isNetwork: true,
    });
  });
});
