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

/** Size of the image whose longer side is `side`, as the model was trained (each dimension rounded). */
export function fitInside(srcW: number, srcH: number, side: number) {
  const ratio = side / Math.max(srcW, srcH);
  return {
    width: Math.max(1, Math.round(srcW * ratio)),
    height: Math.max(1, Math.round(srcH * ratio)),
  };
}

/** Puts RGBA pixels in the centre of a `size`×`size` canvas filled with `pad` (letterbox). */
export function letterbox(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  size: number,
  pad: readonly [number, number, number],
) {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let p = 0; p < size * size; p++) {
    out[p * 4] = pad[0];
    out[p * 4 + 1] = pad[1];
    out[p * 4 + 2] = pad[2];
    out[p * 4 + 3] = 255;
  }
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = ((top + y) * size + left + x) * 4;
      out[dst] = rgba[src];
      out[dst + 1] = rgba[src + 1];
      out[dst + 2] = rgba[src + 2];
    }
  }
  return out;
}
