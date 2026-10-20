import type { ModelEntry } from './manifest';

type Input = ModelEntry['input'];

/**
 * RGBA pixels (already resized to the model size) → the tensor data the manifest describes:
 * channel order, layout, scale, mean and std.
 */
export function toTensorData(rgba: ArrayLike<number>, input: Input): Float32Array {
  const { width, height, layout, color, scale, mean, std } = input;
  const plane = width * height;
  const out = new Float32Array(plane * 3);
  const order = color === 'RGB' ? [0, 1, 2] : [2, 1, 0];
  for (let p = 0; p < plane; p++) {
    for (let c = 0; c < 3; c++) {
      const value = (rgba[p * 4 + order[c]] * scale - mean[c]) / std[c];
      out[layout === 'NCHW' ? c * plane + p : p * 3 + c] = value;
    }
  }
  return out;
}

export const tensorDims = (input: Input): [number, number, number, number] =>
  input.layout === 'NCHW' ? [1, 3, input.height, input.width] : [1, input.height, input.width, 3];

/** Largest centred crop with the target aspect ratio, in source pixels. */
export function centerCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  const target = dstW / dstH;
  const source = srcW / srcH;
  if (source > target) {
    const width = Math.round(srcH * target);
    return { originX: Math.round((srcW - width) / 2), originY: 0, width, height: srcH };
  }
  const height = Math.round(srcW / target);
  return { originX: 0, originY: Math.round((srcH - height) / 2), width: srcW, height };
}
