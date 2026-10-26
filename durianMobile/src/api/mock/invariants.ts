import {
  CARE_KINDS,
  CARE_KINDS_WITH_INPUTS,
  EXPENSE_CATEGORIES,
  PAYMENT_KINDS,
  SALE_STATUSES,
  SEASON_STAGES,
  type EntityName,
} from '@/types';
import { parse, saleBalance } from '@/utils/money';

import type { Tables } from './db';

export interface Violation {
  code: string;
  field?: string;
}

const alive = <T extends { deleted_at: string | null }>(m: Map<string, T>) =>
  [...m.values()].filter((r) => !r.deleted_at);

const blank = (v: string | null | undefined) => v == null || v.trim() === '';
const positive = (v: string | null) => parse(v)?.gt(0) ?? false;
const nonNegative = (v: string | null) => parse(v)?.gte(0) ?? false;

const fail = (code: string, field?: string): Violation => ({ code, field });

/** Parent links: `[field on the child, parent entity, may be null]`. A live child needs a live parent. */
const REFS: { [E in EntityName]?: [string, EntityName, boolean][] } = {
  plot: [['farm_id', 'farm', false]],
  season: [['plot_id', 'plot', false]],
  care_log: [
    ['season_id', 'season', false],
    ['case_id', 'disease_case', true],
  ],
  expense: [
    ['season_id', 'season', false],
    ['care_log_id', 'care_log', true],
  ],
  sale: [['season_id', 'season', false]],
  sale_payment: [['sale_id', 'sale', false]],
  disease_case: [['season_id', 'season', false]],
  scan: [
    ['season_id', 'season', false],
    ['case_id', 'disease_case', true],
  ],
  self_check: [['season_id', 'season', false]],
};

function checkRow(t: Tables, entity: EntityName, row: Record<string, any>): Violation | null {
  switch (entity) {
    case 'farm':
      return blank(row.name) ? fail('required', 'name') : null;

    case 'plot': {
      if (blank(row.name)) return fail('required', 'name');
      if (row.area_ha != null && !nonNegative(row.area_ha)) return fail('invalid', 'area_ha');
      if (row.tree_count != null && row.tree_count < 0) return fail('invalid', 'tree_count');
      const clash = alive(t.plot).some(
        (p) =>
          p.id !== row.id &&
          p.farm_id === row.farm_id &&
          p.name.trim().toLowerCase() === row.name.trim().toLowerCase(),
      );
      return clash ? fail('plot_name_taken', 'name') : null;
    }

    case 'season': {
      if (blank(row.name)) return fail('required', 'name');
      if (blank(row.started_on)) return fail('required', 'started_on');
      if (!SEASON_STAGES.includes(row.stage)) return fail('invalid', 'stage');
      if ((row.stage === 'other') !== (row.stage_other != null)) {
        return fail('invalid', 'stage_other');
      }
      for (const f of ['forecast_yield_kg', 'forecast_price_vnd_kg', 'forecast_total_cost_vnd']) {
        if (row[f] != null && !nonNegative(row[f])) return fail('invalid', f);
      }
      const open = alive(t.season).filter(
        (s) => s.plot_id === row.plot_id && s.closed_on == null && s.id !== row.id,
      );
      return row.closed_on == null && open.length > 0
        ? fail('season_already_open', 'plot_id')
        : null;
    }

    case 'care_log': {
      if (!CARE_KINDS.includes(row.kind)) return fail('invalid', 'kind');
      if (blank(row.occurred_on)) return fail('required', 'occurred_on');
      const inputs: any[] = row.inputs ?? [];
      if (
        CARE_KINDS_WITH_INPUTS.includes(row.kind) &&
        !inputs.some((i) => !blank(i.product_name))
      ) {
        return fail('input_required', 'inputs');
      }
      for (const [i, input] of inputs.entries()) {
        if (blank(input.product_name)) return fail('required', `inputs.${i}.product_name`);
        if (input.amount != null && !positive(input.amount))
          return fail('invalid', `inputs.${i}.amount`);
        if ((input.amount == null) !== blank(input.unit))
          return fail('amount_unit_together', `inputs.${i}.unit`);
      }
      const c = row.case_id ? t.disease_case.get(row.case_id) : null;
      return c && c.season_id !== row.season_id ? fail('different_season', 'case_id') : null;
    }

    case 'expense': {
      if (!EXPENSE_CATEGORIES.includes(row.category)) return fail('invalid', 'category');
      if (blank(row.occurred_on)) return fail('required', 'occurred_on');
      if (!positive(row.amount_vnd)) return fail('amount_positive', 'amount_vnd');
      if (row.care_log_id) {
        const log = t.care_log.get(row.care_log_id);
        if (log && log.season_id !== row.season_id) return fail('different_season', 'care_log_id');
        const dup = alive(t.expense).some(
          (e) => e.id !== row.id && e.care_log_id === row.care_log_id,
        );
        if (dup) return fail('care_log_has_expense', 'care_log_id');
      }
      return null;
    }

    case 'sale': {
      if (blank(row.buyer_name)) return fail('required', 'buyer_name');
      if (blank(row.agreed_on)) return fail('required', 'agreed_on');
      if (!SALE_STATUSES.includes(row.status)) return fail('invalid', 'status');
      if (row.total_vnd != null && !nonNegative(row.total_vnd)) return fail('invalid', 'total_vnd');
      if (row.status === 'confirmed' && row.total_vnd == null)
        return fail('total_required', 'total_vnd');
      if (row.weight_kg != null && !positive(row.weight_kg)) return fail('invalid', 'weight_kg');
      return null;
    }

    case 'sale_payment': {
      if (!PAYMENT_KINDS.includes(row.kind)) return fail('invalid', 'kind');
      if (blank(row.occurred_on)) return fail('required', 'occurred_on');
      return positive(row.amount_vnd) ? null : fail('amount_positive', 'amount_vnd');
    }

    case 'disease_case':
      return blank(row.opened_at) ? fail('required', 'opened_at') : null;

    case 'scan': {
      if (blank(row.photo_id)) return fail('photo_required', 'photo_id');
      if (blank(row.plant_part)) return fail('required', 'plant_part');
      if (!['suspected', 'healthy', 'inconclusive'].includes(row.outcome))
        return fail('invalid', 'outcome');
      if (row.score != null && !(row.score >= 0 && row.score <= 1)) return fail('invalid', 'score');
      const c = row.case_id ? t.disease_case.get(row.case_id) : null;
      return c && c.season_id !== row.season_id ? fail('different_season', 'case_id') : null;
    }

    case 'self_check': {
      const dup = alive(t.self_check).some(
        (s) =>
          s.id !== row.id &&
          s.season_id === row.season_id &&
          s.standard_version_id === row.standard_version_id,
      );
      return dup ? fail('self_check_exists', 'standard_version_id') : null;
    }
  }
}

/** Rule: refunds of one sale never exceed its deposits + receipts, whatever was edited or deleted. */
function checkSalePayments(t: Tables, saleId: string): Violation | null {
  const payments = alive(t.sale_payment).filter((p) => p.sale_id === saleId);
  const { refundableLimit } = saleBalance({ status: 'provisional', total_vnd: null }, payments);
  return parse(refundableLimit)?.isNegative()
    ? fail('refund_exceeds_received', 'amount_vnd')
    : null;
}

/** Checks the rows touched by a mutation against the post-commit state. First violation wins. */
export function validate(
  t: Tables,
  touched: { entity: EntityName; id: string }[],
): Violation | null {
  const salesToCheck = new Set<string>();

  for (const { entity, id } of touched) {
    const row = t[entity].get(id) as Record<string, any> | undefined;
    if (!row) continue;
    if (entity === 'sale_payment') salesToCheck.add(row.sale_id);

    if (!row.deleted_at) {
      const own = checkRow(t, entity, row);
      if (own) return own;
      for (const [field, parent, nullable] of REFS[entity] ?? []) {
        const pid = row[field];
        if (pid == null) {
          if (!nullable) return fail('required', field);
          continue;
        }
        const p = t[parent].get(pid);
        if (!p || p.deleted_at) return fail('parent_missing', field);
      }
    } else {
      // A deleted row must not leave live rows pointing at it.
      for (const [childName, links] of Object.entries(REFS) as [
        EntityName,
        [string, EntityName, boolean][],
      ][]) {
        for (const [field, parent] of links) {
          if (parent !== entity) continue;
          const orphan = alive(t[childName] as Map<string, any>).find((c: any) => c[field] === id);
          if (!orphan) continue;
          if (entity === 'care_log' && childName === 'expense')
            return fail('linked_expense_exists', 'care_log_id');
          if (entity === 'sale' && childName === 'sale_payment')
            return fail('sale_has_payments', 'id');
          return fail('has_children', 'id');
        }
      }
    }
  }

  for (const saleId of salesToCheck) {
    const v = checkSalePayments(t, saleId);
    if (v) return v;
  }
  return null;
}
