import { randomUUID } from 'expo-crypto';

/** Client-made UUID for a row or a mutation. Created once per user action, never on retry. */
export const newId = (): string => randomUUID();
