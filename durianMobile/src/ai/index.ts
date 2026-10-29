import type { InferenceEngine } from './router';
import { stubEngine, STUB_MODEL_ID } from './stub';

export * from './decode';
export * from './labels';
export * from './manifest';
export * from './modelInstaller';
export * from './modelStore';
export * from './modelSync';
export * from './router';
export * from './updates';
export { isOnCellular } from './modelFiles';
export { STUB_ENABLED, STUB_MODEL_ID, withStubs } from './stub';

/**
 * The stub model only answers for its own entries; everything else goes to ONNX Runtime, which is
 * loaded on first use so the native module is not touched until a real model runs.
 */
export const engine: InferenceEngine = {
  async classify(entry, uri) {
    if (entry.model_id === STUB_MODEL_ID) return stubEngine.classify(entry, uri);
    const { onnxEngine } = await import('./onnxEngine');
    return onnxEngine.classify(entry, uri);
  },
};
