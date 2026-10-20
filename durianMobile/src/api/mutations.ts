import type {
  EntityMap,
  EntityName,
  Mutation,
  MutationOp,
  MutationResult,
  MutationRow,
} from '@/types';

import { ApiRequestError } from './errors';
import { newId } from './ids';

type Fields<E extends EntityName> = NonNullable<MutationOp<E>['data']>;

/** Create or update. Pass `expected_revision` from the row being edited; `null` for a new row. */
export function upsert<E extends EntityName>(
  entity: E,
  id: string,
  data: Fields<E>,
  expectedRevision: number | null,
): MutationOp<E> {
  return { entity, op: 'upsert', id, expected_revision: expectedRevision, data };
}

export function remove<E extends EntityName>(
  entity: E,
  id: string,
  expectedRevision: number,
): MutationOp<E> {
  return { entity, op: 'delete', id, expected_revision: expectedRevision };
}

/**
 * One user action = one mutation = one `mutation_id`. Build it when the user taps Save and keep
 * it if the request has to be sent again, so the server can tell a retry from a new action.
 */
export function mutation(...ops: MutationOp[]): Mutation {
  return { mutation_id: newId(), ops };
}

/** Throws the right `ApiRequestError` for a non-applied result; otherwise returns the written rows. */
export function unwrap(result: MutationResult): MutationRow[] {
  if (result.status === 'applied') return result.rows;
  if (result.status === 'conflict') {
    throw new ApiRequestError({
      code: 'revision_conflict',
      message: 'The record changed on the server',
      status: 409,
      server: result.rows,
    });
  }
  throw new ApiRequestError({
    code: result.code,
    message: result.field ? `${result.code}@${result.field}` : result.code,
    status: 422,
    field: result.field,
  });
}

/** Picks the written row of one entity out of an applied mutation. */
export function rowOf<E extends EntityName>(
  rows: readonly MutationRow[],
  entity: E,
  id: string,
): EntityMap[E] | undefined {
  return rows.find((r) => r.entity === entity && r.row.id === id)?.row as EntityMap[E] | undefined;
}
